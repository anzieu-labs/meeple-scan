# bgg-ocr

Reads the text on a board-game box cover with PaddleOCR (PP-OCRv6 **small**, CPU). The Next.js app sends
it a photo and turns the biggest text into BGG search queries (`lib/matching/cover.ts`).

## API

| | |
|---|---|
| `POST /ocr` | Body: the raw image (JPEG, PNG or WebP, ≤ 5 MB). Header `X-API-Key`. Returns `{ width, height, seconds, lines: [{ text, score, box: [x0, y0, x1, y1] }] }`. Images are downscaled to 1280 px. |
| `GET /health` | `{ "status": "ok", "model": "PP-OCRv6_small" }`, no key needed. |

Errors: 401 wrong key · 400 empty body · 413 over 5 MB · 415 not an image.

```bash
curl -X POST -H "X-API-Key: $OCR_API_KEY" -H "Content-Type: image/jpeg" \
  --data-binary @cover.jpg https://ocr.example.com/ocr
```

## Run locally

```bash
docker build --platform linux/amd64 -t bgg-ocr .
docker run --rm -p 8077:8000 -e OCR_API_KEY=dev-key bgg-ocr
```

PaddlePaddle only ships x86_64 Linux wheels, so on Apple Silicon this runs under emulation (2–3× slower).

## Deploy on Coolify

1. **New resource → Public/Private Repository**, pick this repo and branch.
2. **Build pack: Dockerfile**, **Base Directory: `/ocr-service`**.
3. **Ports Exposes: `8000`**, and set a domain such as `https://ocr.example.com` (Coolify's proxy issues the certificate).
4. **Environment variables**: `OCR_API_KEY` = a long random secret (`openssl rand -hex 32`). Mark it as a runtime variable, not a build variable.
5. **Healthcheck**: path `/health`, port `8000` (the Dockerfile also declares one; boot takes ~10 s).
6. **Resource limits** (Advanced): 2 CPUs and 2 GB RAM are plenty; the container uses ~1 GB.
7. Deploy, then check `https://ocr.example.com/health`.

Models are baked into the image at build time, so no volume is needed and the container never downloads
anything at runtime.

Then in Vercel, add `OCR_URL` (e.g. `https://ocr.example.com`) and `OCR_API_KEY` (same secret) to the
Next.js project.

## Notes

- One image is read at a time per container (PaddleOCR isn't thread-safe); each read already uses all
  the CPUs it's given. For more throughput, run more replicas rather than more workers.
- `OCR_MODEL=tiny|small|medium` switches the model size; the image only contains the model it was built with.
