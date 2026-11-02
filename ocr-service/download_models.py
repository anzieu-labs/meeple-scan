"""Build step: download the PP-OCRv6 models into the image so containers start without network access."""

import os

from paddleocr import PaddleOCR

model = os.environ.get("OCR_MODEL", "small")
PaddleOCR(
    text_detection_model_name=f"PP-OCRv6_{model}_det",
    text_recognition_model_name=f"PP-OCRv6_{model}_rec",
    use_doc_orientation_classify=False,
    use_doc_unwarping=False,
    use_textline_orientation=False,
)
print(f"PP-OCRv6_{model} models ready")
