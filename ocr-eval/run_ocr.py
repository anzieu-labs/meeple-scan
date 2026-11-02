"""Runs PaddleOCR on box covers and saves the text lines it finds, for evaluate.test.ts.

Usage:
  .venv/bin/python run_ocr.py --model small     # PP-OCRv6 small det + rec
  .venv/bin/python run_ocr.py --model medium    # PP-OCRv6 medium (PaddleOCR's default)

Reads data/covers/<bggId>.jpg (official BGG covers), data/shelves/<id>-<id>….jpg (several boxes, generated) and
data/photos/<bggId>[-anything].jpg (your own
photos, optional), makes phone-like copies of the covers in data/phone/, and writes
out/<model>/<set>/<name>.json with every line's text, score and box, plus the time it took.
"""

import argparse
import json
import random
import time
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).parent
DATA = ROOT / "data"


def make_phone_copies() -> None:
    """Imitates a handheld photo: slight tilt, off-centre crop, blur, flatter light, heavier JPEG."""
    out = DATA / "phone"
    out.mkdir(exist_ok=True)
    rng = random.Random(42)
    for cover in sorted((DATA / "covers").glob("*.jpg")):
        target = out / cover.name
        if target.exists():
            continue
        img = Image.open(cover).convert("RGB")
        img = img.rotate(rng.uniform(-6, 6), expand=True, fillcolor=(90, 90, 90))
        w, h = img.size
        dx, dy = int(w * rng.uniform(0, 0.08)), int(h * rng.uniform(0, 0.08))
        img = img.crop((dx, dy, w - int(w * 0.08) + dx, h - int(h * 0.08) + dy))
        img = img.filter(ImageFilter.GaussianBlur(rng.uniform(0.8, 1.6)))
        img = ImageEnhance.Contrast(img).enhance(rng.uniform(0.7, 0.9))
        img = ImageEnhance.Brightness(img).enhance(rng.uniform(0.85, 1.15))
        img.thumbnail((1000, 1000))
        img.save(target, "JPEG", quality=60)


def make_shelves() -> None:
    """Several boxes in one photo: 2–3 covers side by side at slightly different sizes, shrunk to 1280 px
    like the OCR service does. File names list the BGG ids on the picture: data/shelves/13-822-9209.jpg."""
    out = DATA / "shelves"
    out.mkdir(exist_ok=True)
    covers = sorted((DATA / "covers").glob("*.jpg"))
    rng = random.Random(7)
    for _ in range(15):
        picked = rng.sample(covers, rng.choice([2, 3]))
        target = out / ("-".join(p.stem for p in picked) + ".jpg")
        if target.exists():
            continue
        boxes = []
        for path in picked:
            img = Image.open(path).convert("RGB")
            h = int(900 * rng.uniform(0.8, 1.0))
            boxes.append(img.resize((int(img.width * h / img.height), h)))
        gap = 40
        shelf = Image.new("RGB", (sum(b.width for b in boxes) + gap * (len(boxes) + 1), 1000), (110, 100, 90))
        x = gap
        for b in boxes:
            shelf.paste(b, (x, 1000 - b.height - 30))
            x += b.width + gap
        shelf.thumbnail((1280, 1280))
        shelf.save(target, "JPEG", quality=80)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", choices=["tiny", "small", "medium"], default="small")
    args = parser.parse_args()

    from paddleocr import PaddleOCR  # slow import, after argument parsing

    make_phone_copies()
    make_shelves()
    ocr = PaddleOCR(
        text_detection_model_name=f"PP-OCRv6_{args.model}_det",
        text_recognition_model_name=f"PP-OCRv6_{args.model}_rec",
        # Box covers are photographed upright: skip document unwarping and orientation passes.
        use_doc_orientation_classify=False,
        use_doc_unwarping=False,
        use_textline_orientation=False,
    )

    sets = [s for s in ("covers", "phone", "shelves", "photos") if (DATA / s).is_dir()]
    for name in sets:
        out_dir = ROOT / "out" / args.model / name
        out_dir.mkdir(parents=True, exist_ok=True)
        images = sorted((DATA / name).glob("*.jp*g"))
        for path in images:
            if (out_dir / f"{path.stem}.json").exists():
                continue  # already read; delete out/ to start over
            started = time.perf_counter()
            [res] = list(ocr.predict(str(path)))
            elapsed = time.perf_counter() - started
            boxes = res["rec_boxes"].tolist() if len(res["rec_texts"]) else []
            width, height = Image.open(path).size
            lines = [
                {"text": text, "score": round(float(score), 3), "box": [int(v) for v in box]}
                for text, score, box in zip(res["rec_texts"], res["rec_scores"], boxes)
            ]
            result = {"image": path.name, "width": width, "height": height, "seconds": round(elapsed, 3), "lines": lines}
            (out_dir / f"{path.stem}.json").write_text(json.dumps(result, ensure_ascii=False, indent=1))
            print(f"{args.model}/{name}/{path.name}: {len(lines)} lines in {elapsed:.2f}s")


if __name__ == "__main__":
    main()
