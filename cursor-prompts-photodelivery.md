# Photo Delivery — Πλήρης οδηγός χτισίματος με Cursor

Οδηγός βήμα-βήμα. Κάθε prompt δίνεται σε ξεχωριστό μήνυμα στο Cursor (Agent mode / Composer), με τη σειρά. Μην τα δίνεις όλα μαζί.

Τα prompts είναι στα αγγλικά επίτηδες — το Cursor δουλεύει σημαντικά καλύτερα έτσι.

---

## Πριν ξεκινήσεις

1. Φτιάξε έναν άδειο φάκελο, π.χ. `photodelivery/`
2. Άνοιξέ τον στο Cursor (`File → Open Folder`)
3. Άνοιξε το Composer με `Cmd/Ctrl + I` και βάλε το σε **Agent mode** (ώστε να δημιουργεί αρχεία μόνο του)
4. Βεβαιώσου ότι έχεις Node.js 20+ (`node --version` στο terminal)

**Μετά από κάθε prompt**: κοίτα τι αρχεία δημιούργησε, και αν κάτι δεν βγάζει νόημα, ρώτα το Cursor πριν προχωρήσεις στο επόμενο.

---

# ΦΑΣΗ Α — Το βασικό προϊόν (single-tenant)

## Prompt 1 — Project setup

```
Create a Node.js project in this folder. No frontend framework, no build 
step, no TypeScript — plain CommonJS Node with Express and vanilla 
JS/HTML/CSS on the frontend.

Run npm init and install exactly these:
express, better-sqlite3, multer, sharp, xlsx, uuid, archiver@7.0.1

IMPORTANT: pin archiver to exactly 7.0.1. Do not install 8.x — version 
8.0.0 switched to ESM-only exports and breaks require('archiver') in a 
CommonJS project.

Create this folder structure:
  routes/
  public/admin/
  public/gallery/
  data/
  uploads/

Add a .gitignore excluding: node_modules, data/*.db*, uploads/*, .env

In package.json set "main": "server.js" and add a start script: 
"start": "node server.js"
```

---

## Prompt 2 — Database schema

```
Create db.js using better-sqlite3. Open data/app.db and enable WAL mode.

Create these tables if they don't exist:

collections
  id INTEGER PRIMARY KEY AUTOINCREMENT
  name TEXT NOT NULL
  created_at TEXT DEFAULT CURRENT_TIMESTAMP

images
  id INTEGER PRIMARY KEY AUTOINCREMENT
  collection_id INTEGER NOT NULL
  original_filename TEXT NOT NULL
  product_code TEXT
  full_path TEXT NOT NULL
  web_path TEXT NOT NULL
  thumb_path TEXT NOT NULL
  created_at TEXT DEFAULT CURRENT_TIMESTAMP

customers
  id INTEGER PRIMARY KEY AUTOINCREMENT
  erp_code TEXT
  name TEXT
  email TEXT
  phone TEXT
  default_access_mode TEXT DEFAULT 'order_only'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP

order_items
  id INTEGER PRIMARY KEY AUTOINCREMENT
  collection_id INTEGER NOT NULL
  customer_id INTEGER NOT NULL
  product_code TEXT NOT NULL

access_links
  id INTEGER PRIMARY KEY AUTOINCREMENT
  token TEXT UNIQUE NOT NULL
  collection_id INTEGER NOT NULL
  customer_id INTEGER NOT NULL
  access_mode TEXT NOT NULL DEFAULT 'order_only'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
  last_viewed_at TEXT

download_log
  id INTEGER PRIMARY KEY AUTOINCREMENT
  access_link_id INTEGER NOT NULL
  image_id INTEGER NOT NULL
  downloaded_at TEXT DEFAULT CURRENT_TIMESTAMP

Add foreign keys where appropriate, and these indexes:
  images(collection_id)
  images(collection_id, product_code)
  order_items(collection_id, customer_id)
  access_links(token)

Export the db instance.
```

---

## Prompt 3 — Image processing

```
Create imageProcessor.js exporting an async function:

  processImage(inputBuffer, collectionId, baseFilename)

It uses sharp to write three JPEG variants into 
uploads/{collectionId}/{full,web,thumb}/:

  full  — original resolution, quality 92
  web   — max width 1600, quality 85, withoutEnlargement: true
  thumb — max width 400, quality 80, withoutEnlargement: true

Sanitize the filename: strip everything except alphanumerics, dots, 
underscores and hyphens. Force a .jpg extension on the output 
regardless of input format (so a .png or .heic input still produces 
.jpg outputs).

Create the directories with fs.mkdirSync({ recursive: true }) if missing.

Return an object with the three paths, relative to the uploads/ folder:
  { fullPath, webPath, thumbPath }
```

---

## Prompt 4 — Excel parsing

```
Create excelParser.js using the xlsx library. Export three functions, 
each taking a Buffer and returning an array of normalized rows.

All column matching must be case-insensitive substring matching on the 
header names, so that both Greek and English headers work.

parseImageMapping(buffer)
  filename column: header contains 'filename' or 'εικόνα' or 'αρχείο'
  product code column: header contains 'product' or 'κωδικ'
  returns [{ filename, productCode }]

parseCustomers(buffer)
  erp code:  'erp' or 'κωδικ'
  name:      'name' or 'όνομα' or 'ονομα'
  email:     'email' or 'mail'
  phone:     'phone' or 'whatsapp' or 'τηλ'
  access mode: 'access' or 'mode' or 'πρόσβαση' or 'προσβαση'
  Validate access mode against ('order_only', 
  'browse_all_download_order', 'full_access') — anything else or 
  missing becomes 'order_only'.
  Skip rows that have none of erp code, email, or phone.
  returns [{ erpCode, name, email, phone, accessMode }]

parseOrders(buffer)
  identifier column: 'erp' or 'email' or 'πελ'
  product code column: 'product' or 'κωδικ'
  returns [{ identifier, productCode }]

Trim all values and skip rows where a required field is empty.
```

---

## Prompt 5 — Access control logic

```
Create access.js — this is the security core of the application. 
Export three functions.

getContext(token)
  Look up the access_link row by token. If not found, return null.
  Join the collection and the customer.
  Compute a Set of product_codes from that customer's order_items 
  in that collection.
  Return { link, collection, customer, orderedCodes }

canView(ctx, image)
  If ctx.link.access_mode === 'order_only', return true only if 
  ctx.orderedCodes has image.product_code.
  Otherwise return true (both browse_all_download_order and 
  full_access can view everything).

canDownload(ctx, image)
  If ctx.link.access_mode === 'full_access', return true.
  Otherwise return true only if ctx.orderedCodes has 
  image.product_code.

These two predicates are the single source of truth for authorization. 
Every route that serves image data or files must call them. Never trust 
any permission flag coming from the client.
```

---

## Prompt 6 — Admin API routes

```
Create routes/admin.js as an Express router. Use multer with 
memoryStorage, limit 50MB per file. Use db.js, imageProcessor.js and 
excelParser.js.

POST /collections
  body { name } — create a collection, return { id, name }

GET /collections
  list all, newest first

GET /collections/:id
  collection detail plus its images (id, original_filename, 
  product_code, thumb_path) and a count of generated access links

POST /collections/:id/images
  multer.array('images', 500)
  For each file: call processImage, insert an images row.
  Return { uploaded, results } where results has per-file 
  { filename, ok, error? } so partial failures are visible.

POST /collections/:id/mapping
  multer.single('mapping')
  Parse with parseImageMapping.
  For each row, UPDATE images SET product_code = ? WHERE 
  collection_id = ? AND original_filename = ?
  Track which rows matched (changes > 0) and which didn't.
  Return { matchedCount, unmatchedCount, matched, unmatched }

POST /customers/upload
  multer.single('customers')
  Parse with parseCustomers, insert rows into customers.
  Return { created }

GET /customers
  list all

POST /collections/:id/orders
  multer.single('orders')
  Parse with parseOrders. For each row, resolve the identifier against 
  customers.erp_code OR customers.email. If resolved, insert an 
  order_items row. If not, collect it as unresolved.
  Return { inserted, unresolvedCount, unresolved }

POST /collections/:id/links
  body { forceAccessMode? }
  Find all distinct customer_ids that have order_items in this 
  collection. If none, return 400 with a clear Greek error message.
  For each customer: generate a token as uuidv4() with dashes stripped, 
  sliced to 12 chars. Use forceAccessMode if provided, otherwise that 
  customer's default_access_mode. Insert into access_links.
  Return { generated, links } where each link is 
  { token, customer: {id, name, email, phone}, accessMode, 
    url: '/g/' + token }

POST /customers/:customerId/collections/:collectionId/link
  Manually create a single link for one customer, with an explicit 
  accessMode in the body. Useful for customers with no order.

All error responses should have Greek messages in an { error } field.
Export the router.
```

---

## Prompt 7 — Customer-facing API routes

```
Create routes/customer.js as an Express router, using access.js.

GET /gallery/:token
  ctx = getContext(token); 404 with Greek message if null.
  Update access_links.last_viewed_at.
  Fetch all images in the collection, filter by canView.
  Return {
    collectionName, customerName, accessMode,
    images: [{ id, productCode, thumbUrl, webUrl, downloadable }]
  }
  where thumbUrl/webUrl point at the image-serving route below and 
  downloadable comes from canDownload.

GET /gallery/:token/image/:imageId/:variant
  variant must be 'thumb' or 'web' — reject anything else with 400.
  Check canView before serving. 403 if not permitted, 404 if the token 
  or image is invalid or the file is missing on disk.
  Serve with res.sendFile.

GET /gallery/:token/download/:imageId
  Check canDownload. If false, 403 with a Greek message.
  Insert a download_log row, then res.download() the full-res file 
  using the original filename.

POST /gallery/:token/download-zip
  body { imageIds: number[] }
  Look up each id scoped to this collection, filter to only those where 
  canDownload is true. Silently drop the rest — only return 403 if the 
  resulting list is empty.
  Set res.attachment with the collection name + .zip
  Stream a zip with archiver('zip', { zlib: { level: 6 } }) piped to 
  the response, adding each file under its original filename, and 
  logging each one to download_log.

Export the router.
```

---

## Prompt 8 — Server wiring

```
Create server.js:

  express app with express.json() and express.urlencoded({extended:true})
  mount routes/admin.js at /api/admin
  mount routes/customer.js at /api
  serve public/admin as static at /admin
  GET /g/:token  → sendFile public/gallery/index.html 
                   (the page reads the token from the URL itself)
  serve public/gallery as static at /gallery-assets
  GET / → redirect to /admin
  listen on process.env.PORT || 3000, logging the admin URL on startup
```

At this point run `npm start` and confirm you see the startup log with no errors.

---

## Prompt 9 — Admin panel UI

```
Build the admin panel as three plain files in public/admin/: 
index.html, style.css, app.js. No framework, no build step, no CDN 
dependencies.

Design tokens as CSS variables (dark theme):
  --bg: #14141a
  --surface: #1e1e26
  --surface-raised: #26262f
  --border: #302f3a
  --border-strong: #423f52
  --text: #f0efec
  --text-dim: #a5a3ae
  --text-faint: #706e7a
  --accent: #8b7bf0
  --accent-dim: #4a4270
  --success: #5cb896
  --danger: #d97070
Monospace font stack for product codes, IDs and URLs; system sans for 
everything else. Flat design, 8px radius, generous spacing, no 
gradients or heavy shadows. Utilitarian, not decorative.

Two views inside the same page (toggle visibility, no router):

VIEW 1 — Collections list
  Header with a "Νέα συλλογή" button that reveals an inline form 
  (text input + create + cancel). List of collections as cards showing 
  name and id, clickable to open the detail view.

VIEW 2 — Collection detail
  Back button + collection name.
  A vertical 5-step wizard, each step a card with a numbered circle, 
  title, short Greek description, file input, action button and a 
  status line underneath that turns green on success and red on error:

  1. Φωτογραφίες συλλογής — multi-file image input → 
     POST /api/admin/collections/:id/images
     Status shows how many uploaded.
  2. Αντιστοίχιση με κωδικό προϊόντος — Excel input →
     POST /api/admin/collections/:id/mapping
     Status shows matched / unmatched counts.
  3. Λίστα πελατών — Excel input →
     POST /api/admin/customers/upload
     Status shows how many customers created.
  4. Παραγγελίες — Excel input →
     POST /api/admin/collections/:id/orders
     Status shows inserted count and unresolved count.
  5. Δημιουργία links — a select to optionally force one access mode 
     for the whole batch (empty = use each customer's default), plus a 
     generate button → POST /api/admin/collections/:id/links

  Below the wizard, a results table appears after generating links:
  columns for customer name, contact (email or phone), access mode as a 
  small pill, the full absolute URL in monospace, and a copy button 
  using navigator.clipboard.

Each step card should mention the expected Excel column names in its 
description, styled as inline code.

Escape all user-supplied strings before inserting into innerHTML.
```

---

## Prompt 10 — Customer gallery UI (mobile-first)

```
Build the customer-facing gallery as three files in public/gallery/: 
index.html, style.css, app.js. Mobile-first, no framework, no build step.

Same dark palette as the admin panel.

On load: read the token from the URL path (/g/{token}) and fetch 
/api/gallery/{token}.

Layout:
  Sticky header — collection name, and below it the customer name 
  as "Για {name}".
  
  If accessMode is 'browse_all_download_order', show a hint banner: 
  "Βλέπεις όλη τη συλλογή. Μπορείς να κατεβάσεις μόνο τα προϊόντα 
  της παραγγελίας σου."
  
  A CSS grid of square thumbnails: 3 columns on mobile, 4 above 560px, 
  6 above 860px. Small gaps (3px mobile, 6px larger).
  
  Each thumbnail:
    - loads the thumbUrl with loading="lazy"
    - shows the product code as a small monospace tag bottom-left
    - if downloadable: a circular checkmark toggle top-right; tapping 
      the thumbnail selects/deselects it (accent border + filled check)
    - if not downloadable: dimmed to 35% opacity with a lock icon 
      top-left; tapping opens a preview-only lightbox showing the 
      webUrl (never the full-res) with the caption "Δεν είναι μέρος 
      της παραγγελίας σου — μόνο προεπισκόπηση."
  
  Empty state if there are no visible images.
  
  A fixed bottom action bar, hidden until at least one image is 
  selected, showing "{n} επιλεγμένα", a "Καθαρισμός" secondary button 
  and a "Λήψη" primary button.
  
  Download flow: POST the selected ids as JSON to 
  /api/gallery/{token}/download-zip, take the response as a blob, 
  create an object URL, trigger a temporary anchor click, revoke the 
  URL. Show "Προετοιμασία..." on the button while it runs and 
  re-enable it afterwards.

Minimum 44px tap targets. Handle an invalid token by showing an error 
message in the header instead of an empty grid.
```

---

## Prompt 11 — Smoke test

```
Create a script test/smoke.js that verifies the whole flow end to end 
against a locally running server on port 3000.

It should:

1. Generate 4 synthetic JPEG test images with sharp (solid colour 
   rectangles, 900x1200) into a temp folder.
2. Generate 3 test Excel files with the xlsx library:
   - mapping: IMG_001→DRESS-001, IMG_002→DRESS-002, 
     IMG_003→SHIRT-010, IMG_004→SHIRT-011
   - customers: three customers, one per access mode 
     (order_only, browse_all_download_order, full_access)
   - orders: customer 1 ordered DRESS-001; customer 2 ordered 
     SHIRT-010 and SHIRT-011; customer 3 ordered DRESS-001
3. Run the full admin flow with fetch: create collection → upload 
   images → upload mapping → upload customers → upload orders → 
   generate links.
4. For each generated link, fetch the gallery and print which product 
   codes that customer sees and which are downloadable.
5. Assert the security behaviour and print PASS/FAIL for each:
   - customer 1 (order_only) sees exactly 1 image
   - customer 2 (browse_all) sees 4 images but only 2 downloadable
   - customer 3 (full_access) sees 4 and all downloadable
   - a single-image download of an unowned image returns 403
   - a thumbnail request for an image outside an order_only 
     customer's order returns 403
   - a zip request mixing one authorized and one unauthorized id 
     returns a zip containing only the authorized file
   - an invalid token returns 404

Add "test": "node test/smoke.js" to package.json scripts.
```

Τρέξε: `npm start` σε ένα terminal, `npm test` σε άλλο. Πρέπει να δεις PASS παντού.

---

# ΦΑΣΗ Β — White-label & Docker

## Prompt 12 — White-label configuration

```
Add white-label branding so the same codebase can be deployed per 
customer with their own identity, configured entirely through 
environment variables.

Create config.js reading from process.env with sensible defaults:
  COMPANY_NAME     (default 'Photo Delivery')
  COMPANY_PHONE
  COMPANY_EMAIL
  COMPANY_ADDRESS
  ACCENT_COLOR     (default '#8b7bf0')
  LOGO_PATH        (default null)
  ADMIN_PASSWORD   (required — refuse to start without it)
  FOOTER_TEXT

Add GET /api/branding to server.js returning the public-safe subset 
(everything except ADMIN_PASSWORD) as JSON.

Update both frontends to fetch /api/branding on load and apply it:
  - Set the CSS variable --accent from ACCENT_COLOR at runtime via 
    document.documentElement.style.setProperty
  - Show the logo image in the header if LOGO_PATH is set, otherwise 
    fall back to the text company name
  - Set document.title to the company name
  - In the customer gallery, add a footer with company name, phone, 
    email, address and footer text

Serve logo files as static from public/logo/ at /logo.

Add password protection for the admin panel:
  - A middleware in server.js that guards /admin and /api/admin
  - A simple login page at /admin/login.html (single password field, 
    dark themed, matching the design tokens)
  - POST /api/login compares against ADMIN_PASSWORD and sets an 
    httpOnly signed cookie on success
  - The customer routes (/g/:token and /api/gallery/*) must stay 
    completely public — never guard those

Add a .env.example documenting every variable.
```

---

## Prompt 13 — Dockerfile

```
Create a Dockerfile for this app:

FROM node:22-alpine
Install build dependencies needed by sharp and better-sqlite3 on 
alpine: vips-dev, python3, make, g++
WORKDIR /app
Copy package*.json first, run npm ci --omit=dev (so the layer caches)
Copy the rest of the source
Create the data, uploads and public/logo directories
EXPOSE 3000
CMD ["node", "server.js"]

Also create a .dockerignore excluding: node_modules, data, uploads, 
.env, *.log, test, .git

Then create a docker-compose.yml for local testing that:
  - builds this image
  - maps port 3000
  - mounts ./data and ./uploads as named volumes so data survives 
    container restarts
  - reads environment variables from a .env file

Add a short section to README.md explaining:
  docker compose up --build     (local test)
  docker build -t photodelivery:latest .   (build the image for 
  provisioning)
```

**Δοκιμή με το Docker Desktop σου:**

```bash
# στον φάκελο του project
docker build -t photodelivery:latest .
docker run -p 3000:3000 -e ADMIN_PASSWORD=test123 photodelivery:latest
```

Άνοιξε `http://localhost:3000/admin` — αν φορτώνει, το image είναι σωστό. Θα το δεις και στο Docker Desktop UI, στο tab Containers.

---

# ΦΑΣΗ Γ — Meta-admin provisioner

> Αυτό χτίζεται σε **ξεχωριστό φάκελο**, όχι μέσα στο photodelivery.
> Άνοιξε νέο φάκελο `meta-admin/` στο Cursor και συνέχισε εκεί.

## Prompt 14 — Meta-admin core

```
Create a separate Node.js/Express app that manages photodelivery Docker 
instances. It runs only on my own machine/server and is never exposed 
to customers.

npm install express better-sqlite3 uuid dockerode multer

db.js — SQLite at data/meta.db, one table:
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
  allocatePort() — returns the next free port starting from 3100, 
  based on the highest port currently in the instances table

dockerManager.js — use dockerode against the local Docker socket

  createInstance({subdomain, companyName, port, adminPassword, 
                  accentColor, logoFilename, phone, email, address})
    creates a container from image 'photodelivery:latest'
    name: 'pd_' + subdomain
    Env: COMPANY_NAME, ADMIN_PASSWORD, ACCENT_COLOR, COMPANY_PHONE, 
         COMPANY_EMAIL, COMPANY_ADDRESS, LOGO_PATH, PORT=3000
    PortBindings 3000/tcp → the allocated host port
    Binds three host folders for data, uploads and logos, namespaced 
    per subdomain
    RestartPolicy unless-stopped
    starts it and returns the container id

  stopInstance(id) / startInstance(id) / removeInstance(id)
  getContainerStatus(id) → 'running' | 'stopped' | 'missing'

logoManager.js
  uploadLogo(subdomain, buffer, originalFilename) — saves into the 
  per-subdomain logo folder, sanitizes the filename, returns it

Make the host folder root configurable via an env var 
(INSTANCE_DATA_ROOT), defaulting to ./instances so it works on a local 
machine with Docker Desktop as well as on a server.
```

---

## Prompt 15 — Meta-admin API & expiry

```
Add routes/api.js to the meta-admin app, with multer memoryStorage for 
the logo upload.

POST /instances
  multipart body: company_name, subdomain (optional — if empty, 
  slugify the company name: lowercase, spaces to hyphens, strip 
  non-alphanumerics), type ('demo'|'production'), accent_color, phone, 
  email, address, demo_hours (default 48, ignored for production), 
  logo file (optional)

  Steps, with rollback if any step fails:
    1. validate the subdomain is unique
    2. generate admin_password = uuidv4().slice(0,8)
    3. allocatePort()
    4. save the logo if provided
    5. dockerManager.createInstance(...)
    6. compute expires_at = now + demo_hours for demos, NULL for 
       production
    7. insert the row
  Return { subdomain, url, adminPassword, port, expiresAt }

GET /instances
  Return all rows, calling getContainerStatus for each and updating the 
  stored status if it drifted

POST /instances/:id/start
POST /instances/:id/stop
POST /instances/:id/promote   — sets type='production', expires_at=NULL
DELETE /instances/:id         — stops and removes the container, 
                                deletes the row (leave the data folders 
                                on disk, just warn in the response)

expireJob.js
  startExpireJob() — every 30 minutes, find demo instances whose 
  expires_at has passed and are still running, stop and remove their 
  containers, mark status='expired', log each action with a timestamp

server.js
  mounts /api, serves public/ statically, listens on port 4000
  HTTP Basic Auth middleware on every route, comparing against 
  process.env.META_ADMIN_PASSWORD
  calls startExpireJob() on startup

Note: this version does not touch Nginx — instances are reachable on 
localhost:{port} directly. Nginx/subdomain wiring comes later when 
deploying to a real server.
```

---

## Prompt 16 — Meta-admin dashboard UI

```
Build the meta-admin dashboard in public/ as plain index.html, 
style.css, app.js. Same dark design tokens as the main product.

Header: "Instance Manager" + a "New instance" button.

Instances table, columns:
  Subdomain — as a clickable link opening http://localhost:{port} 
              in a new tab
  Company
  Type — pill badge, amber for demo, teal for production
  Status — coloured dot: green running, grey stopped, red expired
  Expires — live countdown for demos ("47h 12m"), "—" for production
  Actions — Open, Start/Stop (whichever applies), Promote (demos only), 
            Delete (with a confirm)

"New instance" reveals an inline form (not a modal — position:fixed 
misbehaves in some embedded contexts):
  Company name (required)
  Subdomain (auto-filled by slugifying the company name as you type, 
             still editable)
  Type toggle: Demo / Production
  Demo duration in hours (visible only when Demo is selected, 
                          default 48)
  Logo file input (optional)
  Accent colour picker (default #8b7bf0)
  Phone, Email, Address
  Create button — shows a spinner, then reveals the result panel with 
  the URL and the generated admin password plus a copy button, with a 
  warning that the password is shown only once

Auto-refresh the table every 60 seconds. Update the countdowns every 
minute without refetching.
```

---

## Πώς το τρέχεις τοπικά (με Docker Desktop)

```bash
# 1. Χτίσε το image του product (μία φορά, και ξανά μετά από αλλαγές)
cd photodelivery
docker build -t photodelivery:latest .

# 2. Τρέξε το meta-admin
cd ../meta-admin
META_ADMIN_PASSWORD=mysecret node server.js
```

Άνοιξε `http://localhost:4000`, βάλε το password, πάτα **New instance**, συμπλήρωσε στοιχεία, **Create**.

Σε ~15 δευτερόλεπτα έχεις νέο container. Πατάς **Open** και ανοίγει στο `localhost:3100` (ή όποιο port δόθηκε) με το λογότυπο και τα χρώματα του πελάτη.

Στο Docker Desktop θα βλέπεις όλα τα containers ζωντανά, με τα logs τους — χρήσιμο για debugging.

---

## Τι μένει για production server

Όταν θελήσεις να το βγάλεις online (όχι localhost):

1. VPS με Ubuntu + Docker + Nginx
2. Domain με wildcard DNS (`*.yourdomain.gr` → IP)
3. Wildcard SSL certificate (certbot)
4. Ένα ακόμα prompt για `nginxManager.js` που γράφει vhost ανά subdomain και κάνει `nginx -s reload`

Αυτό είναι ξεχωριστό βήμα — μην το κάνεις πριν δουλέψει τοπικά όλη η ροή.

---

## Σειρά με μια ματιά

| # | Τι χτίζει | Πού |
|---|---|---|
| 1–8 | Backend: db, images, excel, access control, API, server | `photodelivery/` |
| 9–10 | Frontend: admin panel + customer gallery | `photodelivery/public/` |
| 11 | Smoke test όλης της ροής | `photodelivery/test/` |
| 12 | White-label branding + admin password | `photodelivery/` |
| 13 | Dockerfile + compose | `photodelivery/` |
| 14–16 | Meta-admin provisioner | `meta-admin/` |

Μετά το 11 έχεις **λειτουργικό προϊόν**. Μετά το 13 έχεις **image έτοιμο για πολλαπλά instances**. Μετά το 16 έχεις **provisioning με ένα κλικ**.
