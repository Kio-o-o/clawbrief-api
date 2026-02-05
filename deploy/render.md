# Render deploy plan (ClawBrief)

## Services
1) Web Service (Node)
- Build: `npm ci && npx prisma generate`
- Start: `npm run start`
- Health check: `/healthz`
- Env vars:
  - `DATABASE_URL`
  - `REDIS_URL` (optional for shared rate limit later)
  - `GEMINI_API_KEY`, `GEMINI_MODEL`
  - `CRYPTO_PAY_ADDRESS`
  - `ADMIN_TOKEN`
  - `CREDITS_PER_USD`, `MIN_TOPUP_USD`
  - `SENTRY_DSN`
  - `METRICS_TOKEN` (protect /metrics)

2) Postgres (Render)

(Optional) 3) Redis (Render)

## Notes
- Do NOT commit `.env`.
- Store only hashed API keys in DB.
- Use HTTPS-only public endpoint.
