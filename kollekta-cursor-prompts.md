# Kollekta — Πλήρης οδηγός χτισίματος με Cursor

Ενιαίο, τελικό αρχείο. Αντικαθιστά όλες τις προηγούμενες εκδόσεις.

Κάθε prompt δίνεται σε **ξεχωριστό μήνυμα** στο Cursor (Composer, Agent mode), με τη σειρά. Μην τα δίνεις όλα μαζί.

Τα prompts είναι στα αγγλικά επίτηδες — το Cursor δουλεύει σημαντικά καλύτερα έτσι.

---

## Τι χτίζουμε

Εργαλείο παράδοσης φωτογραφιών συλλογής σε πελάτες χονδρικής.

Η επιχείρηση ανεβάζει τις φωτογραφίες μιας νέας συλλογής μία φορά. Οι πελάτες μπαίνουν από το κινητό τους με **τηλέφωνο + μόνιμο κωδικό**, βλέπουν όλες τις δημοσιευμένες συλλογές, και κατεβάζουν σε πλήρη ανάλυση. Προαιρετικά, αν ανέβουν παραγγελίες, κάθε πελάτης βλέπει μόνο τα προϊόντα που παρήγγειλε.

**Βασικές αρχές του μοντέλου**

| Θέμα | Απόφαση |
|---|---|
| Login | Κινητό + μόνιμος 8ψήφιος κωδικός, session cookie |
| Λίστα πελατών | Καθολική — όλοι βλέπουν όλες τις δημοσιευμένες συλλογές |
| Ανάκληση πρόσβασης | Απενεργοποίηση ή διαγραφή πελάτη |
| Product code mapping | **Προαιρετικό** — χωρίς αυτό, όλοι βλέπουν τα πάντα |
| Default access | `full_access` |
| Παράδοση κωδικών | **Email πρώτα** → Viber → WhatsApp → SMS |
| Ειδοποιήσεις συλλογών | Μόνο email (δωρεάν), ποτέ πληρωμένο κανάλι |
| Email verification | **Δεν υπάρχει** — το email δεν είναι credential, είναι κανάλι |
| Ορατότητα συλλογής | Όλοι από default, ή περιορισμός σε επιλεγμένους πελάτες |
| Διατήρηση αρχείων | Full-res διαγράφεται μετά από Χ μήνες, web/thumb μένουν |

**Κανόνας πρόσβασης**: αν μια συλλογή δεν έχει καθόλου δεδομένα παραγγελιών, το access mode αγνοείται και κάθε ενεργός πελάτης έχει πλήρη πρόσβαση.

---

## Πριν ξεκινήσεις

1. Φτιάξε άδειο φάκελο `photodelivery/`
2. Άνοιξέ τον στο Cursor (`File → Open Folder`)
3. Άνοιξε το Composer με `Cmd/Ctrl + I`, βάλ' το σε **Agent mode**
4. Έλεγξε ότι έχεις Node.js 20+ (`node --version`)

Μετά από κάθε prompt, κοίτα τι αρχεία δημιουργήθηκαν. Αν κάτι δεν βγάζει νόημα, ρώτα το Cursor πριν προχωρήσεις.

---

# ΦΑΣΗ Α — Θεμέλια

## Prompt 1 — Project setup

```
Create a Node.js project in this folder. No frontend framework, no build
step, no TypeScript — plain CommonJS Node with Express, and vanilla
JS/HTML/CSS on the frontend.

Run npm init and install exactly these:
express, better-sqlite3, multer, sharp, xlsx, uuid, cookie-parser,
nodemailer, archiver@7.0.1

IMPORTANT: pin archiver to exactly 7.0.1. Do not install 8.x — version
8.0.0 switched to ESM-only exports and breaks require('archiver') in a
CommonJS project.

Create this folder structure:
  routes/
  lib/
  public/admin/
  public/app/
  public/logo/
  data/
  uploads/
  test/

Add a .gitignore excluding: node_modules, data/*.db*, uploads/*,
public/logo/*, .env

In package.json set "main": "server.js" and add scripts:
  "start": "node server.js"
  "test": "node test/smoke.js"
```

---

## Prompt 2 — Database schema

```
Create db.js using better-sqlite3. Open data/app.db and enable WAL mode.

Create these tables if they don't exist:

collections
  id INTEGER PRIMARY KEY AUTOINCREMENT
  name TEXT NOT NULL
  status TEXT NOT NULL DEFAULT 'draft'      -- draft | published | archived
  published_at TEXT
  created_at TEXT DEFAULT CURRENT_TIMESTAMP

images
  id INTEGER PRIMARY KEY AUTOINCREMENT
  collection_id INTEGER NOT NULL
  original_filename TEXT NOT NULL
  product_code TEXT                          -- nullable, optional feature
  full_path TEXT NOT NULL
  web_path TEXT NOT NULL
  thumb_path TEXT NOT NULL
  created_at TEXT DEFAULT CURRENT_TIMESTAMP

customers
  id INTEGER PRIMARY KEY AUTOINCREMENT
  phone TEXT UNIQUE NOT NULL                 -- normalized: 306912345678
  email TEXT
  name TEXT
  erp_code TEXT
  access_code TEXT NOT NULL                  -- persistent login code
  code_updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  default_access_mode TEXT DEFAULT 'full_access'
  preferred_channel TEXT DEFAULT 'auto'      -- auto|email|viber|whatsapp|sms
  last_auth_channel TEXT                     -- what actually worked last
  email_status TEXT DEFAULT 'unknown'        -- unknown | ok | bounced
  notify_by_email INTEGER DEFAULT 1          -- announcements only
  status TEXT DEFAULT 'active'               -- active | disabled
  created_at TEXT DEFAULT CURRENT_TIMESTAMP

order_items
  id INTEGER PRIMARY KEY AUTOINCREMENT
  collection_id INTEGER NOT NULL
  customer_id INTEGER NOT NULL
  product_code TEXT NOT NULL

sessions
  id INTEGER PRIMARY KEY AUTOINCREMENT
  token TEXT UNIQUE NOT NULL
  customer_id INTEGER NOT NULL
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
  expires_at TEXT NOT NULL
  last_seen_at TEXT
  user_agent TEXT

auth_attempts
  id INTEGER PRIMARY KEY AUTOINCREMENT
  phone TEXT
  ip TEXT
  kind TEXT NOT NULL                         -- login | reset
  success INTEGER DEFAULT 0
  created_at TEXT DEFAULT CURRENT_TIMESTAMP

download_log
  id INTEGER PRIMARY KEY AUTOINCREMENT
  customer_id INTEGER
  image_id INTEGER NOT NULL
  downloaded_at TEXT DEFAULT CURRENT_TIMESTAMP

message_log
  id INTEGER PRIMARY KEY AUTOINCREMENT
  customer_id INTEGER
  destination TEXT NOT NULL                  -- phone or email used
  channel TEXT NOT NULL                      -- email|viber|whatsapp|sms
  kind TEXT NOT NULL                         -- welcome|reset|resend|new_collection
  status TEXT NOT NULL                       -- sent | failed
  provider_message_id TEXT
  error TEXT
  created_at TEXT DEFAULT CURRENT_TIMESTAMP

Foreign keys where appropriate. Indexes:
  images(collection_id)
  images(collection_id, product_code)
  order_items(collection_id, customer_id)
  customers(phone)
  sessions(token)
  sessions(customer_id)
  auth_attempts(phone, kind, created_at)
  auth_attempts(ip, kind, created_at)

Export the db instance.
```

---

## Prompt 3 — Image processing

```
Create lib/imageProcessor.js exporting an async function:

  processImage(inputBuffer, collectionId, baseFilename)

Uses sharp to write three JPEG variants into
uploads/{collectionId}/{full,web,thumb}/:

  full  — original resolution, quality 92
  web   — max width 1600, quality 85, withoutEnlargement: true
  thumb — max width 400, quality 80, withoutEnlargement: true

Sanitize the filename: keep only alphanumerics, dots, underscores and
hyphens. Force a .jpg extension on all outputs regardless of input
format, so .png/.heic/.tif inputs still produce .jpg variants.

Create directories with fs.mkdirSync({ recursive: true }) if missing.

Return { fullPath, webPath, thumbPath } as paths relative to uploads/.
```

---

## Prompt 4 — Excel parsing

```
Create lib/excelParser.js using the xlsx library. Export three
functions, each taking a Buffer and returning normalized rows.

All column matching is case-insensitive substring matching on header
names, so Greek and English headers both work.

parseImageMapping(buffer)
  filename column: contains 'filename' | 'εικόνα' | 'αρχείο'
  product code:    contains 'product'  | 'κωδικ'
  returns [{ filename, productCode }]

parseCustomers(buffer)
  phone:  'phone' | 'κινητό' | 'κινητο' | 'τηλ' | 'mobile'   (REQUIRED)
  email:  'email' | 'mail'
  name:   'name'  | 'όνομα'  | 'ονομα' | 'επωνυμ'
  erp:    'erp'   | 'κωδικ'
  mode:   'access' | 'mode' | 'πρόσβαση' | 'προσβαση'
  Validate mode against ('order_only','browse_all_download_order',
  'full_access'); anything invalid or missing becomes 'full_access'.
  Rows without a phone are returned as errors, not silently dropped.
  returns { rows: [...], errors: [{ rowIndex, reason }] }

parseOrders(buffer)
  identifier: 'erp' | 'email' | 'phone' | 'κινητ' | 'πελ'
  product:    'product' | 'κωδικ'
  returns [{ identifier, productCode }]

Trim all values. Skip rows where a required field is empty.
```

---

## Prompt 5 — Phone normalization & code generation

```
Create lib/phone.js exporting:

normalizePhone(input)
  Strip spaces, dashes, parentheses, and a leading +.
  Greek rules:
    10 digits starting with 69   → prefix 30   (6912345678 → 306912345678)
    12 digits starting with 30   → accept as-is
    starts with 00               → strip the 00, then re-check
  Return the normalized string, or null if it isn't a plausible mobile.

formatPhoneForDisplay(normalized)
  Human readable: +30 691 234 5678

maskPhone(normalized)
  For showing back to a logged-in user: +30 69** *** 5678

Create lib/codes.js exporting:

generateAccessCode()
  8 characters from the alphabet ABCDEFGHJKMNPQRSTUVWXYZ23456789
  (no 0/O, no 1/I/L — these get misread when typed from a message).
  Use crypto.randomInt per character. Never Math.random.

generateSessionToken()
  crypto.randomBytes(16).toString('hex')

normalizeCodeInput(input)
  Uppercase, strip spaces and dashes, so the customer can type it any
  way they like.

compareCode(input, stored)
  Timing-safe comparison. Normalize the input first, then compare with
  crypto.timingSafeEqual on equal-length buffers, returning false on a
  length mismatch rather than throwing.
```

---

## Prompt 6 — Messaging: email-first cascade

```
Build the delivery layer. Email is the PRIMARY channel for
authentication codes, with a sequential fallback cascade.

There is deliberately NO email verification flow anywhere in this app.
Email is a delivery channel, not a credential. Login is always phone +
code. Do not build confirm-your-email tokens or pending states.

--- lib/email.js ---

sendEmail({ to, subject, text, html }) → { ok, providerMessageId?, error? }

Two drivers via process.env.EMAIL_PROVIDER:
  'console' (DEFAULT) — prints the full email to stdout in a clearly
    boxed format. Must be the default so the whole app works locally
    with no account and no cost.
  'smtp' — nodemailer with SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS,
    SMTP_FROM. Works with Mailgun, Postmark, Resend, or any mail server.

--- lib/sms.js ---

sendPhoneMessage({ phone, channel, text }) → { ok, providerMessageId?, error? }
  channel: 'viber' | 'whatsapp' | 'sms'

Drivers via process.env.MESSAGING_PROVIDER:
  'console' (DEFAULT) — prints to stdout, boxed, with phone and channel.
  'yuboto' — Yuboto HTTP API with YUBOTO_API_TOKEN. Supports viber and
    sms. Sender ID from MESSAGING_SENDER_ID. If asked for 'whatsapp',
    return ok:false with a clear "channel not supported by provider"
    error so the cascade moves on rather than silently dropping.
  'twilio' — TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM.
    Supports sms and whatsapp (whatsapp: prefix). Same
    not-supported behaviour for viber.

--- lib/messaging.js ---

Every send attempt, successful or not, writes a message_log row.

sendAuthMessage(customer, kind, { code })
  kind is 'welcome' | 'reset' | 'resend'.

  Cascade, tried SEQUENTIALLY, stopping at the first success:
    1. email      (skip if the customer has no email)
    2. viber
    3. whatsapp
    4. sms
  Never send the same code through two channels at once.
  Skip any channel with no destination, and any channel the configured
  provider reports as unsupported.

  If customers.preferred_channel is not 'auto', try that channel FIRST,
  then continue through the remaining channels in the standard order.

  On success: update customers.last_auth_channel.
  On an email failure: set customers.email_status='bounced'.
  On an email success: set customers.email_status='ok'.

  Return { ok, channel, attempts: [{ channel, ok, error? }] }
  If every channel fails, ok is false and attempts holds the full chain
  so the admin UI can show exactly what was tried.

sendAnnouncement(customer, payload)
  Email ONLY. If the customer has no email, or notify_by_email is 0,
  skip them entirely — never fall back to a paid channel for an
  announcement. Return { ok, skipped }.

--- Templates ---

Greek. Plain text plus a minimal HTML version using the company's
accent colour and logo from config.js. Keep the phone-channel versions
short — SMS is billed per segment and Greek characters use a smaller
segment size.

  welcomeText / welcomeEmail       (companyName, code, loginUrl)
  resetText / resetEmail           (companyName, code, loginUrl)
  newCollectionEmail               (companyName, collectionName, loginUrl, coverImageUrl?)

Announcement emails must carry an unsubscribe link at the bottom
pointing to GET /unsubscribe/:token, where the token is an HMAC of the
customer id keyed with SESSION_COOKIE_SECRET. That route sets
notify_by_email=0 and renders a simple confirmation page.

Auth emails must NOT have an unsubscribe link — they are transactional
and the customer needs them to log in.
```

---

## Prompt 7 — Access control

```
Create lib/access.js — the security core of the application.

Put this rule as a comment at the top: when a collection has no order
data at all, order-based filtering is disabled entirely and every
active customer gets full access. Product code mapping is an optional
feature, never a prerequisite.

Export:

getCustomerFromSession(sessionToken)
  Look up the session by token. Return null if missing, expired, or the
  customer's status is not 'active'. Update last_seen_at. Return the
  customer row.

listVisibleCollections(customer)
  All collections with status='published', newest first. Every active
  customer sees every published collection — access is revoked only by
  disabling or deleting the customer.

getCollectionContext(customer, collectionId)
  Null if the collection doesn't exist or isn't published.
  hasOrderData = whether ANY order_items rows exist for this collection.
  orderedCodes = Set of product_codes this customer ordered here.
  Return { collection, customer, hasOrderData, orderedCodes }

canView(ctx, image)
  If !ctx.hasOrderData → true
  If mode is 'order_only' → true only if image.product_code is non-null
    and in orderedCodes
  Otherwise → true

canDownload(ctx, image)
  If !ctx.hasOrderData → true
  If mode is 'full_access' → true
  Otherwise → true only if image.product_code is non-null and in
    orderedCodes

Mode is ctx.customer.default_access_mode.

These predicates are the ONLY source of truth for authorization. Every
route serving image data or files must call them. Never trust any
permission hint from the client.
```

---

## Prompt 8 — Rate limiting

```
Create lib/rateLimit.js on top of the auth_attempts table.

Comment at the top: these limits protect against three things —
brute-forcing an 8-character code, enumerating which phone numbers are
registered customers, and spamming a real customer's phone or inbox
through repeated reset requests.

recordAttempt({ phone, ip, kind, success })

checkLoginAllowed(phone, ip)
  Blocked if 5+ failed logins for this phone in the last 15 minutes,
  OR 20+ login attempts from this IP in the last hour.
  Return { allowed, retryAfterSeconds }

checkResetAllowed(phone, ip)
  Blocked if 3+ resets for this phone in the last hour,
  OR 10+ resets from this IP in the last hour.
  Return { allowed, retryAfterSeconds }

cleanupOldAttempts()
  Delete rows older than 24 hours. Called on an interval from server.js.
```

---

# ΦΑΣΗ Β — API

## Prompt 9 — Admin API

```
Create routes/admin.js as an Express router. multer with memoryStorage,
50MB per file limit. All error responses use Greek messages in
{ error }.

--- COLLECTIONS ---

POST /collections            body { name } → creates with status='draft'
GET  /collections            all, with status and image count
GET  /collections/:id        detail with its images and order-data flag

POST /collections/:id/images
  multer.array('images', 500)
  processImage each, insert an images row per file.
  Return { uploaded, results: [{ filename, ok, error? }] } so partial
  failures are visible.

POST /collections/:id/mapping           -- OPTIONAL STEP
  multer.single('mapping'), parseImageMapping.
  UPDATE images SET product_code WHERE collection_id AND
  original_filename. Track matched vs unmatched.
  Return { matchedCount, unmatchedCount, matched, unmatched }
  Nothing else in the app may assume product_code is set. Uploading
  images and never running this step must work end to end.

POST /collections/:id/orders            -- OPTIONAL STEP
  multer.single('orders'), parseOrders.
  Resolve each identifier against customers.erp_code, customers.email
  or customers.phone (normalized). Insert order_items for matches,
  collect unresolved.
  Return { inserted, unresolvedCount, unresolved }

POST /collections/:id/publish
  body { notify: boolean }
  Set status='published', published_at=now.
  If notify: sendAnnouncement to every active customer, in batches.
  Return { notified, skipped, failed }.

POST /collections/:id/unpublish   → back to 'draft'

--- CUSTOMERS (global, not per collection) ---

GET /customers
  id, name, phone (formatted), email, email_status, erp_code, status,
  default_access_mode, preferred_channel, last_auth_channel,
  notify_by_email, code_updated_at, and whether they ever logged in.

POST /customers
  body { name, phone, email?, erpCode?, defaultAccessMode?,
         preferredChannel?, sendCode: boolean }
  Normalize phone; 400 if invalid or already registered.
  Phone is required (it is the login identifier). Email optional.
  Generate an access code, insert with status='active' and
  default_access_mode defaulting to 'full_access'.
  If sendCode, call sendAuthMessage(customer, 'welcome', { code }).
  Return the created customer INCLUDING the plain code and the send
  result, so the admin can read it out by phone if delivery failed.

POST /customers/upload
  multer.single('customers'), parseCustomers.
  Normalize every phone. Report invalid and duplicate phones as errors
  rather than skipping silently. Generate a code per new customer.
  Body flag sendCodes controls whether welcome messages go out.
  Return { created, skipped, errors: [{ row, reason }] }

PATCH /customers/:id
  Update name, email, erp_code, default_access_mode, preferred_channel,
  notify_by_email, status.
  Setting status='disabled' must delete all that customer's sessions
  immediately.

POST /customers/:id/resend-code   → resends the EXISTING code
POST /customers/:id/reset-code    → new code, kills sessions, sends it
Both return the full { ok, channel, attempts } from sendAuthMessage.

DELETE /customers/:id
  Delete the customer, their sessions and their order_items. Keep
  download_log rows but null the customer reference.

GET /customers/:id/activity
  Last login, active session count, last 50 downloads with image and
  collection names.

--- MESSAGES ---

GET /messages
  Last 200 message_log rows joined with customer names, for a
  read-only delivery log in the admin UI.

Export the router.
```

---

## Prompt 10 — Customer API: auth + gallery

```
Create routes/customer.js as an Express router, using lib/access.js,
lib/phone.js, lib/codes.js, lib/messaging.js, lib/rateLimit.js.

--- AUTH ---

POST /auth/login
  body { phone, code }
  Normalize the phone; 400 on an invalid format.
  checkLoginAllowed — if blocked, 429 with a Greek "try again later"
  message that does NOT explain which limit was hit.
  Find the active customer by normalized phone.
  Verify with compareCode (timing-safe).
  On failure: recordAttempt(false), 401 with a single generic Greek
  message ("Λάθος αριθμός ή κωδικός"). Never reveal which field was
  wrong and never confirm whether the number exists.
  On success: recordAttempt(true), create a session with a 30-day
  expiry, set an httpOnly, sameSite=lax, secure-in-production cookie
  named 'pd_session'. Return { ok: true }.

POST /auth/reset
  body { phone }
  Normalize. checkResetAllowed — if blocked, return the SAME neutral
  success response but send nothing.
  If a matching active customer exists: generate a new access_code,
  update code_updated_at, delete all their sessions, and
  sendAuthMessage(customer, 'reset', { code }).
  ALWAYS return an identical response regardless of whether the phone
  exists, whether an email exists, or whether any send succeeded:
    { ok: true, message: "Αν ο αριθμός είναι καταχωρημένος, θα λάβεις
      νέο κωδικό." }
  Add a comment stating that this uniform response is deliberate and
  prevents enumeration of the customer list.

POST /auth/logout    → delete the session row, clear the cookie
GET  /auth/me        → { name, phone: maskPhone(...) } or 401

--- MIDDLEWARE ---

requireCustomer(req, res, next)
  Read the pd_session cookie, call getCustomerFromSession.
  On failure return 401 { error, requiresLogin: true } so the frontend
  knows to redirect. Attach req.customer.

--- GALLERY (all behind requireCustomer) ---

GET /collections
  listVisibleCollections → id, name, published_at, image count, and one
  cover thumbnail per collection.

GET /collections/:id
  getCollectionContext; 404 if null.
  Return collection name and images filtered by canView, each as
  { id, productCode, thumbUrl, webUrl, downloadable }.

GET /collections/:id/image/:imageId/:variant
  variant must be 'thumb' or 'web'; 400 otherwise.
  Check canView. 403 if not permitted, 404 if invalid or the file is
  missing on disk. res.sendFile.

GET /collections/:id/download/:imageId
  Check canDownload; 403 with a Greek message if not.
  Insert a download_log row, then res.download the full-res file using
  the original filename.

POST /collections/:id/download-zip
  body { imageIds }. Keep only those where canDownload is true,
  silently dropping the rest; 403 only if nothing remains.
  Stream a zip with archiver('zip', { zlib: { level: 6 } }), adding
  each file under its original filename and logging each one.

--- UNSUBSCRIBE (public, no auth) ---

GET /unsubscribe/:token
  Verify the HMAC, set notify_by_email=0, render a simple Greek
  confirmation page. Never reveal the customer's details on this page.

Export the router and requireCustomer.
```

---

## Prompt 11 — Server wiring

```
Create server.js:

  express app with express.json(), express.urlencoded({extended:true}),
  cookie-parser (signed with SESSION_COOKIE_SECRET)
  trust proxy enabled, so req.ip is correct behind Nginx

  mount routes/admin.js   at /api/admin   (behind the admin password gate)
  mount routes/customer.js at /api

  serve public/admin as static at /admin
  serve public/app   as static at /app-assets
  GET /app and GET /app/*  → sendFile public/app/index.html
  serve public/logo as static at /logo
  GET /  → redirect to /app

  GET /api/branding → the public-safe branding subset from config.js

  Run cleanupOldAttempts() every hour, and a session cleanup deleting
  expired sessions every hour.

  Listen on process.env.PORT || 3000, logging the admin and app URLs.
```

---

# ΦΑΣΗ Γ — Frontend

## Prompt 12 — Admin panel

```
Build the admin panel in public/admin/: index.html, style.css, app.js,
login.html. No framework, no build step, no CDN dependencies.

Design tokens as CSS variables (dark, utilitarian, data-oriented):
  --bg: #14141a          --surface: #1e1e26      --surface-raised: #26262f
  --border: #302f3a      --border-strong: #423f52
  --text: #f0efec        --text-dim: #a5a3ae     --text-faint: #706e7a
  --accent: #8b7bf0      --accent-dim: #4a4270
  --success: #5cb896     --warning: #d9a441      --danger: #d97070
Monospace stack for codes, IDs and URLs; system sans elsewhere. Flat,
8px radius, generous spacing, no gradients or heavy shadows.

Fetch /api/branding on load: apply --accent, show the logo or company
name, set document.title.

Top-level nav: Συλλογές · Πελάτες · Μηνύματα

--- ΣΥΛΛΟΓΕΣ ---
List view: cards with name, status pill (draft grey / published green),
image count, date. A "Νέα συλλογή" inline form (not a modal).

Detail view: a 4-step vertical wizard, each a card with a numbered
circle, Greek title and description, input, action button and a status
line that turns green on success, red on error.

  1. Φωτογραφίες συλλογής              [required]
  2. Αντιστοίχιση κωδικών προϊόντος    [ΠΡΟΑΙΡΕΤΙΚΟ]
  3. Παραγγελίες                        [ΠΡΟΑΙΡΕΤΙΚΟ]
  4. Δημοσίευση                         [required]

Steps 2 and 3 carry a muted "Προαιρετικό" badge and a one-line note:
without them, every customer sees the whole collection. Each step
mentions its expected Excel columns as inline code.

Step 4 is a publish card showing a summary — image count, whether order
filtering is active, how many active customers will gain access, and
the notification split (how many by email / how many have no email and
will be skipped). A "Ειδοποίηση πελατών με email" checkbox and a
publish button behind a confirm. Published collections show the pill
and an unpublish option.

--- ΠΕΛΑΤΕΣ ---
Table: name, phone, email with a status dot (grey unknown, green ok,
red bounced), ERP code, status pill, access mode, last_auth_channel with
a small icon, last login. Row menu: Επεξεργασία / Νέος κωδικός /
Επαναποστολή κωδικού / Απενεργοποίηση / Διαγραφή, destructive ones
behind a confirm.

Above: "Νέος πελάτης" (inline form) and "Εισαγωγή από Excel" with a
checkbox for whether to send codes on import.

The customer form shows the cascade as a hint under the channel
selector: "Email → Viber → WhatsApp → SMS". Warn inline when creating a
customer with no email, since every code will then fall through to a
paid channel.

After creating a customer, show the generated code ONCE, prominently,
with a copy button, plus which channel delivered it. If all channels
failed, show a persistent warning row in the table with "Δοκίμασε ξανά"
and "Δείξε τον κωδικό" buttons.

Import results show a clear error table for failed rows.

--- ΜΗΝΥΜΑΤΑ ---
Read-only log: date, customer, destination, channel, kind, status.
Failed rows highlighted in the danger colour with the error text shown.

--- LOGIN ---
login.html: single password field, same dark styling, posts to
/api/login.

Escape every user-supplied string before inserting into innerHTML.
```

---

## Prompt 13 — Customer app

```
Build the customer app in public/app/: index.html, style.css, app.js.
Mobile-first, no framework, no build step, same dark palette.

The server serves the same index.html for /app and /app/*; the frontend
switches screens in JS based on the path and auth state. Use pushState,
nothing more elaborate.

Fetch /api/branding on load for the logo, company name, accent colour
and footer details.

--- SCREEN 1 — Login  (/app/login) ---
Logo or company name.
Two fields: κινητό τηλέφωνο (type="tel", inputmode="numeric") and
κωδικός πρόσβασης (autocapitalize="characters", autocomplete="off",
uppercased live as the user types).
Submit → POST /api/auth/login → on success go to /app.
401 shows one generic Greek error. 429 shows the try-again-later text.

A "Ξέχασα τον κωδικό μου" link swaps the form for a single phone field
→ POST /api/auth/reset → always show the same neutral confirmation,
then a link back to login.

--- SCREEN 2 — Collections  (/app) ---
GET /api/collections.
Vertical cards: cover thumbnail, collection name, publish date, image
count. Tap opens the gallery. Empty state when nothing is published yet.
Header shows the customer's name and a logout button.

--- SCREEN 3 — Gallery  (/app/c/:id) ---
GET /api/collections/:id. Back button to the list.

CSS grid of square thumbnails: 3 columns on mobile, 4 above 560px,
6 above 860px. Small gaps (3px mobile, 6px larger). loading="lazy".

Each thumbnail shows its product code as a small monospace tag when one
exists. Downloadable images get a circular checkmark toggle; tapping
selects and deselects with an accent border. Non-downloadable images
are dimmed to 35% with a lock icon, and tapping opens a preview-only
lightbox using webUrl (never full-res) captioned "Δεν είναι μέρος της
παραγγελίας σου — μόνο προεπισκόπηση."

When a collection has no order filtering, no locked images appear at
all — that is the normal case.

Fixed bottom bar, hidden until something is selected: "{n} επιλεγμένα",
a "Καθαρισμός" secondary button and a "Λήψη" primary button. Download
POSTs the selected ids to the zip endpoint, takes the response as a
blob, triggers a temporary anchor click, revokes the URL. The button
shows "Προετοιμασία..." while it runs.

--- GLOBAL ---
Any 401 or { requiresLogin: true } redirects to /app/login.
Minimum 44px tap targets everywhere.
Footer with company contact details from branding.
```

---

# ΦΑΣΗ Δ — Έλεγχος & συσκευασία

## Prompt 14 — Smoke test

```
Create test/smoke.js verifying the whole system end to end against a
local server on port 3000. Run with EMAIL_PROVIDER=console and
MESSAGING_PROVIDER=console so nothing is actually sent — capture the
generated codes from the API responses instead.

Flow:
  1. Generate 4 synthetic 900x1200 JPEGs with sharp.
  2. Create collection A, upload the images, upload NO mapping and NO
     orders, then publish it.
  3. Create three customers with different phones (one with an email,
     one without), capturing their access codes.
  4. Log in as customer 1 and confirm they see collection A with all 4
     images downloadable — this proves the no-mapping path works.
  5. Create collection B, upload the same images, upload a mapping and
     orders where customer 1 ordered only one product, set customer 1's
     mode to order_only, publish it.
  6. Confirm customer 1 now sees only their ordered image in B while
     still seeing all 4 in A.

Assert and print PASS/FAIL for each:
  - login with a wrong code returns 401
  - login with a correct code sets a session cookie
  - unauthenticated GET /api/collections returns 401 with requiresLogin
  - a draft collection never appears in /api/collections
  - reset returns a BYTE-IDENTICAL response body for a registered and
    an unregistered phone
  - 5 failed logins are allowed, the 6th returns 429
  - disabling a customer makes their existing session return 401
    immediately
  - downloading an image the customer cannot access returns 403
  - a thumbnail request for an image outside an order_only customer's
    order returns 403
  - a zip mixing one allowed and one disallowed id contains only the
    allowed file
  - phone normalization: 6912345678, "+30 691 234 5678" and
    306912345678 all resolve to the same customer
  - a customer with no email still receives their code (console driver
    logs a viber/sms attempt, not an email one)
```

Τρέξε `npm start` σε ένα terminal και `npm test` σε άλλο. Πρέπει να δεις PASS παντού.

---

## Prompt 15 — White-label configuration

```
Add white-label branding and admin protection, all through environment
variables, so one codebase can be deployed per customer.

Create config.js reading process.env with defaults:
  COMPANY_NAME          (default 'Photo Delivery')
  COMPANY_PHONE
  COMPANY_EMAIL
  COMPANY_ADDRESS
  ACCENT_COLOR          (default '#8b7bf0')
  LOGO_PATH             (default null)
  FOOTER_TEXT
  APP_PUBLIC_URL        used to build login links inside messages
  ADMIN_PASSWORD        REQUIRED
  SESSION_COOKIE_SECRET REQUIRED
  EMAIL_PROVIDER        console | smtp        (default console)
  SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM
  MESSAGING_PROVIDER    console | yuboto | twilio   (default console)
  MESSAGING_SENDER_ID
  YUBOTO_API_TOKEN
  TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM

Fail loudly at boot if:
  - ADMIN_PASSWORD or SESSION_COOKIE_SECRET is missing
  - EMAIL_PROVIDER is 'smtp' and any SMTP setting is missing
  - MESSAGING_PROVIDER is not 'console' and its credentials are missing
Better to refuse to start than to silently fail to deliver codes later.

GET /api/branding returns the public-safe subset (never secrets).

Admin password gate:
  middleware guarding /admin and /api/admin
  /admin/login.html with a single password field
  POST /api/login compares against ADMIN_PASSWORD and sets an httpOnly
  signed cookie
  The customer routes (/app, /api/auth/*, /api/collections/*,
  /unsubscribe/*) must stay completely public — never guard those.

Add .env.example documenting every variable with a short Greek comment.
```

---

## Prompt 16 — Docker

```
Create a Dockerfile:

FROM node:22-alpine
Install build deps for sharp and better-sqlite3 on alpine:
  vips-dev, python3, make, g++
WORKDIR /app
Copy package*.json first, run npm ci --omit=dev (layer caching)
Copy the rest
Create data, uploads and public/logo directories
EXPOSE 3000
CMD ["node", "server.js"]

Create .dockerignore excluding: node_modules, data, uploads,
public/logo, .env, *.log, test, .git

Create docker-compose.yml for local testing that builds the image, maps
port 3000, mounts ./data and ./uploads as volumes so data survives
restarts, and reads env vars from .env.

Add a README.md section (Greek) covering:
  docker compose up --build          local test
  docker build -t photodelivery:latest .   build for provisioning
```

**Δοκιμή με Docker Desktop:**

```bash
docker build -t photodelivery:latest .
docker run -p 3000:3000 \
  -e ADMIN_PASSWORD=test123 \
  -e SESSION_COOKIE_SECRET=devsecret \
  photodelivery:latest
```

Άνοιξε `http://localhost:3000/admin` — αν φορτώνει, το image είναι σωστό.

---

# ΦΑΣΗ Ε — Meta-admin (provisioning με ένα κλικ)

> Ξεχωριστός φάκελος `meta-admin/`, όχι μέσα στο photodelivery.
> Άνοιξέ τον ως νέο project στο Cursor.

## Prompt 17 — Meta-admin core

```
Create a separate Node.js/Express app that manages photodelivery Docker
instances. It runs only on my own machine or server and is never
exposed to customers.

npm install express better-sqlite3 uuid dockerode multer

db.js — SQLite at data/meta.db:
  instances(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subdomain TEXT UNIQUE NOT NULL,
    company_name TEXT NOT NULL,
    type TEXT CHECK(type IN ('demo','production')) DEFAULT 'demo',
    container_id TEXT,
    port INTEGER UNIQUE,
    admin_password TEXT,
    accent_color TEXT DEFAULT '#8b7bf0',
    logo_filename TEXT,
    phone TEXT, email TEXT, address TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    status TEXT DEFAULT 'running'
  )

portManager.js
  allocatePort() — next free port from 3100 upward, based on the
  highest port currently in the table.

dockerManager.js — dockerode against the local Docker socket
  createInstance({ subdomain, companyName, port, adminPassword,
                   sessionSecret, accentColor, logoFilename,
                   phone, email, address })
    Image 'photodelivery:latest', name 'pd_' + subdomain
    Env: COMPANY_NAME, ADMIN_PASSWORD, SESSION_COOKIE_SECRET,
         ACCENT_COLOR, COMPANY_PHONE, COMPANY_EMAIL, COMPANY_ADDRESS,
         LOGO_PATH, APP_PUBLIC_URL, PORT=3000
    PortBindings 3000/tcp → the allocated host port
    Binds three host folders per subdomain for data, uploads and logo
    RestartPolicy unless-stopped
    Start it, return the container id.

  stopInstance / startInstance / removeInstance / getContainerStatus
  ('running' | 'stopped' | 'missing')

logoManager.js
  uploadLogo(subdomain, buffer, originalFilename) — saves into the
  per-subdomain logo folder, sanitizes the name, returns it.

Make the host folder root configurable via INSTANCE_DATA_ROOT,
defaulting to ./instances so it works locally with Docker Desktop as
well as on a server.
```

---

## Prompt 18 — Meta-admin API & expiry

```
Add routes/api.js with multer memoryStorage for the logo.

POST /instances
  multipart: company_name, subdomain (optional — slugify the company
  name if empty), type, accent_color, phone, email, address,
  demo_hours (default 48, ignored for production), logo file.

  With rollback if any step fails:
    1. validate the subdomain is unique
    2. generate admin_password = uuidv4().slice(0,8)
       and sessionSecret = uuidv4()
    3. allocatePort()
    4. save the logo if present
    5. createInstance(...)
    6. expires_at = now + demo_hours for demos, NULL for production
    7. insert the row
  Return { subdomain, url, adminPassword, port, expiresAt }

GET /instances
  All rows, calling getContainerStatus for each and correcting the
  stored status if it drifted.

POST /instances/:id/start
POST /instances/:id/stop
POST /instances/:id/promote   → type='production', expires_at=NULL
DELETE /instances/:id         → stop and remove the container, delete
                                the row, leave the data folders on disk
                                and say so in the response

expireJob.js
  startExpireJob() — every 30 minutes, find demo instances past their
  expires_at that are still running, stop and remove them, set
  status='expired', log each action with a timestamp.

server.js
  mounts /api, serves public/ statically, listens on port 4000,
  HTTP Basic Auth on every route against META_ADMIN_PASSWORD,
  calls startExpireJob() on startup.

This version does not touch Nginx — instances are reachable directly on
localhost:{port}. Subdomain routing comes later, when deploying to a
real server.
```

---

## Prompt 19 — Meta-admin dashboard

```
Build the dashboard in public/: index.html, style.css, app.js. Same
dark tokens as the product.

Header: "Instance Manager" + a "New instance" button.

Table columns:
  Subdomain   — link opening http://localhost:{port} in a new tab
  Company
  Type        — pill, amber demo / teal production
  Status      — dot: green running, grey stopped, red expired
  Expires     — live countdown for demos ("47h 12m"), "—" for production
  Actions     — Open · Start/Stop · Promote (demos only) · Delete (confirm)

"New instance" reveals an inline form (not a modal — position:fixed
misbehaves in embedded contexts):
  Company name (required)
  Subdomain (auto-slugified from the company name as you type, editable)
  Type toggle Demo / Production
  Demo duration in hours (only when Demo, default 48)
  Logo file input
  Accent colour picker (default #8b7bf0)
  Phone, Email, Address
  Create → spinner → result panel with the URL and the generated admin
  password plus a copy button, and a warning that the password is shown
  only once.

Auto-refresh the table every 60 seconds. Update countdowns every minute
without refetching.
```

---

# ΦΑΣΗ ΣΤ — Επεκτάσεις

> Αυτά είναι **προσθετικά**. Γράφονται ως idempotent migrations, οπότε
> τρέχουν πάνω σε υπάρχουσα εγκατάσταση χωρίς να χαθούν δεδομένα.
> Επιστρέφουν στον φάκελο `photodelivery/`.

## Prompt 20 — Ορατότητα συλλογής ανά πελάτη

```
Add per-collection customer visibility. Until now every active customer
saw every published collection; make that the default but allow a
collection to be restricted to an explicit set of customers.

--- SCHEMA MIGRATION ---
Write this as an idempotent migration in db.js (check for the column
before adding it) so existing databases upgrade in place.

  ALTER TABLE collections ADD COLUMN visibility TEXT DEFAULT 'all'
    -- 'all' | 'selected'

  CREATE TABLE IF NOT EXISTS collection_customers (
    collection_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    PRIMARY KEY (collection_id, customer_id)
  )

  ALTER TABLE customers ADD COLUMN tags TEXT
    -- comma-separated labels, e.g. "wholesale,north-greece"

  CREATE INDEX IF NOT EXISTS idx_collcust ON collection_customers(customer_id)

Customer tags exist so the admin can select 80 customers by tag instead
of ticking 80 checkboxes. They carry no permissions of their own — they
are only a selection aid in the UI.

--- ACCESS CONTROL (lib/access.js) ---

listVisibleCollections(customer)
  Return published collections where visibility='all', UNION published
  collections where visibility='selected' AND a matching row exists in
  collection_customers for this customer.

getCollectionContext(customer, collectionId)
  CRITICAL: this must apply the same visibility check, not just the
  published check. Return null if the collection is 'selected' and this
  customer is not in collection_customers. Without this, a customer
  could reach a restricted collection by requesting its id directly,
  since listVisibleCollections only controls what the UI lists.

Add a comment above both functions stating that visibility is enforced
in getCollectionContext, and that every image, download and zip route
already depends on getCollectionContext, so they inherit the rule.

--- ADMIN API ---

PATCH /collections/:id/visibility
  body { visibility: 'all' | 'selected', customerIds?: number[] }
  When switching to 'selected', replace the whole collection_customers
  set for this collection in a transaction.
  When switching to 'all', clear the rows (keep the data model clean).

GET /collections/:id/audience
  Return { visibility, selectedCustomerIds, totalActiveCustomers,
           reachCount } where reachCount is how many active customers
  will actually see this collection.

GET /customers/tags
  Return the distinct tags in use, with a count per tag.

CHANGED — POST /collections/:id/publish
  The notification step must respect visibility: announce only to
  customers who can actually see the collection. Return the reach count
  alongside the notified/skipped/failed counts.

CHANGED — PATCH /customers/:id
  Accept a tags field (normalize: lowercase, trim, dedupe, comma-join).

CHANGED — parseCustomers in lib/excelParser.js
  Accept an optional tags column ('tags' | 'ετικέτ' | 'ομάδα' |
  'κατηγορ'), semicolon- or comma-separated inside the cell.

--- ADMIN UI ---

In the collection detail wizard, insert a new step between the optional
orders step and publish:

  Ορατότητα  [required, defaults to everyone]
    Radio: "Όλοι οι πελάτες" (default) / "Επιλεγμένοι πελάτες"
    When 'selected' is chosen, reveal a picker with:
      - a search box filtering by name, phone or ERP code
      - tag chips that select or deselect every customer with that tag
        in one click
      - a checkbox list with the count of selected customers shown live
      - "Επιλογή όλων" / "Καθαρισμός" shortcuts
    Always show a live summary line: "Θα το δουν N από M ενεργούς
    πελάτες."

In the publish card, show the reach count so it is obvious before
publishing how many people gain access.

In the customers table, show tags as small chips and allow editing them
inline.

Renumber the wizard steps in the UI accordingly.
```

**Πώς λύνει τις δύο εταιρείες**: βάζεις tag `εταιρεία-α` και `εταιρεία-β` στους πελάτες, και κάθε συλλογή περιορίζεται στο αντίστοιχο tag με δύο κλικ. Οι πελάτες που αγοράζουν και από τις δύο παίρνουν και τα δύο tags, ένα login, βλέπουν και τα δύο. Αυτό που δεν καλύπτει είναι διαφορετικό branding ανά εταιρεία — αν το χρειάζονται, τότε πραγματικά θέλουν δύο instances.

---

## Prompt 21 — Storage tracking & retention

```
Add storage measurement and a retention policy that purges full-res
files from old collections. Full-res files are roughly 94% of all disk
usage, and nobody downloads full-res from a collection two seasons old,
so purging them is the single highest-leverage storage control.

--- SCHEMA MIGRATION (idempotent) ---

  ALTER TABLE images ADD COLUMN full_bytes INTEGER DEFAULT 0
  ALTER TABLE images ADD COLUMN web_bytes INTEGER DEFAULT 0
  ALTER TABLE images ADD COLUMN thumb_bytes INTEGER DEFAULT 0
  ALTER TABLE images ADD COLUMN full_purged INTEGER DEFAULT 0

  ALTER TABLE collections ADD COLUMN retention_months INTEGER
    -- NULL means use the global default
  ALTER TABLE collections ADD COLUMN retention_pinned INTEGER DEFAULT 0
    -- 1 means never purge this collection
  ALTER TABLE collections ADD COLUMN full_purged_at TEXT

  CREATE TABLE IF NOT EXISTS storage_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total_bytes INTEGER, full_bytes INTEGER,
    web_bytes INTEGER, thumb_bytes INTEGER,
    disk_free_bytes INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )

--- CAPTURE SIZES ---

lib/imageProcessor.js: after writing each variant, stat the file and
return its byte size. The image upload route stores all three sizes on
the images row.

Add a one-off backfill script scripts/backfillSizes.js that walks
existing rows with zero bytes, stats the files on disk and fills them
in, so this works on a database that already has images.

--- lib/storage.js ---

getCollectionStorage(collectionId)
  SQL aggregate over images: { fullBytes, webBytes, thumbBytes, total,
  imageCount, purgedCount }

getTotalStorage()
  Same aggregate across everything, plus a per-collection breakdown
  sorted by size descending.

getDiskUsage()
  Use statfs (fs.statfs, available in Node 18+) on the uploads path to
  return { totalBytes, freeBytes, usedPercent } for the actual
  filesystem — the app's own footprint is not the same as the disk
  being full.

formatBytes(n)
  Human readable: "2.1 GB", "640 MB".

takeSnapshot()
  Insert a storage_snapshots row. Called daily so growth over time is
  visible.

--- lib/retention.js ---

getEffectiveRetention(collection)
  collection.retention_months, else config.DEFAULT_RETENTION_MONTHS,
  else null (never purge).

findPurgeCandidates()
  Published collections where retention_pinned = 0, full_purged_at IS
  NULL, and published_at is older than the effective retention.
  Return each with its collection name, age in months and reclaimable
  bytes.

purgeCollection(collectionId, { dryRun })
  Delete only the files under uploads/{id}/full/. Never touch web or
  thumb. Set images.full_purged = 1 for that collection and
  collections.full_purged_at = now.
  With dryRun, report what would be deleted without deleting anything.
  Return { filesDeleted, bytesReclaimed }.

startRetentionJob()
  Runs once a day. It does NOT purge automatically by default — it
  computes candidates and logs them. Only if
  config.RETENTION_AUTO_PURGE is true does it actually purge, and it
  logs every purge with the collection name and bytes reclaimed.
  Defaulting to manual is deliberate: deleting a customer's originals
  on a schedule they did not explicitly approve is not something to do
  silently.

--- DOWNLOAD BEHAVIOUR AFTER PURGE ---

lib/access.js is unchanged — purging is not a permissions concern.

The gallery API adds fullAvailable (image.full_purged === 0) to each
image.

GET /collections/:id/download/:imageId
  If the full file is purged, serve the web variant instead, with the
  filename suffixed "-web", and still log the download. Do not return
  an error — the customer gets a usable file rather than a dead button.

POST /collections/:id/download-zip
  Same rule per file. If any file in the zip is a web fallback, include
  a short README.txt in the archive (Greek) explaining that this
  collection is archived and the images are at web resolution.

Customer UI: on a collection where any image is purged, show a small
muted banner: "Αρχειοθετημένη συλλογή — οι εικόνες είναι σε ανάλυση
web." No banner when nothing is purged.

--- ADMIN API ---

GET /storage
  { total, byCollection: [...], disk: {...}, snapshots: last 30 }

GET /storage/candidates
  findPurgeCandidates with reclaimable bytes per collection and a total.

POST /collections/:id/purge-full
  body { dryRun?: boolean }
  Runs purgeCollection. Requires the collection to be published.

PATCH /collections/:id/retention
  body { retentionMonths?: number|null, pinned?: boolean }

--- ADMIN UI ---

Add a "Χώρος" section to the nav:
  - A headline showing total usage and disk free, with a progress bar
    that turns amber above 75% and red above 90%
  - A small line chart of the last 30 snapshots so growth is visible
  - A table of collections by size: name, images, full / web / thumb
    sizes, age, retention setting, and a purge button
  - A "Προς αρχειοθέτηση" panel listing purge candidates with total
    reclaimable space and a per-collection "Αρχειοθέτηση" button that
    first runs a dry run and shows exactly what will be deleted before
    asking for confirmation

In the collection detail view, show that collection's storage breakdown
and a retention control (months, or "Ποτέ"), plus a pin toggle for
collections that must keep their originals permanently.

--- CONFIG ---

Add to config.js and .env.example:
  DEFAULT_RETENTION_MONTHS   default 18, null disables retention
  RETENTION_AUTO_PURGE       default false
  STORAGE_WARN_PERCENT       default 75
  STORAGE_CRITICAL_PERCENT   default 90
```

**Γιατί αξίζει**: μια συλλογή 200 φωτογραφιών πιάνει ~2.1 GB, από τα οποία ~94% είναι τα full-res. Μετά την αρχειοθέτηση, η ίδια συλλογή πιάνει ~130 MB και παραμένει πλήρως περιηγήσιμη.

---

## Prompt 22 — Smoke test για τις επεκτάσεις

```
Extend test/smoke.js with a second block covering visibility and
retention. Keep the existing assertions.

Visibility:
  - create collection C, set visibility='selected' with only customer 2,
    publish it
  - customer 1 does NOT see C in GET /api/collections
  - customer 1 requesting GET /api/collections/{C} directly returns 404
    (this is the important one — it proves the check lives in
    getCollectionContext, not just in the list query)
  - customer 1 requesting an image URL from C returns 403 or 404
  - customer 2 sees C and can download from it
  - publishing C with notify=true announces only to customer 2

Retention:
  - after uploading images, images.full_bytes is non-zero
  - purgeCollection with dryRun=true deletes nothing and reports a
    non-zero bytesReclaimed
  - after a real purge: the full/ folder is empty, web/ and thumb/ are
    untouched, and images.full_purged = 1
  - downloading a purged image returns 200 with the web variant, not an
    error
  - a zip from a purged collection contains a README.txt
  - getDiskUsage returns plausible numbers (totalBytes > 0,
    usedPercent between 0 and 100)

Print PASS/FAIL per assertion as before.
```

---

# ΦΑΣΗ Ζ — Branding & gallery redesign

> Προσθετικά, πάνω σε υπάρχουσα εγκατάσταση. Η σειρά έχει σημασία:
> το 24 φτιάχνει το asset που χρειάζεται το 26, και το 25 φτιάχνει το
> μέγεθος που δείχνει το floating bar του 26.

## Prompt 23 — Μετονομασία σε Kollekta

```
Rename the product to "Kollekta" throughout.

Update: the wordmark in the admin top bar, the fallback title on the
customer login when no white-label logo is set, package.json name and
description, the README title, and the Docker image tag references in
the documentation.

Do NOT put the Kollekta name anywhere a white-label customer's buyers
would see it. Each instance shows THEIR logo and company name — the
message templates, email footers and gallery footer use COMPANY_NAME
from config, never the product name. Kollekta appears only in the
meta-admin and in the default unbranded fallback.

Set the APP_PUBLIC_URL default to https://kollekta.gr and make sure the
login links inside auth messages are built from it.
```

---

## Prompt 24 — Νέα εκδοχή εικόνας για το grid

```
The current 400px thumbnail is too small for a large-tile gallery grid:
on a retina desktop a three-to-five column layout needs roughly 900
physical pixels per cell, so tiles look soft. Add a fourth variant.

lib/imageProcessor.js: add a variant between thumb and web:

  grid — max width 900, quality 82, withoutEnlargement

Schema migration (idempotent): add images.grid_path and
images.grid_bytes.

Create scripts/backfillGrid.js that walks images where grid_path IS
NULL, regenerates the grid variant from the full file — or from the web
file when full has already been purged — and fills in the row. Log
progress every 50 images, since this will run over thousands of files.

Include grid_bytes in all storage calculations and in the storage
dashboard breakdown.

The retention purge must NEVER delete grid files. Only full is purged;
thumb, grid and web are permanent.

The gallery API returns gridUrl alongside thumbUrl and webUrl for every
image.

IMPORTANT: run backfillGrid.js BEFORE deploying the new gallery UI,
otherwise existing collections will render 400px thumbnails at triple
size and look worse than before the redesign.
```

---

## Prompt 25 — Επιλογή μεγέθους λήψης

```
Add a download size choice. Currently every download serves full-res;
let the buyer pick.

Offer exactly TWO options, never the thumbnail — a 400px image is not a
useful download and would only add noise to the decision.

Label the options by USE CASE, not by pixel dimensions. The buyer knows
what they need the image for, not what 1600px means:

  "Για eshop και social media"   → web variant
  "Για εκτύπωση και καταλόγους"  → full variant

Show the approximate total size for the current selection next to each
option, computed from the stored web_bytes / full_bytes columns, e.g.
"12 εικόνες · περίπου 7 MB" versus "12 εικόνες · περίπου 120 MB". On a
mobile connection this is what actually drives the right choice.

--- BACKEND ---

GET /collections/:id/download/:imageId
  Accept a ?size= query parameter, whitelisted to 'web' | 'full',
  defaulting to 'full' when absent so existing links keep working.
  Reject anything else with 400 — never interpolate the parameter into
  a file path.
  The canDownload check is unchanged and still runs first. Size is a
  format choice, not a permission.

POST /collections/:id/download-zip
  Accept { imageIds, size } in the body, same whitelist and default.

PURGED COLLECTIONS
  If size='full' is requested for an image where full_purged = 1, serve
  the web variant instead with a "-web" filename suffix, exactly as the
  retention behaviour already specifies. Do not error.

GET /collections/:id
  Add webBytes, fullBytes and fullAvailable to each image.
  Add fullAvailable to the collection payload (false when every image
  has been purged), so the UI can hide the full option entirely for
  archived collections.

DOWNLOAD LOG
  Add a variant column to download_log and record which size was taken.
  This later tells you whether anyone actually needs full-res, which
  informs the retention policy.

--- CUSTOMER UI ---

Tapping "Λήψη" opens a bottom sheet with the two options as large
tappable rows (min 64px), each showing its use-case label and computed
total size. A "Να θυμάσαι την επιλογή μου" checkbox, checked by
default.

Store the preference in localStorage. On subsequent downloads, if a
preference exists, skip the sheet and download straight away — but the
button then reads "Λήψη · eshop" or "Λήψη · εκτύπωση" with a small
chevron that reopens the sheet. Never make a repeat user tap through
the same choice every time.

For an archived collection where fullAvailable is false, skip the sheet
completely and download the web variant. The existing archived banner
already explains why.

Bottom sheet: same dark tokens, rounded top corners only, slides up
from the bottom, dismissed by tapping outside or the close button.
```

---

## Prompt 26 — Επανασχεδίαση gallery

```
Redesign the customer gallery for a fashion buying audience. Three
things change together — CSS alone will look worse, not better.

--- GRID LAYOUT ---

Portrait 3:4 cells, object-fit: cover, object-position: center top.
Square crops mangle full-body fashion shots; top-anchoring means a
model's head is never cut off.

Column counts:
  up to 640px   → 3 columns
  640–1024px    → 4 columns
  1024–1440px   → 5 columns
  above 1440px  → 6 columns
Container capped at 1600px and centred. Gaps 6px on mobile, 8px above
640px. Same outer padding.

Responsive sources per tile:
  <img srcset="{thumbUrl} 400w, {gridUrl} 900w"
       sizes="(max-width: 640px) 33vw, 320px"
       loading="lazy" decoding="async">
Phones stay on the small file; retina desktops get the sharp one.

Reserve space with aspect-ratio so the grid does not reflow as images
load. Show a subtle skeleton (surface colour, gentle pulse) until each
image decodes.

--- PER-TILE CONTROLS: HOVER VS TOUCH ---

CRITICAL: hover does not exist on touch devices, and mobile is the
primary use case. Do not build a hover-only interaction and let it
degrade. Implement two distinct behaviours switched with
@media (hover: hover) and (pointer: fine) — not by screen width, so
touch laptops behave correctly.

DESKTOP (hover-capable):
  Tiles show only the image and the product code pill at rest.
  On hover, fade in over 120ms: a subtle dark scrim across the lower
  half, and two circular 40px buttons side by side in the bottom-right
  — a download icon and a checkmark icon — as dark translucent circles
  with light icons, lifting to the accent colour on their own hover.
  Already-selected tiles keep their accent border and filled checkbox
  visible at rest, so selection is readable without hovering across the
  whole grid.

MOBILE (touch):
  Controls are ALWAYS visible, never hover-revealed:
    - 32px circular checkbox top-right, 44px invisible tap target,
      over a small dark scrim so it reads against light images
    - 32px circular download button bottom-right, same treatment
  Keep them cornered and small so they never obscure the garment.

BOTH:
  Tapping or clicking the image itself (outside those targets) opens
  the lightbox. The two buttons call stopPropagation so they act
  without opening it.
  Product code pill bottom-left, monospace, dark translucent, rendered
  only when a product code exists.
  Locked images keep the dimmed treatment with a lock badge, no
  checkbox and no download button; tapping still opens the
  preview-only lightbox.

--- SINGLE-IMAGE DOWNLOAD ---

The per-tile download button downloads just that image, using the
stored size preference silently if one exists, otherwise opening the
size sheet first.
Confirmation is inline: the button briefly swaps its icon for a
checkmark and returns after 1.5s. No toast, no modal.

--- HEADER CONTROLS ---

In the sticky collection header, on the right, two quiet text buttons
separated by a dot: "Επιλογή όλων" · "Καθαρισμός".
"Επιλογή όλων" selects only images the buyer can actually download — it
must skip locked images rather than selecting them and silently
dropping them at download time.
When everything selectable is already selected, the first button
switches to "Αποεπιλογή όλων". Both are disabled and dimmed when there
is nothing selectable.

--- FLOATING SELECTION BAR ---

Replace the full-width bottom bar with a floating pill, horizontally
centred, above the safe-area inset with 16px margin. It floats over the
grid rather than spanning the width, so it feels lighter and does not
cut the layout in half. Raised surface, fully rounded, subtle border,
soft shadow.

Contents left to right:
  - count in medium weight: "12 επιλεγμένες"
  - a muted separator dot
  - live estimated total for the CURRENTLY CHOSEN variant, computed
    from web_bytes / full_bytes: "περίπου 7 MB"
  - a small chevron beside the size that reopens the size sheet, so the
    buyer can switch resolution and watch the estimate change without
    leaving the grid
  - a solid accent "Λήψη" button
  - a quiet X to clear the selection

Animates up on first selection and down when the selection empties,
about 180ms, respecting prefers-reduced-motion.
On very narrow screens, if the content would overflow, drop the
separator dot and shorten the count to the number plus an icon — never
let the bar wrap to two lines.

--- LIGHTBOX ---

Full-screen, dark. This is where a buyer actually decides.
  - Loads webUrl, never full-res
  - Horizontal swipe moves between images; arrow keys do the same on
    desktop
  - Pinch to zoom and drag to pan; double-tap toggles fit and 2x
  - Chrome: close button top-right, product code and position ("7 / 42")
    top-left, and a select/deselect pill bottom-centre
  - Chrome auto-hides after 3s of no interaction, reappears on tap
  - Preload the adjacent two images so swiping feels instant
  - overscroll-behavior: contain so it does not scroll the page beneath

--- MOBILE POLISH ---

  - Sticky header uses env(safe-area-inset-top); the floating bar uses
    env(safe-area-inset-bottom)
  - The header condenses on scroll (collection name shrinks, buyer name
    hides) to give the grid more room
  - touch-action: manipulation on tappable elements to remove the 300ms
    tap delay
  - user-select: none on tiles to prevent accidental text selection on
    rapid tapping
  - All animations respect prefers-reduced-motion

--- ACCESSIBILITY ---

Both per-tile buttons need aria-labels including the product code:
"Λήψη DRESS-114", "Επιλογή DRESS-114". Selection state exposed with
aria-pressed. The grid is keyboard navigable with arrow keys, Enter
opens the lightbox, Space toggles selection.

Everything stays vanilla JS and plain CSS — no framework, no build step.
```

---

## Prompt 27 — Smoke test για τη Φάση Ζ

```
Extend test/smoke.js with a third block. Keep all existing assertions.

Grid variant:
  - after uploading, every image row has a non-null grid_path and a
    non-zero grid_bytes
  - the gallery API returns gridUrl for every visible image
  - after a retention purge, grid files still exist on disk and
    grid_path is unchanged — only full was removed

Download size:
  - ?size=web returns a smaller file than ?size=full for the same image
  - ?size=thumb is rejected with 400
  - ?size=../../etc/passwd is rejected with 400 and never touches the
    filesystem
  - a zip with size='web' is substantially smaller than the same
    selection with size='full'
  - requesting size='full' on a purged image returns 200 with the web
    variant and a "-web" filename, not an error
  - download_log records the variant used

Print PASS/FAIL per assertion.
```

---

## Πώς το τρέχεις τοπικά

```bash
# 1. Χτίσε το image του product (μία φορά, και ξανά μετά από αλλαγές)
cd photodelivery
docker build -t photodelivery:latest .

# 2. Τρέξε το meta-admin
cd ../meta-admin
META_ADMIN_PASSWORD=mysecret node server.js
```

Άνοιξε `http://localhost:4000`, πάτα **New instance**, συμπλήρωσε στοιχεία, **Create**. Σε ~15 δευτερόλεπτα έχεις νέο container με το λογότυπο και τα χρώματα του πελάτη. Στο Docker Desktop τα βλέπεις όλα ζωντανά με τα logs τους.

---

## Σειρά με μια ματιά

| # | Τι χτίζει | Πού |
|---|---|---|
| 1–2 | Setup, schema | `photodelivery/` |
| 3–6 | Εικόνες, Excel, τηλέφωνα/κωδικοί, messaging | `lib/` |
| 7–8 | Access control, rate limiting | `lib/` |
| 9–11 | Admin API, Customer API, server | `routes/` |
| 12–13 | Admin panel, customer app | `public/` |
| 14 | Smoke test | `test/` |
| 15–16 | White-label, Docker | `photodelivery/` |
| 17–19 | Meta-admin provisioner | `meta-admin/` |
| 20 | Ορατότητα συλλογής ανά πελάτη | `photodelivery/` |
| 21 | Storage tracking & retention | `photodelivery/` |
| 22 | Smoke test επεκτάσεων | `photodelivery/test/` |
| 23 | Μετονομασία σε Kollekta | `photodelivery/` |
| 24 | Grid variant 900px + backfill | `photodelivery/` |
| 25 | Επιλογή μεγέθους λήψης | `photodelivery/` |
| 26 | Επανασχεδίαση gallery | `public/app/` |
| 27 | Smoke test Φάσης Ζ | `photodelivery/test/` |

Μετά το **14** έχεις λειτουργικό προϊόν. Μετά το **16** έχεις image για πολλαπλά instances. Μετά το **19** έχεις provisioning με ένα κλικ. Τα **20–27** είναι προσθετικά και τρέχουν όποτε τα χρειαστείς.

---

## Τι πρέπει να ελέγξεις με το χέρι

**`lib/access.js`** — το μόνο αρχείο που αξίζει να διαβάσεις γραμμή προς γραμμή. Είναι το μόνο πράγμα ανάμεσα στον πελάτη Α και τις φωτογραφίες του πελάτη Β.

**Ο έλεγχος ορατότητας πρέπει να είναι στο `getCollectionContext`, όχι μόνο στο `listVisibleCollections`.** Είναι το πιο πιθανό λάθος που θα κάνει το Cursor στο prompt 20: φιλτράρει σωστά τη λίστα, αλλά αφήνει τον πελάτη να φτάσει σε περιορισμένη συλλογή γράφοντας το id απευθείας στο URL. Το test στο prompt 22 το πιάνει — τρέξ' το.

**Timing-safe σύγκριση κωδικού** — αν το Cursor γράψει `if (input === stored)`, ζήτα του `crypto.timingSafeEqual`.

**Το `/auth/reset` πρέπει να επιστρέφει ακριβώς το ίδιο σώμα απάντησης** για καταχωρημένο και μη καταχωρημένο νούμερο — ίδιο status, ίδιο κείμενο. Αν διαφέρει έστω κατά κάτι, κάποιος μπορεί να χαρτογραφήσει το πελατολόγιο δοκιμάζοντας νούμερα.

**`archiver@7.0.1` pinned** — αν το Cursor το αλλάξει σε `^8`, βάλ' το πίσω. Η 8.0.0 έσπασε το `require()`.

---

## Πριν πας production

Επειδή οι κωδικοί πάνε **πρώτα με email**, το domain αποστολής χρειάζεται σωστά **SPF, DKIM και DMARC** records, και τα emails πρέπει να φεύγουν από domain της εταιρείας — όχι από generic Gmail. Αλλιώς οι κωδικοί καταλήγουν στα ανεπιθύμητα και οι πελάτες θα λένε ότι δεν έλαβαν τίποτα.

Για server deployment θα χρειαστείς επιπλέον: VPS με Docker και Nginx, domain με wildcard DNS, wildcard SSL certificate, και ένα ακόμα prompt για `nginxManager.js` που γράφει vhost ανά subdomain. Μην το πιάσεις πριν δουλέψει όλη η ροή τοπικά.
