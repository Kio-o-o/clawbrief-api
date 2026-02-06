# Helius webhook setup (Solana USDT/USDC) for ClawBrief

## 1) Render env vars
Set these in the Render web service:
- TOPUP_WEBHOOK_SECRET = <random string>
- SOL_USDT_MINT = <USDT mint on Solana>
- SOL_USDC_MINT = <USDC mint on Solana>
- CRYPTO_PAY_ADDRESS = <your Solana address>

(plus existing: DATABASE_URL, ADMIN_TOKEN, GEMINI_API_KEY, etc.)

## 2) Webhook URL
Set Helius webhook destination to:
- https://clawbrief-api.onrender.com/v1/topup/webhook/solana

## 3) Secret header
Configure Helius to send an HTTP header:
- x-topup-webhook-secret: <TOPUP_WEBHOOK_SECRET>

## Notes
- The receiver will only accept token transfers that:
  - go to CRYPTO_PAY_ADDRESS
  - have mint in allowlist (SOL_USDT_MINT / SOL_USDC_MINT)
- If memo is present (CLAWBRIEF:inv_xxx) it will auto-match precisely.
- If memo is missing, it will auto-match only when there is exactly 1 pending invoice with the exact same amount in the matching time window; otherwise it remains UNMATCHED and you can use /v1/admin/topup/match.
