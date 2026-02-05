# ClawBrief API

把文字 / URL / PDF / 圖片（OCR）整理成固定格式：summary + bullets + todos + tags + risk_flags。

Deploy target: Render + Postgres + Sentry + Grafana Cloud.

## Prereqs
- Node.js 18+
- Windows: Tesseract OCR
  - 目前預設路徑：`C:\Program Files\Tesseract-OCR\tesseract.exe`

## Run
```bash
cd D:\Kio\projects\clawbrief-api
npm i
npm run dev
# listens on http://127.0.0.1:8787
```

## API
### Auth
All paid endpoints require:
- `Authorization: Bearer <apiKey>`

### Topups (Crypto, manual-confirm MVP)
- Create invoice: `POST /v1/topup/create` (requires API key)
- Confirm invoice: `POST /v1/topup/confirm` (requires `X-Admin-Token`)

Quick scripts:
```bash
node scripts/test_topup.js <apiKey>           # creates a USDT(SOL) invoice by default
node scripts/confirm_topup.js <invoiceId> <txHash> <adminToken>
```

This is an MVP that lets you accept USDC/USDT by transfer and manually confirm the txHash to credit the account.

Create a local test key:
```bash
node scripts/create_key.js local 200
```

Check credits:
```bash
curl -s http://127.0.0.1:8787/v1/usage \
  -H "Authorization: Bearer <apiKey>"
```

### Credits
Credits are size-aware (so a 50k-page PDF won’t cost the same as a 3-page PDF):
- text: `1 + floor(max(0, chars-4000)/4000)`
- url:  `2 + floor(max(0, chars-6000)/6000)`
- pdf:  `2 + floor((pages-1)/5) + floor(max(0, extractedChars-10000)/10000)`
- image: `2 + floor(max(0, megapixels-2)/2)`

### GET /healthz

### POST /v1/brief
支援兩種輸入型態：

1) JSON（text 或 url 二選一）
```bash
curl -s http://127.0.0.1:8787/v1/brief \
  -H "Authorization: Bearer <apiKey>" \
  -H "content-type: application/json" \
  -d '{"text":"..."}'

curl -s http://127.0.0.1:8787/v1/brief \
  -H "Authorization: Bearer <apiKey>" \
  -H "content-type: application/json" \
  -d '{"url":"https://example.com"}'
```

2) multipart/form-data（file）
```bash
curl -s http://127.0.0.1:8787/v1/brief \
  -H "Authorization: Bearer <apiKey>" \
  -F "file=@./sample.pdf"

curl -s http://127.0.0.1:8787/v1/brief \
  -H "Authorization: Bearer <apiKey>" \
  -F "file=@./sample.png"
```

## LLM
- 如果你有設定 `OPENAI_API_KEY`，會走 OpenAI Responses API 產生繁中摘要/待辦。
- 沒有 key 的情況下，會用 heuristic 先頂著（可用於內測 pipeline）。

你之後想要接 OpenClaw 同款模型的官方路徑，我們可以再把 provider 抽成 plug-in（或直接用你既有的金鑰/代理）。
