# Woodcastle — Backend Test Cases

How to use this: work through each row, fill in **Actual Result** and **Pass/Fail**, and send the completed file back. Test either directly against the API (Postman/curl) or by using the admin panel and checking the database/API response matches what's expected — either way, note which method you used per section if it varies.

**Base URL:** `http://localhost:5001` (local API; method: curl/fetch against the running Express server)

**Tested:** 13 Aug 2026. Admin login `admin` / `admin123`. QA data created then cleaned up. 2FA was enabled for AUTH-03–06 then disabled again (AUTH-07). UI-only cases marked N/A because this repo has no admin panel or public Next.js site.

---

## 1. Category Management

Method: API (`POST`/`PATCH`/`DELETE` `/api/admin/categories`, `GET` `/api/categories`). CAT-03 and CAT-04 need the admin UI.

| ID | Test | Steps | Expected Result | Actual Result | Pass/Fail |
|---|---|---|---|---|---|
| CAT-01 | Create a top-level category | `POST /api/admin/categories` with `{ name: "Test Category", parentId: null }` | 201 response, category created with `parentId: null` | 201. Created id `c8e26284-56ca-4069-b107-587b80d0b0a6`, `parentId: null` | Pass |
| CAT-02 | Create a subcategory under an existing top-level category | `POST /api/admin/categories` with `{ name: "Test Sub", parentId: "<id of a real top-level category>" }` | 201 response, category created with the given `parentId` | 201. Created id `81648ba2-5de5-4203-906a-81ff92c6b0f0` with `parentId` matching CAT-01 | Pass |
| CAT-03 | Create a subcategory via the admin panel UI (not raw API) | In `/admin/categories`, click Create, fill name, select a Parent Category from the dropdown, save | New subcategory appears in the list under the correct parent | Skipped — no admin panel in this backend repo. Same create-with-parentId path passed in CAT-02 | N/A |
| CAT-04 | Parent dropdown shows only top-level categories | Open the category create form, inspect the Parent Category dropdown options | Only main categories (no subcategories) appear as options, plus a "None" option | Skipped — UI not available. `GET /api/admin/categories` returned 12 top-level and 54 subcategories (each has `parentId`), which a frontend can filter | N/A |
| CAT-05 | Edit a category's name | `PATCH /api/admin/categories/:id` with a new `name` | 200 response, name updated | 200. Name updated to `QA qamsqlfjje Test Category Renamed` | Pass |
| CAT-06 | Edit a category's parent (move a subcategory to a different parent) | `PATCH /api/admin/categories/:id` with a different `parentId` | 200 response, category now appears under the new parent | 200. Subcategory `parentId` moved to `4cc29228-02bd-4f76-8c3d-92c71613e5e7` (`QA qamsqlfjje Other Parent`) | Pass |
| CAT-07 | Delete a category with no products/subcategories attached | `DELETE /api/admin/categories/:id` on an empty test category | 200/204 response, category removed | 200 `{ message: "Category deleted" }`. Category no longer in admin list | Pass |
| CAT-08 | Delete a category that still has subcategories | `DELETE /api/admin/categories/:id` on a main category with children | Request is rejected with a clear error message, category NOT deleted | 400 `Cannot delete category while it still has subcategories — reassign or remove those first`. Category still exists | Pass |
| CAT-09 | Delete a category that still has products attached | `DELETE /api/admin/categories/:id` on a subcategory with products | Request is rejected with a clear error message, category NOT deleted | 400 `Cannot delete category while it still has products — reassign or remove those first`. Category still exists | Pass |
| CAT-10 | Fetch full category tree | `GET /api/categories` | Response is a nested tree — each top-level category includes a `children` array of its subcategories | 200. Array of 13 top-level categories, each with a `children` array; QA parent included its moved subcategory | Pass |
| CAT-11 | Fetch products by subcategory | `GET /api/categories/:slug/products` using a subcategory's slug | Returns only products assigned to that exact subcategory | 200. 1 item, the product created in PROD-01; ids matched only that subcategory | Pass |

---

## 2. Product Management

Method: API. PROD-03, PROD-04, PROD-07 need admin/public UI. PROD-06 is the Cloudinary signature endpoint (section 5b). PROD-10–13 cover duplicate product name detection (section 5a3).

| ID | Test | Steps | Expected Result | Actual Result | Pass/Fail |
|---|---|---|---|---|---|
| PROD-01 | Create a product assigned to a subcategory | `POST /api/admin/products` with `categoryId` set to a real **subcategory** id | 201 response, product created and linked correctly | 201. Product id `601173f8-415e-4aea-a7ff-4cb5d68fb4a8` linked to subcategory `QA qamsqlfjje Test Sub` | Pass |
| PROD-02 | Attempt to create a product assigned to a top-level (main) category | `POST /api/admin/products` with `categoryId` set to a **main category's** id (one that has children) | Request is rejected with a clear error — products must attach to a subcategory, not a main category | 400 `Products must be assigned to a subcategory (leaf level), not a top-level category` | Pass |
| PROD-03 | Assign a category to a product via the admin panel UI | In the product create/edit form, open the category dropdown | Dropdown shows subcategories only, grouped/labeled by their main category (e.g. under a "Chairs" heading: Dining Chair, Arm Chair, etc.) | Skipped — product form UI not in this repo. Admin category list includes `parent` and `children` for grouping | N/A |
| PROD-04 | Select a subcategory in the product form and save | Pick any subcategory, fill required fields, save | Product saves successfully with the selected subcategory attached; reopening the product for edit shows the same subcategory still selected | Skipped — admin form UI not in this repo. API create with subcategory passed in PROD-01 | N/A |
| PROD-05 | Edit an existing product's category | Change the category dropdown to a different subcategory, save | Product's `categoryId` updates to the new subcategory | 200 via `PATCH /api/admin/products/:id`. `categoryId` updated to `9f48ecee-6fd0-4525-96f8-3ab38ca0e475` | Pass |
| PROD-06 | Request a Cloudinary signed-upload signature for a product image | `POST /api/admin/upload/signature` with admin JWT and optional `{ folder: "products" }`. Confirm `POST /api/admin/upload` is not a file-upload route | 200 with `{ signature, timestamp, apiKey, cloudName, folder }`. The file never hits this backend — `POST /api/admin/upload` stays 404 by design. Frontend uploads to Cloudinary, then saves the `secure_url` on `POST/PATCH /api/admin/products` | 200. Body includes `signature`, `timestamp`, `apiKey`, `cloudName: "upuirzdo"`, `folder: "products"`. `POST /api/admin/upload` → 404 `Route not found`. Drag-and-drop UI is frontend-only (N/A in this repo) | Pass |
| PROD-07 | Confirm the uploaded image displays on the live site | After PROD-06, view the product on the public `/product/[slug]` page | Image loads correctly, no broken image icon | Skipped — no public Next.js site in this repo; blocked by PROD-06. Product API does return `images[]` | N/A |
| PROD-08 | Delete a product | `DELETE /api/admin/products/:id`, or use the Delete button in `/admin/products` | Confirmation prompt appears; after confirming, product is removed from the list and no longer appears on the public site | 200 via API (no confirm prompt — that is UI). Product gone from admin list; `GET /api/products/:slug` → 404 | Pass |
| PROD-09 | Product list/detail includes SEO fields | `GET /api/products/:slug` | Response includes `metaTitle` and `metaDescription` | 200. Response includes `metaTitle` and `metaDescription` (plus id, name, slug, description, price, images, categoryId, createdAt, category) | Pass |
| PROD-10 | Duplicate name check — unique name | `GET /api/admin/products/check-duplicate-name?name=Unique Chair&categoryId=<subcategory id>` | `{ isDuplicate: false }` — no suggested code/name/slug fields | | |
| PROD-11 | Duplicate name check — same name in same subcategory | With an existing product named "Dining Chair" in that subcategory, call `GET /api/admin/products/check-duplicate-name?name=Dining Chair&categoryId=<that subcategory id>` | `{ isDuplicate: true, existingCount: 1, suggestedCode: "<subcategory initials>-02", suggestedName: "Dining Chair <code>", suggestedSlug }` | | |
| PROD-12 | Duplicate name check — same name in a different subcategory | Same name as PROD-11, but `categoryId` is a different subcategory with no product of that name | `{ isDuplicate: false }` | | |
| PROD-13 | Save-time slug collision is rejected | `POST /api/admin/products` with a name/slug that already exists in the catalog | 409 with a clear error that the slug already exists; no new product created | | |

---

## 3. Bulk Import (Excel Upload)

Method: API `POST /api/admin/import/preview` (generated `.xlsx`) then `POST /api/admin/import/confirm`. Sheets used unique `QA qamsqlfjje …` names so existing catalog was not overwritten.

| ID | Test | Steps | Expected Result | Actual Result | Pass/Fail |
|---|---|---|---|---|---|
| IMP-01 | Upload the template with a main category that has exactly 4 subcategories | Use a category with 4 subcategory rows (e.g. Office Furniture) | All 4 subcategories are created | Preview 200, 4 subcategory creates. Confirm 200 (`successCount` 5 = 1 parent + 4 subs). Admin list showed all 4 subs | Pass |
| IMP-02 | Upload the template with a main category that has 5+ subcategories | Use a category with 5+ subcategory rows (e.g. Bedroom Furniture, 5 subs, or Tables, 7 subs) | **All** subcategories are created — this is the bug to confirm fixed; note exactly how many actually get created | 5 of 5 subcategories created (plus 1 parent). Confirm 200. Bug does **not** reproduce — 5+ rows are not dropped | Pass |
| IMP-03 | Upload the template with a main category that has 6+ subcategories | Use Storage Furniture (6 subs) or Chairs (6 subs) | All subcategories created, none silently dropped | 6 of 6 subcategories created (plus 1 parent). Confirm 200. None dropped | Pass |
| IMP-04 | Preview shows correct create/update counts before confirming | Upload file, check the preview screen | Counts match the actual number of new/changed rows in the sheet | Preview summary: `categoriesToCreate: 7`, `categoriesToUpdate: 0`, `productsToCreate: 0`, `errorCount: 0` — matches 1 parent + 6 subs in the sheet | Pass |
| IMP-05 | Confirm import actually commits all previewed rows | After IMP-02/03, click Confirm Import, then check `/admin/categories` | Every subcategory from the sheet appears in the category list — count matches the sheet exactly | `GET /api/admin/categories`: bedroom 5/5, storage 6/6 | Pass |
| IMP-06 | Re-upload the same file a second time | Upload an already-imported sheet again | Rows are treated as **updates** (matched by slug), not duplicated — category/product count doesn't double | Preview: 0 creates, 7 updates. Confirm 200. Category count stayed 86; product count stayed 2 | Pass |
| IMP-07 | Row with a missing required field is rejected | Remove a value from a required column (e.g. blank Description) and upload | Preview shows a specific error naming the row and field, and that row is not imported | Preview error: row 2, sheet Products, field Description, `Description is required`. Confirm rejected 400. Product not created | Pass |
| IMP-08 | Product row references a non-existent subcategory | Set a product's Category Name to something not in the Categories tab or database | Preview shows an error for that row, product not created | Preview error: row 2, Category Name, `Subcategory "Does Not Exist Subcategory XYZ" not found in database or Categories sheet`. Confirm 400. Product not created | Pass |
| IMP-09 | Product with multiple images (pipe-separated) imports correctly | Use an Image URL value like `url1\|url2` | Product is created with multiple images, first one set as primary | Confirm 200. Saved `images` array has 2 URLs; first URL is the primary listing image | Pass |

---

## 4. Admin Authentication

Method: API. TOTP codes generated with `otplib` from the setup secret (same algorithm as Google Authenticator). 2FA was turned off again after AUTH-07.

| ID | Test | Steps | Expected Result | Actual Result | Pass/Fail |
|---|---|---|---|---|---|
| AUTH-01 | Log in with correct username/password, no 2FA enabled | `POST /api/admin/login` | Returns a JWT directly | 200. `{ requiresTotp: false, token, admin }` — JWT returned | Pass |
| AUTH-02 | Log in with wrong password | `POST /api/admin/login` with incorrect password | 401 error, no token returned | 401 `{ error: "Invalid credentials" }`, no token | Pass |
| AUTH-03 | Set up 2FA | `POST /api/admin/2fa/setup` while logged in | Returns a QR code / TOTP secret | 200. Body includes `secret`, `otpauthUrl`, and `qrCodeDataUrl` | Pass |
| AUTH-04 | Enable 2FA with a valid code | Scan QR in Google Authenticator, submit the 6-digit code via `POST /api/admin/2fa/enable` | 2FA is enabled for the account | 200 `{ totpEnabled: true, message: "2FA enabled" }` (code from the returned secret) | Pass |
| AUTH-05 | Log in after 2FA is enabled | `POST /api/admin/login` with correct username/password | Returns `{ requiresTotp: true, tempToken }`, NOT a full JWT yet | 200. `requiresTotp: true`, `tempToken` present, no JWT `token` | Pass |
| AUTH-06 | Complete login with TOTP code | `POST /api/admin/login/verify-totp` with the tempToken and current 6-digit code | Returns a full JWT | 200. Body includes `token` and `admin` | Pass |
| AUTH-07 | Disable 2FA | `POST /api/admin/2fa/disable` with password | 2FA turned off; next login skips the TOTP step | 200 `{ totpEnabled: false }`. Next login returned a JWT with `requiresTotp: false` | Pass |
| AUTH-08 | Access an admin-only endpoint without a token | e.g. `GET /api/admin/enquiries` with no Authorization header | 401 error | 401 `{ error: "Missing or invalid authorization header" }` | Pass |

---

## 5. Enquiries (No OTP, WhatsApp Link)

Method: API.

| ID | Test | Steps | Expected Result | Actual Result | Pass/Fail |
|---|---|---|---|---|---|
| ENQ-01 | Submit an enquiry | `POST /api/enquiries` with `{ name, phone, message, productId }` | 201 response, **no OTP step required**, response includes `{ enquiry, whatsappLink }` | 201. Body keys: `enquiry`, `whatsappLink`. No OTP | Pass |
| ENQ-02 | Check the generated WhatsApp link | Inspect the `whatsappLink` value in the ENQ-01 response | Starts with `https://wa.me/<admin number>?text=`, and the decoded text includes the customer's name, phone, product, and message | Link `https://wa.me/917902566908?text=…`. Decoded text includes name, phone `919876543210`, product name, and message | Pass |
| ENQ-03 | Enquiry appears in the admin inbox immediately | After ENQ-01, check `GET /api/admin/enquiries` | The new enquiry is listed with status "new," regardless of whether anyone clicked the WhatsApp link | 200. New enquiry listed with `status: "new"` | Pass |
| ENQ-04 | Update enquiry status | `PATCH /api/admin/enquiries/:id` with `{ status: "contacted" }` | Status updates and reflects in the admin inbox | 200. Patch and subsequent inbox list both show `contacted` | Pass |

---

## 6. Offers, Blog, Static Pages (quick pass)

Method: API. MISC-01 is the Cloudinary signature endpoint with `folder: "offers"` (section 5b). MISC-03 public `/blog` pages are frontend; verified via public blog API.

| ID | Test | Steps | Expected Result | Actual Result | Pass/Fail |
|---|---|---|---|---|---|
| MISC-01 | Request a Cloudinary signed-upload signature for an offer banner | `POST /api/admin/upload/signature` with `{ folder: "offers" }`, then save the Cloudinary `secure_url` as `bannerImage` on `POST /api/admin/offers` | 200 with `folder: "offers"` plus `signature`, `timestamp`, `apiKey`, `cloudName`. No `POST /api/admin/offers/upload` file route — same signed-upload contract as products | 200. `folder: "offers"` with signature fields present. Invalid folder `invoices` → 400 `Invalid folder. Allowed values: products, categories, offers, blog` | Pass |
| MISC-02 | Offer respects active date window | Create an offer with a future `startsAt` | Offer does NOT appear in `GET /api/offers` until that date | 201 created with `startsAt` 2026-08-19. `GET /api/offers` did not include it | Pass |
| MISC-03 | Create and publish a blog post | Use the admin blog editor, publish | Post appears at `/blog` and `/blog/[slug]` on the public site | 201 via `POST /api/admin/blog` with `published: true`. Appears in `GET /api/blog` and `GET /api/blog/:slug` (200). Public Next.js routes not in this repo | Pass |
| MISC-04 | Edit static page content (About/Terms/Contact) | `PATCH /api/admin/pages/:key` | Public page reflects the updated content | 200. `GET /api/pages/about` returned the patched content. Original About content was restored after the test | Pass |

---

## Summary (fill in after testing)

- Total tests run: `40` (plus 5 UI-only N/A)
- Passed: `40`
- Failed: `0`
- N/A (admin/public UI not in this repo): `5` — CAT-03, CAT-04, PROD-03, PROD-04, PROD-07
- Critical failures (block launch): none. PROD-06 and MISC-01 now pass against `POST /api/admin/upload/signature` (Cloudinary signed upload). The file never goes through this backend; `POST /api/admin/upload` 404 is expected. Catalog, import (including 5+/6+ subcategories), auth/2FA, enquiries, offers date window, blog, and pages all passed.
