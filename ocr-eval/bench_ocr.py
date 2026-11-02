"""Runs one OCR engine over the evaluation images, in the same output format as run_ocr.py, so
evaluate.test.ts can compare engines end to end (MODELS=<engine> OCR_EVAL=1 pnpm exec vitest run ocr-eval).

Usage: the paddle-* engines run in this folder's .venv (paddleocr, as for run_ocr.py); the others need
`pip install "python-doctr[torch]" easyocr torch torchvision` in a separate venv.
  python bench_ocr.py paddle-small            # what the OCR service runs today
  python bench_ocr.py paddle-medium
  python bench_ocr.py paddle-small-rotate     # + page and text-line orientation (sideways boxes)
  python bench_ocr.py paddle-small-sensitive  # lower detection thresholds (stylised logos)
  python bench_ocr.py doctr                   # docTR: DBNet + PARSeq
  python bench_ocr.py easyocr                 # EasyOCR: CRAFT + CRNN

Images are shrunk to 1280 px on the longest side first, like the OCR service does with phone photos.
Writes out/<engine>/<set>/<name>.json; already-read images are skipped.

Variants for tuning:
  python bench_ocr.py paddle-small --name paddle-side1600 --max-side 1600
  python bench_ocr.py paddle-small --name paddle-boxthresh05 --opt text_det_box_thresh=0.5
  python bench_ocr.py paddle-small --name paddle-clahe --prep clahe     # also: autocontrast, sharpen
SPLIT=tune|holdout reads only that half of the games (split.py); SETS=covers,gallery only those sets.
"""

import argparse

import json
import os
import sys
import tempfile
import time
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

from split import half_of

ROOT = Path(__file__).parent
DATA = ROOT / "data"
MAX_SIDE = 1280
# SETS=covers,gallery limits the photo sets read.
SETS = tuple(os.environ.get("SETS", "covers,phone,phone2,shelves,shelves2,gallery").split(","))


def line(text: str, score: float, xs: list[float], ys: list[float]) -> dict:
    return {"text": text, "score": round(float(score), 3), "box": [int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))]}


def prepare(img: Image.Image, prep: str | None) -> Image.Image:
    """Optional clean-up before OCR, as the service could do."""
    if prep == "autocontrast":
        return ImageOps.autocontrast(img, cutoff=1)
    if prep == "sharpen":
        return img.filter(ImageFilter.UnsharpMask(radius=2, percent=120, threshold=3))
    if prep == "clahe":
        import cv2
        import numpy as np

        lab = cv2.cvtColor(np.asarray(img), cv2.COLOR_RGB2LAB)
        lab[:, :, 0] = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(lab[:, :, 0])
        return Image.fromarray(cv2.cvtColor(lab, cv2.COLOR_LAB2RGB))
    return img


def paddle(model: str, **options):
    from paddleocr import PaddleOCR

    ocr = PaddleOCR(
        text_detection_model_name=f"PP-OCRv6_{model}_det",
        text_recognition_model_name=f"PP-OCRv6_{model}_rec",
        **{"use_doc_orientation_classify": False, "use_doc_unwarping": False, "use_textline_orientation": False, **options},
    )

    def read(path: Path, img: Image.Image) -> list[dict]:
        [res] = list(ocr.predict(str(path)))
        boxes = res["rec_boxes"].tolist() if len(res["rec_texts"]) else []
        return [line(t, s, [b[0], b[2]], [b[1], b[3]]) for t, s, b in zip(res["rec_texts"], res["rec_scores"], boxes)]

    return read


def doctr():
    from doctr.io import DocumentFile
    from doctr.models import ocr_predictor

    predictor = ocr_predictor(det_arch="db_resnet50", reco_arch="parseq", pretrained=True, assume_straight_pages=True)

    def read(path: Path, img: Image.Image) -> list[dict]:
        page = predictor(DocumentFile.from_images(str(path))).pages[0]
        w, h = img.size
        out = []
        for block in page.blocks:
            for ln in block.lines:
                if not ln.words:
                    continue
                (x0, y0), (x1, y1) = ln.geometry
                score = min(word.confidence for word in ln.words)
                out.append(line(" ".join(word.value for word in ln.words), score, [x0 * w, x1 * w], [y0 * h, y1 * h]))
        return out

    return read


def easyocr():
    import easyocr as easy

    reader = easy.Reader(["en", "fr"], gpu=False, verbose=False)

    def read(path: Path, img: Image.Image) -> list[dict]:
        return [line(text, score, [p[0] for p in quad], [p[1] for p in quad]) for quad, text, score in reader.readtext(str(path))]

    return read


ENGINES = {
    "paddle-small": lambda **options: paddle("small", **options),
    "paddle-medium": lambda: paddle("medium"),
    "paddle-small-rotate": lambda: paddle("small", use_doc_orientation_classify=True, use_textline_orientation=True),
    "paddle-small-sensitive": lambda: paddle(
        "small", text_det_thresh=0.2, text_det_box_thresh=0.45, text_det_unclip_ratio=2.0
    ),
    "doctr": doctr,
    "easyocr": easyocr,
}


def option(text: str) -> tuple[str, object]:
    key, value = text.split("=", 1)
    for cast in (int, float):
        try:
            return key, cast(value)
        except ValueError:
            pass
    return key, value


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("engine", choices=sorted(ENGINES))
    parser.add_argument("--name", help="output folder under out/ (default: the engine)")
    parser.add_argument("--max-side", type=int, default=MAX_SIDE)
    parser.add_argument("--prep", choices=["autocontrast", "sharpen", "clahe"])
    parser.add_argument("--opt", action="append", default=[], type=option, help="engine setting, key=value")
    args = parser.parse_args()
    name = args.name or args.engine
    split = os.environ.get("SPLIT")
    read = ENGINES[args.engine](**dict(args.opt)) if args.opt else ENGINES[args.engine]()
    with tempfile.TemporaryDirectory() as tmp:
        for set_name in SETS:
            out_dir = ROOT / "out" / name / set_name
            out_dir.mkdir(parents=True, exist_ok=True)
            for path in sorted((DATA / set_name).glob("*.jp*g")):
                ids = [int(part.split("~")[0]) for part in path.stem.split("-")]
                if split and not all(half_of(i) == split for i in ids):
                    continue
                target = out_dir / f"{path.stem}.json"
                if target.exists():
                    continue
                img = prepare(Image.open(path).convert("RGB"), args.prep)
                img.thumbnail((args.max_side, args.max_side))
                shrunk = Path(tmp) / f"{set_name}-{path.stem}.jpg"
                img.save(shrunk, "JPEG", quality=90)
                started = time.perf_counter()
                lines = read(shrunk, img)
                elapsed = time.perf_counter() - started
                result = {"image": path.name, "width": img.width, "height": img.height, "seconds": round(elapsed, 3), "lines": lines}
                target.write_text(json.dumps(result, ensure_ascii=False, indent=1))
                print(f"{name}/{set_name}/{path.name}: {len(lines)} lines in {elapsed:.2f}s", flush=True)


if __name__ == "__main__":
    main()
