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
| Auth (admin) | JWT + username/password + optional TOTP (`otplib` + `qrcode` npm packages) | Username/password login, with Google Authenticator-based 2FA as a second factor |
| File storage | Cloudinary or Firebase Storage | Product images, blog images, offer banners |
| Cloudinary SDK | `cloudinary` npm package | Server-side signature generation only — see section 5b; the SDK never handles the actual file upload |
| Spreadsheet parsing | `xlsx` (SheetJS) npm package | Parses uploaded .xlsx files for bulk product/category import |
| WhatsApp | `wa.me` click-to-chat link (no API/business verification needed) | Enquiry opens WhatsApp with a prefilled message; customer taps send themselves — zero cost, zero approval wait |
| Hosting | Render / Railway / a VPS | Any Node-friendly host |

---

## 2. Folder Structure

```
backend/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── config/
│   │   └── db.js
│   ├── middleware/
│   │   ├── adminAuth.js      # verifies JWT for admin routes
│   │   └── errorHandler.js
│   ├── modules/
│   │   ├── products/
│   │   ├── categories/
│   │   ├── enquiries/
│   │   ├── blog/
│   │   ├── offers/
│   │   ├── bulk-import/
│   │   ├── pages/            # about, terms & conditions (CMS content)
│   │   └── admin/
│   ├── utils/
│   │   ├── totp.js           # generates/verifies Google Authenticator codes
│   │   └── whatsappLink.js   # builds the wa.me click-to-chat URL for an enquiry
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
  createdAt   DateTime   @default(now())
  enquiries   Enquiry[]
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
  description     String     // stores HTML from the rich text editor (bold/italic/color/lists/tables) —
                               // see backend spec note on sanitization before rendering on the public site
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
GET    /api/products               # accepts ?search= (matches product name/description) and
                                     # ?category= (subcategory slug) for the homepage search + filter feature,
                                     # plus existing ?page=/?limit= pagination
GET    /api/products/:slug

GET    /api/pages/:key            # about, terms, contact content
GET    /api/blog
GET    /api/blog/:slug

GET    /api/offers                # active offers only (isActive + within startsAt/endsAt window)

POST   /api/enquiries              # creates/updates User by phone (no verification step), creates Enquiry,
                                     # and returns a ready-to-use wa.me click-to-chat link
                                     # body: { name, phone, message, productId } -> response: { enquiry, whatsappLink }
```

All product/category/blog GET responses include `metaTitle` and `metaDescription` so the Next.js frontend can populate `<head>` tags without a second request.

**Pagination:** `/api/products`, `/api/categories/:slug/products`, and `/api/blog` accept optional `?page=` and `?limit=` query params (default `limit=12`), returning `{ items, page, totalPages, totalCount }`. This supports the frontend's "Load More" button pattern — no new feature, just pagination on endpoints that already existed in this spec.

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
GET    /api/admin/enquiries        # accepts ?search= (matches name/phone/product name) and ?status=
PATCH  /api/admin/enquiries/:id    # update status

POST   /api/admin/upload/signature # generates a Cloudinary signed-upload signature (see section 5b) —
                                     # NOT a file upload endpoint itself; the actual file goes straight
                                     # from the browser to Cloudinary, never through this backend

GET    /api/admin/products         # returns ALL products regardless of isActive (unlike the public
                                     # GET /api/products, which only shows active ones) — accepts
                                     # ?search= (name/description) and ?categoryId= to filter
POST   /api/admin/products         # body must include categoryId set to a SUBCATEGORY's id (never a
                                     # top-level category's id) — reject with a clear error if the
                                     # given categoryId belongs to a category that has children
                                     # (i.e. it's a main category, not a leaf)
PATCH  /api/admin/products/:id
DELETE /api/admin/products/:id

GET    /api/admin/categories       # returns the full category tree regardless of any active/inactive
                                     # concept — accepts ?search= (matches name at either level)
POST   /api/admin/categories       # body accepts parentId (nullable) — omit or send null for a
                                     # top-level category, or a valid top-level category's id to
                                     # create a subcategory under it
PATCH  /api/admin/categories/:id
DELETE /api/admin/categories/:id   # should reject with a clear error if the category still has
                                     # products or child subcategories attached, rather than
                                     # silently orphaning them — reassign or remove those first

GET    /api/admin/blog             # returns ALL posts including unpublished drafts (unlike the public
                                     # GET /api/blog, which only shows published ones) — accepts
                                     # ?search= (title) and ?published= filter
POST   /api/admin/blog
PATCH  /api/admin/blog/:id
DELETE /api/admin/blog/:id

GET    /api/admin/offers           # returns ALL offers regardless of active date window (unlike the
                                     # public GET /api/offers) — accepts ?search= (title) and ?isActive=
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

## 5. Enquiry → WhatsApp Flow (Phase 1 core logic)

No OTP verification service is used in Phase 1 — enquiries are captured directly, and WhatsApp is handled via a free `wa.me` click-to-chat link rather than the paid/approval-gated Business API.

1. **User submits enquiry form** on a product page (`POST /api/enquiries`, body: `{ name, phone, message, productId }`).
2. Backend:
   - Finds or creates a `User` record by phone number (no verification step — the record is created directly from the submitted name/phone).
   - Creates the `Enquiry` record linked to that user and product.
   - Builds a `wa.me` link via `whatsappLink.js`: `https://wa.me/<WHATSAPP_ADMIN_NUMBER>?text=<url-encoded message>`, where the message includes the customer's name, phone, product name, and their enquiry text — so the admin sees full context the moment they open WhatsApp.
3. **Response to frontend**: `{ enquiry, whatsappLink }`.
4. Frontend immediately opens `whatsappLink` (e.g. `window.open(whatsappLink, '_blank')`) — this opens WhatsApp (web or app) with the message pre-filled in a chat with the admin's number. The **customer taps send themselves** — this is the one manual step required by the free, zero-approval approach, versus a paid Business API that could send it fully automatically.
5. The enquiry is already saved and visible in the admin's `/admin/enquiries` inbox regardless of whether the customer actually taps send on WhatsApp — the backend doesn't depend on that step succeeding.

**Why click-to-chat instead of the Business API:** the Meta/Twilio WhatsApp Business APIs require business verification and pre-approved message templates before they can message a new number — real cost and 1-2 weeks of lead time. `wa.me` links work instantly, for free, with no approval process, at the cost of requiring the customer to tap "send" themselves. If the client wants fully automated server-side sending later, that's a Phase 2+ upgrade path, not something this spec assumes.

---

## 5a. Admin Login with Google Authenticator (2FA) Flow

1. **First-time setup:** admin logs in with username/password, then calls `POST /api/admin/2fa/setup`. Backend generates a TOTP secret (via `otplib`), stores it unconfirmed, and returns a QR code (via `qrcode`) for the admin to scan in the Google Authenticator app.
2. Admin enters the 6-digit code Google Authenticator shows → `POST /api/admin/2fa/enable` confirms it and flips `totpEnabled = true`.
3. **Every login after that:** `POST /api/admin/login` checks username/password first. If `totpEnabled` is true, it does *not* return a JWT yet — it returns a short-lived `tempToken` and a flag telling the frontend to show a "enter your 6-digit code" screen.
4. Admin enters the current code from Google Authenticator → `POST /api/admin/login/verify-totp` checks it against the stored secret and, if valid, returns the real JWT.
5. 2FA can be turned off from admin settings (`POST /api/admin/2fa/disable`) by re-entering the password — useful if the admin loses their device, though for a production client you'd typically want a manual recovery process too.

This gives you exactly what was asked for: username + password as the first factor, Google Authenticator as an optional second factor, without forcing 2FA on day one if the client just wants to launch quickly.

---

## 5a2. Rich Text Product Descriptions (Bold, Italic, Color, Lists, Tables)

Product descriptions support formatting (bold, italic, text color, bullet/numbered lists, tables) — same rich text editor already used for blog posts (Tiptap), reused here rather than building a separate one.

- `Product.description` stores the editor's **HTML output** directly, same as `BlogPost.content` already does
- **Sanitize on the way out, not just the way in:** since this HTML renders directly on public product pages, run it through a sanitizer (e.g. `sanitize-html` or `DOMPurify` server-side, or `rehype-sanitize` if rendering via a markdown/HTML pipeline) before it's ever sent to the public site — restrict to the tags Tiptap actually produces (`b`/`strong`, `i`/`em`, `span` with color styles, `ul`/`ol`/`li`, `table`/`tr`/`td`/`th`) and strip anything else. This matters because the admin panel is the only thing writing this field, but sanitizing on output is still the safer habit — it protects against any future second admin account, a compromised login, or a bug in the editor itself producing unexpected markup
- No schema change beyond what's already there — `description` was always a `String`, it's just storing richer content now

---

## 5b. Image Upload Flow (Cloudinary Signed Upload)

This was previously described only narratively ("direct-to-Cloudinary signed upload") without an actual API contract — that's what caused PROD-06 and MISC-01 to fail in testing, since there was nothing concrete to implement against. Here's the exact contract:

**The file itself never touches this backend.** This backend's only job is to hand the frontend a short-lived, signed permission slip to upload directly to Cloudinary. This keeps large image uploads off your Render instance entirely.

1. **Frontend requests a signature** before uploading: `POST /api/admin/upload/signature` (admin JWT required), optional body `{ folder: "products" }` (or `"categories"`, `"offers"`, `"blog"`).
2. **Backend generates the signature** server-side using the Cloudinary API secret (via the `cloudinary` npm SDK's `utils.api_sign_request`), based on a timestamp and the target folder — the secret itself never leaves the backend. Response:
   ```json
   {
     "signature": "a1b2c3...",
     "timestamp": 1755000000,
     "apiKey": "your_cloudinary_api_key",
     "cloudName": "your_cloud_name",
     "folder": "products"
   }
   ```
3. **Frontend uploads directly to Cloudinary** using these values — a plain multipart `POST` from the browser to `https://api.cloudinary.com/v1_1/<cloudName>/image/upload`, with the file plus `signature`, `timestamp`, `api_key`, and `folder` as form fields. This request goes straight to Cloudinary's servers, not this backend.
4. **Cloudinary responds directly to the frontend** with the uploaded image's `secure_url`.
5. **Frontend saves that URL** as part of the normal product/category/offer create-or-update call (e.g. `POST /api/admin/products` with `images: ["https://res.cloudinary.com/.../image.jpg"]`) — same as if the URL had been typed in manually.

This is why `POST /api/admin/upload` returning a 404 in testing was expected once you know the real contract — that route was never meant to accept the file. The only backend route needed is the signature endpoint above.

---

## 5c. Bulk Product/Category Import (Excel Upload) Flow

This is the feature that lets you upload 10+ products at once instead of adding them one by one in the admin UI, using the `woodcastle-product-upload-template.xlsx` template.

**Confirmed file format** (sheet order matters — the importer reads by position):

1. **Categories** sheet: `Category Name`, `Slug`, `Parent Category Name`, `Image URL`, `Meta Title`, `Meta Description`
2. **Products** sheet: `Product Name`, `Category Name`, `Description`, `Image URL`, `Price`, `Is Active`, `Slug`, `Meta Title`, `Meta Description`
3. Any further sheets (e.g. an Instructions tab) — ignored by the parser as long as they come after Categories and Products

**Multiple product images:** the single `Image URL` column accepts multiple URLs separated by a pipe character (`|`), e.g. `https://.../img1.jpg|https://.../img2.jpg` — the first URL is treated as the primary listing image, the rest populate the gallery. Split on `|` and trim whitespace when parsing.

1. **Admin uploads the .xlsx file** via `POST /api/admin/import/preview` (multipart form upload).
2. Backend parses it with the `xlsx` (SheetJS) library, reading the **Categories** sheet first, then the **Products** sheet.
3. **Validation, per row — every column is required** (per the client's requirement, no optional fields in bulk import, unlike the single-item admin forms which still allow some fields to stay blank):
   - **Categories sheet:** `Category Name`, `Slug`, `Parent Category Name` (top-level categories use a fixed placeholder value like `"—"` or `"NONE"` here instead of leaving it blank, since the field itself is now required), `Image URL`, `Meta Title`, `Meta Description` — all must be filled
   - **Products sheet:** `Product Name`, `Category Name`, `Description`, `Image URL`, `Price`, `Is Active`, `Slug`, `Meta Title`, `Meta Description` — all must be filled
   - Every product's `Category Name` matches a **subcategory** either already in the database or present in this same sheet's Categories tab (case-insensitive match) — products are never assigned directly to a top-level category
   - Every subcategory row's `Parent Category Name` matches a top-level category, either already in the database or elsewhere in the same sheet
   - `Price` is numeric
   - `Is Active` parses to a boolean (`TRUE`/`FALSE`, case-insensitive)
   - Duplicate `slug` values within the sheet itself are flagged
   - A row with any blank required cell is rejected with a specific "X is required" error naming the exact column, same as the errors you saw in the preview screenshot earlier
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

# WhatsApp click-to-chat (no API keys needed — just the admin's number, digits only, with country code)
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
8. Image upload signature endpoint (`POST /api/admin/upload/signature`) — needed before the admin forms' image uploads can work at all; wire this up before building out the product/category/offer forms on the frontend
9. Bulk import (preview + confirm endpoints, using the xlsx template) — build once product/category CRUD is solid, since import reuses the same validation rules
10. Enquiry creation endpoint, including the `whatsappLink.js` builder (this is just string formatting, no external API — much simpler than the old OTP+WhatsApp-API flow, can be built and tested in one pass)
11. Connect admin panel (Next.js) to all admin endpoints

Building in this order means you have a working, testable backend at every step. Removing the OTP/WhatsApp-API dependency also removes what used to be the one external-approval bottleneck in this build — nothing in Phase 1 now depends on a third party approving anything.

---

## 8. What This Spec Deliberately Leaves Open

- Payment/billing (Phase 2)
- Furniture customisation / configurable product options (Phase 2)
- OTP/phone verification for enquiries — deliberately not used in Phase 1 per the client's decision; could be added later if fake/spam enquiries become a real problem
- True server-side WhatsApp auto-send (Business API) — deliberately not used in Phase 1; the `wa.me` click-to-chat link requires the customer to tap send themselves, which is the accepted trade-off for avoiding API cost and business verification
- Rate limiting / spam protection on the enquiry form (recommended even for Phase 1, and more relevant now that there's no OTP step filtering submissions — add `express-rate-limit` on `/api/enquiries`)
- Admin 2FA recovery process if a device is lost (needs a manual/support-based recovery path before real client handoff)
