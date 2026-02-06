# Neon Postgres (free tier) setup for Render

1) Create Neon project
- Go to https://neon.tech
- Create a project (region closest to Render Singapore, e.g. Singapore/Tokyo depending on availability)

2) Get connection string
- In Neon dashboard → Connection Details
- Copy the **pooled** connection string if available (recommended for serverless)
  - If Prisma has issues with pooled, use the regular connection string.

3) Set Render env vars (Web service)
- DATABASE_URL = <Neon connection string>
- (Optional) DIRECT_URL = <non-pooled connection string> (some Prisma setups use this)

4) Deploy
- Render will run: `npm run start:render` → `prisma migrate deploy` on boot.

Notes
- Ensure SSL is enabled (Neon URLs include `?sslmode=require`).
- Do not paste secrets into chat.
