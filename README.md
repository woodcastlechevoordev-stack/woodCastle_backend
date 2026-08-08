# Woodcastle Backend

Express + Prisma + PostgreSQL API for the Woodcastle furniture shop (Phase 1).

## Quick start

```bash
cd backend
cp .env.example .env
# Edit DATABASE_URL and JWT_SECRET

npm install
npx prisma migrate dev --name init
npm run seed
npm run dev
```

API: `http://localhost:5000`  
Health: `GET /health`

Default seeded admin: `admin` / `admin123` (change immediately).

## Environment

See `.env.example`. Useful defaults for local work:

| Variable | Local default | Notes |
|---|---|---|
| `OTP_PROVIDER` | `dev` | Logs OTP to the server console |
| `WHATSAPP_PROVIDER` | `stub` | Logs WhatsApp payload; no external call |
| `JWT_SECRET` | required | Use a long random string |

## API overview

### Public
- `GET /api/categories`
- `GET /api/categories/:slug/products` — paginated (`?page=&limit=`, default limit 12)
- `GET /api/products` — paginated (`?page=&limit=`, default limit 12)
- `GET /api/products/:slug`
- `GET /api/pages/:key` (`about`, `terms`, `contact`)
- `GET /api/blog` — paginated (`?page=&limit=`, default limit 12)
- `GET /api/blog/:slug`
- `GET /api/offers`
- `POST /api/enquiries` — `{ name, phone, message, productId? }`

Paginated list responses: `{ items, page, totalPages, totalCount }`.  
`GET /api/categories/:slug/products` also includes a `category` object (with `metaTitle` / `metaDescription`) alongside the pagination fields.

### Customer auth (OTP)
- `POST /api/auth/send-otp` — `{ phone }`
- `POST /api/auth/verify-otp` — `{ phone, otp }` → JWT

### Admin auth
- `POST /api/admin/login` — `{ username, password }`
- `POST /api/admin/login/verify-totp` — `{ tempToken, code }`
- `POST /api/admin/2fa/setup` (JWT)
- `POST /api/admin/2fa/enable` — `{ code }` (JWT)
- `POST /api/admin/2fa/disable` — `{ password }` (JWT)

### Admin resources (Bearer admin JWT)
- Enquiries: `GET/PATCH /api/admin/enquiries`
- Products / Categories / Blog / Offers: `POST/PATCH/DELETE` under `/api/admin/...`
- Pages: `PATCH /api/admin/pages/:key`

## Enquiry flow

1. `POST /api/enquiries` creates/updates a `User` by phone, saves the enquiry, and attempts WhatsApp notify.
2. Response includes `requiresPhoneVerification` when the user is not yet verified.
3. Frontend calls send/verify OTP; on success `User.isVerified = true` and a user JWT is issued.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Nodemon development server |
| `npm start` | Production server |
| `npm run prisma:migrate` | Create/apply migrations |
| `npm run seed` | Seed admin + static pages |
| `npm run prisma:studio` | Prisma Studio UI |
