# ClawBrief API

A paid API that turns text / URLs / PDFs / images (OCR) into a stable, agent-friendly JSON payload:
- `summary`
- `bullets`
- `todos`
- `tags`
- `risk_flags`

**Base URL:** https://clawbrief-api.onrender.com

## Pricing (credits)
- Credits are deducted per request.
- Current topup rate (v0): **$1 ≈ 100 credits** (USDT/USDC on Solana)

## Get an API key
Self-serve:
- https://clawbrief-api.onrender.com/signup

Buy credits:
- https://clawbrief-api.onrender.com/topup

Check balance:
- https://clawbrief-api.onrender.com/dashboard

(Operator docs: `docs/admin.md`)

## Quickstart
### Health
```bash
curl -sS https://clawbrief-api.onrender.com/healthz
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

## Billing behavior
Responses include:
- `billing.cost`
- `billing.credits_remaining`

Credits are size-aware (so a 50k-page PDF won’t cost the same as a 3-page PDF):
- text: `1 + floor(max(0, chars-4000)/4000)`
- url:  `2 + floor(max(0, chars-6000)/6000)`
- pdf:  `2 + floor((pages-1)/5) + floor(max(0, extractedChars-10000)/10000)`
- image: `2 + floor(max(0, megapixels-2)/2)`

## Topups (USDT/USDC on Solana)
- Create invoice: `POST /v1/topup/create`
- Auto-confirm: supported via webhook (Helius)

Operator docs:
- `deploy/helius.md`

## Monitoring
`/metrics` is protected by `METRICS_TOKEN`.

## Security notes
- Never commit `.env`.
- Never paste API keys / admin tokens into public issues.

## Development
Local dev notes: `docs/dev.md`
