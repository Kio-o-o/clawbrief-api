# ClawBrief API

Turn text / URLs / PDFs / images (OCR) into a stable, agent-friendly JSON payload:
- `summary`
- `bullets`
- `todos`
- `tags`
- `risk_flags`

## Status
- Production base URL: **https://clawbrief-api.onrender.com**

## Quickstart
### Health
```bash
curl -sS https://clawbrief-api.onrender.com/healthz
```

### Create an API key (admin)
```bash
curl -sS https://clawbrief-api.onrender.com/v1/admin/keys \
  -H "X-Admin-Token: <ADMIN_TOKEN>" \
  -H "content-type: application/json" \
  -d '{"name":"customer1","credits":200}'
```

### Brief: text
```bash
curl -sS https://clawbrief-api.onrender.com/v1/brief \
  -H "Authorization: Bearer <apiKey>" \
  -H "content-type: application/json" \
  -d '{"text":"..."}'
```

### Brief: URL
```bash
curl -sS https://clawbrief-api.onrender.com/v1/brief \
  -H "Authorization: Bearer <apiKey>" \
  -H "content-type: application/json" \
  -d '{"url":"https://example.com"}'
```

### Brief: file (PDF / image)
```bash
curl -sS https://clawbrief-api.onrender.com/v1/brief \
  -H "Authorization: Bearer <apiKey>" \
  -F "file=@./sample.pdf"
```

## Billing
- Paid endpoints require: `Authorization: Bearer <apiKey>`
- Responses include:
  - `billing.cost`
  - `billing.credits_remaining`

Credits are size-aware (so a 50k-page PDF won’t cost the same as a 3-page PDF):
- text: `1 + floor(max(0, chars-4000)/4000)`
- url:  `2 + floor(max(0, chars-6000)/6000)`
- pdf:  `2 + floor((pages-1)/5) + floor(max(0, extractedChars-10000)/10000)`
- image: `2 + floor(max(0, megapixels-2)/2)`

## Topups (USDT/USDC on Solana)
### Create invoice
```bash
curl -sS https://clawbrief-api.onrender.com/v1/topup/create \
  -H "Authorization: Bearer <apiKey>" \
  -H "content-type: application/json" \
  -d '{"units":5,"chain":"SOL","asset":"USDT"}'
```

### Auto-confirm (webhook)
This service supports automatic crediting via Helius webhook.
See: `deploy/helius.md`

### Manual confirm (admin)
If needed:
```bash
curl -sS https://clawbrief-api.onrender.com/v1/topup/confirm \
  -H "X-Admin-Token: <ADMIN_TOKEN>" \
  -H "content-type: application/json" \
  -d '{"invoiceId":"inv_...","txHash":"..."}'
```

## Monitoring
### Metrics
`/metrics` is protected by `METRICS_TOKEN`:
```bash
curl -sS https://clawbrief-api.onrender.com/metrics \
  -H "Authorization: Bearer <METRICS_TOKEN>"
```

## Security notes
- Never commit `.env`.
- Never paste API keys / admin tokens into public issues.

## Development
Local dev notes: `docs/dev.md`
