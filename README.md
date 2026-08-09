# Woodcastle — Backend Specification (Phase 1)

This document specifies the backend for **Woodcastle**, a wood furniture shop's website, pairing with a Next.js frontend (public website) and a Next.js/React admin panel. It's written so you can hand it directly to an AI coding assistant (Claude Code, Cursor, etc.) to scaffold the backend, or follow it step by step yourself.

---

## 1. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Runtime | Node.js (v20 LTS) | Standard, huge ecosystem |
| Framework | Express.js | Simple, well-documented, easy for a first backend |
| Database | PostgreSQL | Relational data (products ↔ categories ↔ enquiries) fits well |
| ORM | Prisma | Auto-generates types, migrations, and a friendly query API |
| Auth (user) | JWT (access token) + OTP via Firebase Phone Auth or Twilio Verify | Simple stateless auth for users |
| Auth (admin) | JWT + username/password + optional TOTP (`otplib` + `qrcode` npm packages) | Username/password login, with Google Authenticator-based 2FA as a second factor |
| File storage | Cloudinary or Firebase Storage | Product images, blog images, offer banners |
| Spreadsheet parsing | `xlsx` (SheetJS) npm package | Parses uploaded .xlsx files for bulk product/category import |
| WhatsApp | Meta WhatsApp Cloud API (or Twilio WhatsApp API) | Server-side auto-send of enquiries |
| Hosting | Render / Railway / a VPS | Any Node-friendly host; avoid serverless for WhatsApp webhooks if using long-lived connections |

---

## 2. Folder Structure

```
backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── config/
│   │   ├── db.js
│   │   ├── firebase.js
│   │   └── whatsapp.js
│   ├── middleware/
│   │   ├── auth.js          # verifies JWT for user routes
│   │   ├── adminAuth.js      # verifies JWT for admin routes
│   │   └── errorHandler.js
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.js
│   │   │   ├── auth.service.js
│   │   │   └── auth.routes.js
│   │   ├── products/
│   │   ├── categories/
│   │   ├── enquiries/
│   │   ├── blog/
│   │   ├── offers/
│   │   ├── bulk-import/
│   │   ├── pages/            # about, terms & conditions (CMS content)
│   │   └── admin/
│   ├── utils/
│   │   ├── otp.js
│   │   ├── totp.js           # generates/verifies Google Authenticator codes
│   │   └── whatsappSender.js
│   ├── app.js
│   └── server.js
├── .env.example
└── package.json
```

---

## 3. Database Schema (Prisma)

```prisma
model User {
  id          String     @id @default(uuid())
  name        String
  phone       String     @unique
  email       String?
  isVerified  Boolean    @default(false)
  createdAt   DateTime   @default(now())
  enquiries   Enquiry[]
}

model OtpRequest {
  id          String     @id @default(uuid())
  phone       String
  otpHash     String
  expiresAt   DateTime
  verified    Boolean    @default(false)
  createdAt   DateTime   @default(now())
}

model Category {
  id              String     @id @default(uuid())
  name            String
  slug            String     @unique
  imageUrl        String?
  metaTitle       String?
  metaDescription String?
  parentId        String?
  parent          Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children        Category[] @relation("CategoryTree")
  products        Product[]
}

model Product {
  id              String     @id @default(uuid())
  name            String
  slug            String     @unique
  description     String
  price           Decimal?
  images          String[]
  categoryId      String
  category        Category   @relation(fields: [categoryId], references: [id])
  isActive        Boolean    @default(true)
  metaTitle       String?
  metaDescription String?
  createdAt       DateTime   @default(now())
  enquiries       Enquiry[]
}

model Offer {
  id            String     @id @default(uuid())
  title         String
  description   String?
  bannerImage   String?
  discountText  String?    // e.g. "Up to 30% off", freeform display text
  linkUrl       String?    // optional: link to a category/product/blog post
  isActive      Boolean    @default(true)
  startsAt      DateTime?
  endsAt        DateTime?
  createdAt     DateTime   @default(now())
}

model BulkImportLog {
  id            String     @id @default(uuid())
  fileName      String
  importedBy    String     // AdminUser id
  totalRows     Int
  successCount  Int
  errorCount    Int
  errorDetails  Json?      // array of { row, field, message }
  createdAt     DateTime   @default(now())
}

model Enquiry {
  id            String     @id @default(uuid())
  userId        String?
  user          User?      @relation(fields: [userId], references: [id])
  productId     String?
  product       Product?   @relation(fields: [productId], references: [id])
  name          String
  phone         String
  message       String
  status        String     @default("new")   // new, contacted, closed
  whatsappSent  Boolean    @default(false)
  createdAt     DateTime   @default(now())
}

model BlogPost {
  id              String     @id @default(uuid())
  title           String
  slug            String     @unique
  content         String
  coverImage      String?
  metaTitle       String?
  metaDescription String?
  published       Boolean    @default(false)
  publishedAt     DateTime?
  createdAt       DateTime   @default(now())
}

model StaticPage {
  id            String     @id @default(uuid())
  key           String     @unique   // "about", "terms", "contact"
  title         String
  content       String
  updatedAt     DateTime   @updatedAt
}

model AdminUser {
  id            String     @id @default(uuid())
  username      String     @unique
  email         String?    @unique
  passwordHash  String
  totpSecret    String?    // set once admin scans the QR code in Google Authenticator
  totpEnabled   Boolean    @default(false)
  role          String     @default("admin")
  createdAt     DateTime   @default(now())
}
```

---

## 4. API Endpoints

### Public (consumed by the Next.js website)

```
GET    /api/categories
GET    /api/categories/:slug/products
```
`GET /api/categories` returns a nested tree — top-level categories (`parentId: null`) each with a `children` array of their subcategories. Products are always assigned to a **subcategory** (the leaf level), not a top-level category, matching how Woodcastle's actual catalog (Sofa & Sofa Sets → 3 Seater Sofa, etc.) is structured.

```
GET    /api/products
GET    /api/products/:slug

GET    /api/pages/:key            # about, terms, contact content
GET    /api/blog
GET    /api/blog/:slug

GET    /api/offers                # active offers only (isActive + within startsAt/endsAt window)

POST   /api/enquiries              # creates enquiry + triggers WhatsApp send + creates/updates user
                                     # body: { name, phone, message, productId }
```

All product/category/blog GET responses include `metaTitle` and `metaDescription` so the Next.js frontend can populate `<head>` tags without a second request.

**Pagination:** `/api/products`, `/api/categories/:slug/products`, and `/api/blog` accept optional `?page=` and `?limit=` query params (default `limit=12`), returning `{ items, page, totalPages, totalCount }`. This supports the frontend's "Load More" button pattern — no new feature, just pagination on endpoints that already existed in this spec.

### Auth (OTP flow)

```
POST   /api/auth/send-otp          # body: { phone } -> sends OTP via SMS/WhatsApp
POST   /api/auth/verify-otp        # body: { phone, otp } -> marks User.isVerified = true, returns JWT
```

### Admin Auth (username/password + optional Google Authenticator 2FA)

```
POST   /api/admin/login              # body: { username, password } -> if totpEnabled=false, returns JWT directly
                                       # if totpEnabled=true, returns { requiresTotp: true, tempToken } instead
POST   /api/admin/login/verify-totp  # body: { tempToken, code } -> verifies 6-digit code, returns JWT

POST   /api/admin/2fa/setup          # (JWT-protected) generates a TOTP secret + QR code image for the admin to scan
POST   /api/admin/2fa/enable         # body: { code } -> confirms the first code from the app, sets totpEnabled = true
POST   /api/admin/2fa/disable        # body: { password } -> turns 2FA back off
```

### Admin (protected by adminAuth middleware, requires completed login above)

```
GET    /api/admin/enquiries
PATCH  /api/admin/enquiries/:id    # update status

POST   /api/admin/products
PATCH  /api/admin/products/:id
DELETE /api/admin/products/:id

POST   /api/admin/categories
PATCH  /api/admin/categories/:id
DELETE /api/admin/categories/:id

POST   /api/admin/blog
PATCH  /api/admin/blog/:id
DELETE /api/admin/blog/:id

POST   /api/admin/offers
PATCH  /api/admin/offers/:id
DELETE /api/admin/offers/:id

POST   /api/admin/import/preview   # multipart file upload (.xlsx) -> parses file, validates rows,
                                     # returns { categories: [...], products: [...], errors: [...] }
                                     # WITHOUT writing to the database yet
POST   /api/admin/import/confirm    # body: { importId } -> commits the previously-previewed rows
                                     # (creates new categories/products, updates existing ones matched by slug)
GET    /api/admin/import/history    # list of past BulkImportLog entries

PATCH  /api/admin/pages/:key       # edit about/terms/contact content
```

---

## 5. Enquiry → WhatsApp → Registration Flow (Phase 1 core logic)

This is the flow that ties registration, OTP, and WhatsApp together:

1. **User submits enquiry form** on a product page (`POST /api/enquiries`).
2. Backend:
   - Finds or creates a `User` record by phone number (`isVerified: false` if new).
   - Creates the `Enquiry` record linked to that user and product.
   - Calls `whatsappSender.js` to push the enquiry to WhatsApp (both to the admin's business number and, if using templates, a confirmation to the customer).
   - Marks `Enquiry.whatsappSent = true` on success.
3. **Response to frontend** includes a flag saying "verify your phone to complete registration."
4. Frontend prompts for OTP → `POST /api/auth/send-otp`.
5. User enters OTP → `POST /api/auth/verify-otp` → backend checks `OtpRequest`, marks `User.isVerified = true`, issues JWT.
6. Enquiry is now tied to a verified, registered user.

**Note on WhatsApp automation:** true server-side auto-send (no user tap required) needs the Meta WhatsApp Cloud API or Twilio WhatsApp API, both of which require business verification and pre-approved message templates for the first outbound message to a new number. Budget 1-2 weeks lead time for approval before backend work depends on it. A `wa.me` click-to-chat link is a zero-approval fallback but requires the user to tap "send" themselves.

---

## 5a. Admin Login with Google Authenticator (2FA) Flow

1. **First-time setup:** admin logs in with username/password, then calls `POST /api/admin/2fa/setup`. Backend generates a TOTP secret (via `otplib`), stores it unconfirmed, and returns a QR code (via `qrcode`) for the admin to scan in the Google Authenticator app.
2. Admin enters the 6-digit code Google Authenticator shows → `POST /api/admin/2fa/enable` confirms it and flips `totpEnabled = true`.
3. **Every login after that:** `POST /api/admin/login` checks username/password first. If `totpEnabled` is true, it does *not* return a JWT yet — it returns a short-lived `tempToken` and a flag telling the frontend to show a "enter your 6-digit code" screen.
4. Admin enters the current code from Google Authenticator → `POST /api/admin/login/verify-totp` checks it against the stored secret and, if valid, returns the real JWT.
5. 2FA can be turned off from admin settings (`POST /api/admin/2fa/disable`) by re-entering the password — useful if the admin loses their device, though for a production client you'd typically want a manual recovery process too.

This gives you exactly what was asked for: username + password as the first factor, Google Authenticator as an optional second factor, without forcing 2FA on day one if the client just wants to launch quickly.

---

## 5b. Bulk Product/Category Import (Excel Upload) Flow

This is the feature that lets you upload 10+ products at once instead of adding them one by one in the admin UI, using the `woodcastle-product-upload-template.xlsx` template.

**Confirmed file format** (sheet order matters — the importer reads by position):

1. **Categories** sheet: `Category Name`, `Slug`, `Parent Category Name`, `Image URL`, `Meta Title`, `Meta Description`
2. **Products** sheet: `Product Name`, `Category Name`, `Description`, `Image URL`, `Price`, `Is Active`, `Slug`, `Meta Title`, `Meta Description`
3. Any further sheets (e.g. an Instructions tab) — ignored by the parser as long as they come after Categories and Products

**Multiple product images:** the single `Image URL` column accepts multiple URLs separated by a pipe character (`|`), e.g. `https://.../img1.jpg|https://.../img2.jpg` — the first URL is treated as the primary listing image, the rest populate the gallery. Split on `|` and trim whitespace when parsing.

1. **Admin uploads the .xlsx file** via `POST /api/admin/import/preview` (multipart form upload).
2. Backend parses it with the `xlsx` (SheetJS) library, reading the **Categories** sheet first, then the **Products** sheet.
3. **Validation, per row:**
   - Required fields present (Category Name; for products: Product Name, Category Name, Description, Image URL)
   - Every product's `Category Name` matches a **subcategory** either already in the database or present in this same sheet's Categories tab (case-insensitive match) — products are never assigned directly to a top-level category
   - Every subcategory row's `Parent Category Name` (if filled) matches a top-level category, either already in the database or elsewhere in the same sheet
   - `Price` is numeric if provided
   - `Is Active` parses to a boolean (defaults to `true` if blank)
   - Duplicate `slug` values within the sheet itself are flagged
4. Backend returns a **preview** (not yet saved): counts of rows to be created vs. updated (matched by slug against existing records), plus a list of row-level errors with row number, field, and message — this is what the admin panel shows before anything goes live.
5. Admin reviews the preview in the UI, fixes the sheet and re-uploads if there are errors, or clicks "Confirm Import."
6. `POST /api/admin/import/confirm` commits the rows: creates new categories/products, or **updates existing ones** if the slug already matches a record in the database (so re-uploading a corrected sheet is safe — it won't create duplicates).
7. A `BulkImportLog` record is saved for every import, so there's an audit trail of what was uploaded and when, and any admin can check `GET /api/admin/import/history` to see past imports and their error counts.

**Note on Google Sheets vs. .xlsx:** this spec assumes the admin uploads a `.xlsx` file (exported from Excel or from Google Sheets via File → Download). Direct live-sync from a Google Sheet URL (via the Google Sheets API) is a heavier integration — OAuth setup, service account permissions — and isn't included in Phase 1. If that's genuinely wanted over a manual upload-and-confirm flow, it's worth scoping as a separate small addition rather than assuming it's included here.

---

## 6. Environment Variables (.env.example)

```
DATABASE_URL=postgresql://user:password@localhost:5432/woodcastle_db
JWT_SECRET=
JWT_EXPIRES_IN=7d

# OTP provider (pick one)
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
# or
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=

# WhatsApp
WHATSAPP_PROVIDER=meta            # or "twilio"
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_ADMIN_NUMBER=

# Media storage
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

PORT=5000
```

---

## 7. Build Order (recommended sequence)

1. Set up Express app skeleton + Prisma + PostgreSQL connection
2. Admin auth: username/password login + JWT-protected routes (build this early — everything else in the admin panel needs it)
3. Categories + Products CRUD (admin) and read endpoints (public), including `metaTitle`/`metaDescription` fields
4. Static pages (About/Terms/Contact) CRUD + read endpoints
5. Blog CRUD + read endpoints
6. Offers CRUD + public read endpoint
7. Admin 2FA (TOTP setup/enable/disable/verify) — add once basic admin login works
8. Bulk import (preview + confirm endpoints, using the xlsx template) — build once product/category CRUD is solid, since import reuses the same validation rules
9. Enquiry creation endpoint (without WhatsApp yet — just save to DB)
10. OTP send/verify flow for customers (get this working standalone)
11. Wire enquiry creation to trigger OTP flow + create/link User
12. WhatsApp integration (start with Meta Cloud API sandbox/test number)
13. Connect admin panel (Next.js) to all admin endpoints

Building in this order means you have a working, testable backend at every step, and WhatsApp — the piece with external approval dependencies — doesn't block everything else.

---

## 8. What This Spec Deliberately Leaves Open

- Payment/billing (Phase 2)
- Furniture customisation / configurable product options (Phase 2)
- Rate limiting / spam protection on the enquiry form (recommended even for Phase 1 — add `express-rate-limit` on `/api/enquiries` and `/api/auth/send-otp`)
- Admin 2FA recovery process if a device is lost (needs a manual/support-based recovery path before real client handoff)
