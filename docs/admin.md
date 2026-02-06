# Admin (internal)

This document is for operators/admins. Do not share publicly if you don't want admin flows exposed.

## Create API keys
Endpoint:
- `POST /v1/admin/keys`
- Header: `X-Admin-Token: <ADMIN_TOKEN>`
- Body: `{ "name": "customer1", "credits": 200 }`

Example:
```bash
curl -sS https://clawbrief-api.onrender.com/v1/admin/keys \
  -H "X-Admin-Token: <ADMIN_TOKEN>" \
  -H "content-type: application/json" \
  -d '{"name":"customer1","credits":200}'
```

## Manual topup confirm (fallback)
Endpoint:
- `POST /v1/topup/confirm`
- Header: `X-Admin-Token: <ADMIN_TOKEN>`
- Body: `{ "invoiceId": "inv_...", "txHash": "..." }`

Example:
```bash
curl -sS https://clawbrief-api.onrender.com/v1/topup/confirm \
  -H "X-Admin-Token: <ADMIN_TOKEN>" \
  -H "content-type: application/json" \
  -d '{"invoiceId":"inv_...","txHash":"..."}'
```

## Manual payment ↔ invoice match (if memo missing)
Endpoint:
- `POST /v1/admin/topup/match`
- Header: `X-Admin-Token: <ADMIN_TOKEN>`
- Body: `{ "invoiceRef": "inv_...", "txHash": "..." }`
