# Buying credits (USDT/USDC on Solana)

## Step 1 — Get an API key
Open:
- https://clawbrief-api.onrender.com/signup

Create your API key and save it.

## Step 2 — Create an invoice
Open:
- https://clawbrief-api.onrender.com/topup

Paste your API key, choose USDT or USDC, choose amount, then click **Create invoice**.

## Step 3 — Pay
Send the exact amount (USDT/USDC on Solana) to the displayed address.

**Important:** if your wallet supports memo/notes, paste the memo exactly (e.g. `CLAWBRIEF:inv_...`).

## Step 4 — Confirmation
Once payment is detected, the invoice status changes to `CONFIRMED` and credits are added automatically.

## Check your balance
Open:
- https://clawbrief-api.onrender.com/dashboard

(Or call `GET /v1/usage` with your API key.)
