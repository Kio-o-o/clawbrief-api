# Dev notes (local)

This file is for local development notes. Do not treat it as production documentation.

## Run locally
```bash
npm i
npm run dev
# default: http://127.0.0.1:8787
```

## Local dependencies
- OCR (Windows): install Tesseract
  - default path: `C:\Program Files\Tesseract-OCR\tesseract.exe`

## Local filesystem
- This project was developed on Windows and may reference local paths in scripts.
- Do not commit `.env` or any secret config.
