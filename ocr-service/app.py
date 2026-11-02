"""Box-cover OCR service: PaddleOCR PP-OCRv6 (small) behind a tiny authenticated HTTP API.

POST /ocr     raw image bytes (JPEG/PNG/WebP), header X-API-Key -> text lines with score and box
GET  /health  readiness check for Coolify / Docker (no auth)
"""

import hmac
import io
import os
import threading
import time
from contextlib import asynccontextmanager

import numpy as np
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from PIL import Image, ImageOps, UnidentifiedImageError

API_KEY = os.environ.get("OCR_API_KEY", "")
MODEL = os.environ.get("OCR_MODEL", "small")
MAX_BYTES = 5 * 1024 * 1024
MAX_SIDE = 1280  # phone photos are downscaled to this before OCR, as in the evaluation

if not API_KEY:
    raise RuntimeError("OCR_API_KEY must be set")

_ocr = None
# PaddleOCR predictors aren't thread-safe: one image at a time per process; each call already uses all cores.
_lock = threading.Lock()


def get_ocr():
    global _ocr
    if _ocr is None:
        from paddleocr import PaddleOCR

        _ocr = PaddleOCR(
            text_detection_model_name=f"PP-OCRv6_{MODEL}_det",
            text_recognition_model_name=f"PP-OCRv6_{MODEL}_rec",
            # Box covers are photographed upright: skip document unwarping and orientation passes.
            use_doc_orientation_classify=False,
            use_doc_unwarping=False,
            use_textline_orientation=False,
            # Wider text boxes keep the edges of big title letters: more games found in ocr-eval (~1,500
            # covers, phone shots and BGG gallery photos), at the same speed.
            text_det_unclip_ratio=2.0,
        )
    return _ocr


def read_text(pixels: np.ndarray):
    with _lock:
        [result] = list(get_ocr().predict(pixels))
    return result


@asynccontextmanager
async def lifespan(_app: FastAPI):
    get_ocr()  # load once at boot, not on the first request
    yield


app = FastAPI(title="bgg-ocr", docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": f"PP-OCRv6_{MODEL}"}


@app.post("/ocr")
async def ocr(request: Request, x_api_key: str = Header(default="")) -> dict:
    if not hmac.compare_digest(x_api_key, API_KEY):
        raise HTTPException(status_code=401, detail="Invalid API key")

    body = await request.body()
    if not body:
        raise HTTPException(status_code=400, detail="Send the image as the request body")
    if len(body) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Image larger than 5 MB")
    try:
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(body))).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=415, detail="Not a readable image")
    image.thumbnail((MAX_SIDE, MAX_SIDE))
    width, height = image.size
    pixels = np.asarray(image)[:, :, ::-1]  # PaddleOCR expects BGR, like OpenCV

    started = time.perf_counter()
    # Off the event loop, so /health keeps answering while an image is being read.
    result = await run_in_threadpool(read_text, pixels)
    seconds = time.perf_counter() - started

    texts = result["rec_texts"]
    boxes = result["rec_boxes"].tolist() if len(texts) else []
    lines = [
        {"text": text, "score": round(float(score), 3), "box": [int(v) for v in box]}
        for text, score, box in zip(texts, result["rec_scores"], boxes)
    ]
    return {"width": width, "height": height, "seconds": round(seconds, 3), "lines": lines}
