"""Makes realistic phone-like photos from the official covers, for evaluate.test.ts:

  data/phone2/<bggId>.jpg       one cover photographed: perspective, glare, uneven light, shadow, blur,
                                 noise and colour cast, on a background, filling most of the app's frame
  data/shelves2/<id>-<id>….jpg  2–4 boxes touching on a shelf, slightly tilted, some cut by the frame edge,
                                 then the same camera effects

  .venv/bin/python make_photos.py

Seeded: the same covers always give the same photos. Shelves only mix games from the same half of the
split (split.py), so the held-out half never shares a picture with the tuning half.
"""

import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

from split import half_of

DATA = Path(__file__).parent / "data"
SHELVES_PER_HALF = 30


def perspective_coeffs(src: list[tuple[float, float]], dst: list[tuple[float, float]]) -> list[float]:
    """PIL's PERSPECTIVE transform maps output pixels back to input ones: solve for dst -> src."""
    rows = []
    for (x, y), (u, v) in zip(dst, src):
        rows.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        rows.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    b = np.array([c for point in src for c in point], dtype=float)
    return np.linalg.solve(np.array(rows, dtype=float), b).tolist()


def tilt(img: Image.Image, rng: random.Random, strength: float) -> Image.Image:
    """Seen at an angle: each corner moves inwards by up to `strength` of the side."""
    w, h = img.size
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    dx, dy = w * strength, h * strength
    dst = [
        (rng.uniform(0, dx), rng.uniform(0, dy)),
        (w - rng.uniform(0, dx), rng.uniform(0, dy)),
        (w - rng.uniform(0, dx), h - rng.uniform(0, dy)),
        (rng.uniform(0, dx), h - rng.uniform(0, dy)),
    ]
    out = img.convert("RGBA").transform((w, h), Image.PERSPECTIVE, perspective_coeffs(src, dst), Image.BICUBIC)
    return out


def background(size: tuple[int, int], rng: random.Random) -> Image.Image:
    """A table, shelf or wall: a flat colour with a gentle gradient and grain."""
    w, h = size
    base = np.array([rng.randint(60, 200) for _ in range(3)], dtype=float)
    ramp = np.linspace(rng.uniform(0.7, 1.0), rng.uniform(1.0, 1.3), h)[:, None, None]
    pixels = np.clip(base[None, None, :] * ramp + np.random.default_rng(rng.randint(0, 10**6)).normal(0, 6, (h, w, 3)), 0, 255)
    return Image.fromarray(pixels.astype(np.uint8))


def camera(img: Image.Image, rng: random.Random) -> Image.Image:
    """What a phone does to a picture: uneven light, glare, a shadow, colour cast, blur, noise, JPEG."""
    w, h = img.size
    pixels = np.asarray(img.convert("RGB"), dtype=float)
    # Light falling off across the picture.
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = rng.uniform(0, w), rng.uniform(0, h)
    falloff = 1 - rng.uniform(0.1, 0.35) * np.hypot(xx - cx, yy - cy) / np.hypot(w, h)
    pixels *= falloff[:, :, None]
    # Glare: a bright, soft reflection spot.
    if rng.random() < 0.7:
        gx, gy, r = rng.uniform(0.1, 0.9) * w, rng.uniform(0.1, 0.9) * h, rng.uniform(0.08, 0.25) * max(w, h)
        glare = np.exp(-(((xx - gx) ** 2 + (yy - gy) ** 2) / (2 * r**2))) * rng.uniform(80, 200)
        pixels += glare[:, :, None]
    # A shadow band (a hand, the phone, a shelf edge).
    if rng.random() < 0.4:
        y0 = rng.uniform(0, h)
        band = (np.abs(yy - y0) < rng.uniform(0.05, 0.2) * h) * rng.uniform(0.25, 0.5)
        pixels *= (1 - band)[:, :, None]
    # Warm or cold indoor light.
    pixels *= np.array([rng.uniform(0.9, 1.1), 1.0, rng.uniform(0.85, 1.1)])[None, None, :]
    pixels += np.random.default_rng(rng.randint(0, 10**6)).normal(0, rng.uniform(3, 9), pixels.shape)
    out = Image.fromarray(np.clip(pixels, 0, 255).astype(np.uint8))
    if rng.random() < 0.5:
        out = out.filter(ImageFilter.GaussianBlur(rng.uniform(0.6, 1.8)))
    else:  # hand shake: a short horizontal-ish streak
        size = rng.choice([3, 5])
        kernel = [0.0] * (size * size)
        for i in range(size):
            kernel[(size // 2) * size + i] = 1 / size
        out = out.filter(ImageFilter.Kernel((size, size), kernel))
    out = ImageEnhance.Contrast(out).enhance(rng.uniform(0.75, 1.05))
    out.thumbnail((rng.choice([960, 1080, 1280]),) * 2)
    return out


def frame(content: Image.Image, rng: random.Random, fill: tuple[float, float]) -> Image.Image:
    """Puts `content` on a background in the app's portrait frame, filling part of its width."""
    aspect = rng.uniform(0.66, 0.85)
    width = int(content.width / rng.uniform(*fill))
    canvas = background((width, int(width / aspect)), rng)
    scale = min(1.0, canvas.height * 0.95 / content.height)
    content = content.resize((int(content.width * scale), int(content.height * scale)))
    x = rng.randint(0, max(0, canvas.width - content.width))
    # Roughly centred vertically: the box is what the photo is of.
    spare = max(0, canvas.height - content.height)
    y = rng.randint(spare // 4, max(spare // 4, 3 * spare // 4))
    canvas.paste(content, (x, y), content if content.mode == "RGBA" else None)
    return canvas


def phone_photo(cover: Path, rng: random.Random) -> Image.Image:
    img = Image.open(cover).convert("RGB")
    img.thumbnail((1000, 1000))
    img = tilt(img, rng, rng.uniform(0.0, 0.12)).rotate(rng.uniform(-8, 8), expand=True, resample=Image.BICUBIC)
    # The app asks to fill the frame with the title: the box takes most of its width.
    return camera(frame(img, rng, (0.6, 0.95)), rng)


def shelf_photo(covers: list[Path], rng: random.Random) -> Image.Image:
    height = 700
    boxes = []
    for path in covers:
        img = Image.open(path).convert("RGB")
        h = int(height * rng.uniform(0.75, 1.0))
        img = img.resize((int(img.width * h / img.height), h)).convert("RGBA")
        boxes.append(img.rotate(rng.uniform(-4, 4), expand=True, resample=Image.BICUBIC))
    gap = rng.randint(0, 8)  # touching, or nearly
    width = sum(b.width for b in boxes) + gap * (len(boxes) - 1)
    shelf = Image.new("RGBA", (width, max(b.height for b in boxes) + 20), (0, 0, 0, 0))
    x = 0
    for b in boxes:
        shelf.paste(b, (x, shelf.height - b.height), b)
        x += b.width + gap
    # Cut by the frame edge now and then.
    if rng.random() < 0.5:
        cut = int(shelf.width * rng.uniform(0.05, 0.15))
        shelf = shelf.crop((cut, 0, shelf.width, shelf.height) if rng.random() < 0.5 else (0, 0, shelf.width - cut, shelf.height))
    shelf = tilt(shelf, rng, rng.uniform(0.0, 0.08))
    aspect = rng.uniform(0.66, 0.85)
    canvas = background((shelf.width + 40, max(shelf.height + 40, int((shelf.width + 40) / aspect))), rng)
    canvas.paste(shelf, (20, (canvas.height - shelf.height) // 2), shelf)
    return camera(canvas, rng)


def main() -> None:
    covers = sorted((DATA / "covers").glob("*.jpg"))
    (DATA / "phone2").mkdir(exist_ok=True)
    for cover in covers:
        target = DATA / "phone2" / cover.name
        if not target.exists():
            phone_photo(cover, random.Random(f"phone2-{cover.stem}")).save(target, "JPEG", quality=random.Random(cover.stem).randint(55, 80))
    print(f"phone2: {len(list((DATA / 'phone2').glob('*.jpg')))} photos")

    (DATA / "shelves2").mkdir(exist_ok=True)
    for half in ("tune", "holdout"):
        pool = [c for c in covers if half_of(int(c.stem)) == half]
        rng = random.Random(f"shelves2-{half}")
        for _ in range(SHELVES_PER_HALF):
            picked = rng.sample(pool, rng.choice([2, 3, 3, 4]))
            target = DATA / "shelves2" / ("-".join(p.stem for p in picked) + ".jpg")
            if not target.exists():
                shelf_photo(picked, rng).save(target, "JPEG", quality=rng.randint(60, 82))
    print(f"shelves2: {len(list((DATA / 'shelves2').glob('*.jpg')))} photos")


if __name__ == "__main__":
    main()
