# Box-cover OCR service: PaddleOCR PP-OCRv6 small on CPU.
# PaddlePaddle only publishes x86_64 Linux wheels, so the image is amd64 (build with
# --platform linux/amd64 on Apple Silicon).
FROM --platform=linux/amd64 python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    # Models are baked in at build time; don't probe the model hosts at every start.
    PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK=True \
    PADDLE_PDX_CACHE_HOME=/opt/paddlex \
    OCR_MODEL=small

# OpenCV (pulled in by PaddleOCR) needs these shared libraries; libgomp for Paddle's CPU threads.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY download_models.py .
RUN useradd --system --uid 10001 ocr \
    && python download_models.py \
    && chown -R ocr /opt/paddlex

COPY app.py .
USER ocr

EXPOSE 8000
# Model loading takes ~10 s on boot.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)"
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
