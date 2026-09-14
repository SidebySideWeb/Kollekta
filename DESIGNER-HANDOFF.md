# Kollekta — Designer handoff

Inventory of **live** frontend screens, structure, fields, and flows.  
Source of truth: `public/admin/` (admin) and `public/app/` (customer).  
Greek copy below matches the product UI.

There are **two products in one codebase**:

| App | Who | Entry |
|-----|-----|--------|
| Admin | Wholesaler staff | `/admin/login.html` → `/admin/` |
| Customer | Buyers / retailers | `/app/login` → `/app` → `/app/c/:id` |

Design tokens / mocks (reference only, not live routes): `design/`, `fashion_images_media_portal/`.

---

## Product context (one paragraph)

Kollekta lets a brand publish photo collections to wholesale customers. Admins upload images, optionally map product codes and orders, publish, and manage customers. Customers log in with phone + access code, browse collections, select images, and download (web or full-res). Plans gate advanced admin steps (mapping, orders, tags, retention overrides); customer gallery still works on Basic.

---

# A. Admin portal

**Chrome model:** SPA after login. Top nav switches views (no URL per view). Login is a separate HTML page.

**Plan UI rule:** Plan name is never shown. Features appear/disappear. On Basic, wizard is essentially **Upload → Publish**; Pro/Business add mapping, orders, visibility/tags, retention controls.

---

## Global chrome (all authenticated admin views)

### Top bar
- Brand: logo **or** company/product name (fallback «Kollekta»)
- Nav: **Συλλογές** · **Πελάτες** · **Μηνύματα** · **Χώρος** · **Διαχειριστές** (only for superadmin)
- Actions: **Κωδικός** · **Αποσύνδεση**

### Quota banner (conditional)
- Warning: space running out (% used) — archive or upgrade
- Full: space exhausted — uploads blocked

### Toast dialog
Title + message + **OK**

### Change-password modal
- **Τρέχων κωδικός**
- **Νέος κωδικός** / **Επιβεβαίωση νέου κωδικού** (min 8)
- **Ακύρωση** · **Αποθήκευση**

### Upload overlay
Full-screen spinner + progress («Ανέβασμα…», ETA). Blocks navigation while uploading.

### Bulk bar (Customers only, when rows selected)
`{n} επιλεγμένοι` · **Επαναποστολή κωδικού** · **Απενεργοποίηση** · **Tags** (Pro+) · **Διαγραφή**

### Image gallery modal (from collection wizard)
**Εικόνες συλλογής** — select thumbs → **Διαγραφή επιλεγμένων**

---

## A1. Admin login — `/admin/login.html`

**Purpose:** Staff sign-in and password reset.

### Structure
Centered login card on full page.

### Panel — Login
| Element | Copy / notes |
|---------|----------------|
| Title | Company name / «Kollekta» |
| Subtitle | Σύνδεση διαχειριστή |
| Email | Label + placeholder `name@company.com` |
| Password | Κωδικός πρόσβασης |
| Primary | Σύνδεση |
| Link | Ξέχασα τον κωδικό μου (if reset available) |
| Error | Λάθος email ή κωδικός. |

### Panel — Forgot
Email → **Αποστολή κωδικού** · back to login

### Panel — Reset
Email · reset code · new password · confirm → **Ορισμός νέου κωδικού**

### Flow
```
Login ──success──► /admin/ (Συλλογές)
  └─ Forgot ──► Reset ──► Login
```

---

## A2. Συλλογές — list

**Reach:** Default after login · nav **Συλλογές**

### Structure
Toolbar → optional create form → card grid

### UI
- **Νέα συλλογή** → field **Όνομα συλλογής** · **Δημιουργία** / **Ακύρωση**
- Card: name · status pill (`draft` / `published`) · `{n} εικόνες · date`
- Empty: Δεν υπάρχουν συλλογές.

### Flow
Create → list refresh · Click card → collection wizard

---

## A3. Συλλογή — wizard / detail

**Reach:** Open a collection card

### Structure
**← Πίσω** · collection title · stacked numbered step cards

Leaving during upload asks for confirmation.

### Steps (by plan)

| # (Basic) | # (Pro+) | Step | Fields / actions |
|-----------|----------|------|------------------|
| 1 | 1 | **Φωτογραφίες συλλογής** | Quality: Βελτιστοποιημένο / Πλήρης ανάλυση · pick files · Ανέβασμα · thumb summary · Προβολή & διαχείριση |
| — | 2 | **Αντιστοίχιση κωδικών** (optional) | Excel upload · sample / export links |
| — | 3 | **Παραγγελίες** (optional) | Excel upload · sample / export |
| — | 4 | **Ορατότητα** | Όλοι οι πελάτες / Επιλεγμένα tags · tag chips · reach count · Αποθήκευση ορατότητας |
| 2 | 5 | **Δημοσίευση** | Summary · Ειδοποίηση πελατών με email · Δημοσίευση / Απόσυρση |
| — | 6 | **Διατήρηση full-res** (Pro+) | Months override · Καρφίτσωμα · Αποθήκευση |

**Basic only — quiet upgrade line under wizard:**  
«Θέλεις κάθε πελάτης να βλέπει μόνο τα προϊόντα της παραγγελίας του;» + contact link

**Conditional amber note:** if full-res purge is within 30 days — exact date + short explanation.

### Publish summary rows
- Always: Εικόνες count
- Pro+: Φιλτράρισμα παραγγελίας (Ενεργό/Ανενεργό), Ορατότητα reach

### Flow
```
Upload → (map) → (orders) → (visibility) → Publish
                └─ retention override (Pro+)
← Πίσω → list
```

---

## A4. Πελάτες

### Structure
Header · toolbar · create form · import · filters · table · bulk chrome

### Toolbar
**Δείγμα Excel** · **Εισαγωγή Excel** · **Νέος πελάτης**

### New customer fields
| Field | Notes |
|-------|--------|
| Όνομα * | required |
| Κινητό * | required |
| Email | optional |
| ERP κωδικός | optional |
| Πρόσβαση | Pro+: Πλήρης / Περιήγηση+λήψη / Μόνο παραγγελία |
| Κανάλι | Email / Αυτόματο / Viber / WhatsApp / SMS |
| Αποστολή κωδικού | checkbox |

Result: created name · revealed code · **Αντιγραφή** · send status

### Filters
Search · tag filter (Pro+) · status (Ενεργός / Ανενεργός)

### Table columns
Checkbox · Όνομα · Τηλέφωνο · Email · Κατάσταση · **Πρόσβαση** (Pro+) · Κανάλι · **Tags** (Pro+) · Ενέργειες

### Row actions
Επαναποστολή · Νέος κωδικός · Απενεργοποίηση · Διαγραφή

### Flow
```
Create / Import → list
Select rows → bulk resend / disable / tags / delete
```

---

## A5. Μηνύματα

Read-only log (last 200).

**Columns:** Ημ/νία · Πελάτης · Προορισμός · Κανάλι · Είδος · Κατάσταση  

**Είδος examples:** Καλωσόρισμα · Επαναφορά · Νέα συλλογή  
**Κατάσταση:** Στάλθηκε · Απέτυχε

---

## A6. Χώρος αποθήκευσης

### Structure
Usage overview · 30-day trend · retention policy line · purge candidates · per-collection table

### Retention line (plain text)
- Fixed months: «Τα αρχεία πλήρους ανάλυσης διατηρούνται {n} μήνες. Μετά, οι συλλογές παραμένουν ορατές σε ανάλυση web.»
- Business: «…διατηρούνται μόνιμα.»

### Table
Συλλογή · Εικόνες · Full · Web · Thumb · Σύνολο · **Αρχειοθέτηση** (published)

---

## A7. Διαχειριστές (superadmin only)

### Form
Όνομα (optional) · Email · Αρχικός κωδικός · **Προσθήκη**

### Table
Όνομα (badges: superadmin / εσύ) · Email · Διαγραφή

---

## Admin feature matrix (what to hide, not disable)

| Feature | Basic | Pro / Business |
|---------|-------|----------------|
| Mapping step | hidden | shown |
| Orders step | hidden | shown |
| Visibility / tags | hidden | shown |
| Customer access column | hidden | shown |
| Customer tags column / bulk tags | hidden | shown |
| Retention override + pin | hidden | shown |
| Upgrade hint under wizard | shown | hidden |

---

# B. Customer portal

**Chrome model:** Client-side routes in one SPA. Dark “Atelier” look. Branding from API (logo, name, accent, optional footer).

| Path | Screen |
|------|--------|
| `/app/login` | Login + forgot password |
| `/app` | Collections list |
| `/app/c/:id` | Gallery + overlays |

---

## B1. Login — `/app/login`

### Structure
Centered card · brand (logo **or** H1 company / «Kollekta»)

### Fields
| Element | Copy |
|---------|------|
| Phone | Κινητό τηλέφωνο · placeholder «69…» |
| Code | Κωδικός πρόσβασης · uppercase |
| Primary | Σύνδεση |
| Link | Ξέχασα τον κωδικό μου |

Errors: wrong creds · rate limit message

### Forgot (same URL, swapped panel)
Intro privacy text · phone · **Αποστολή νέου κωδικού** · **← Επιστροφή στη σύνδεση**

### Flow
```
Login ──► /app
Forgot ──► Reset form ──► Login
```

---

## B2. Συλλογές — `/app`

### Header
Logo (if any) · **Συλλογές** · customer name · **Νέος κωδικός** · **Αποσύνδεση**

### Body
Card grid (1 → 2 → 3 columns by breakpoint)

**Card:** cover or «Χωρίς εξώφυλλο» · name · `{date} · {n} εικόνες`

Empty: Δεν υπάρχουν δημοσιευμένες συλλογές ακόμα.

### Flow
```
Card ──► /app/c/:id
Νέος κωδικός ──confirm──► logout → login
Αποσύνδεση ──► login
```

---

## B3. Gallery — `/app/c/:id`

### Header
**←** back · logo · collection name · **Επιλογή όλων** · **Καθαρισμός**

### Optional banner
«Αρχειοθετημένη συλλογή — οι εικόνες είναι σε ανάλυση web.»

### Grid tiles
| Downloadable | Locked (not in order) |
|--------------|------------------------|
| Thumb · optional product code | Dimmed thumb · lock |
| **Επιλογή** · **Λήψη** | Tap → preview lightbox only |

### Selection bar (when ≥1 selected)
Count («N επιλεγμένες») · size estimate · **Λήψη** · size chevron · dismiss

### Download size sheet
Title **Μέγεθος λήψης**
- **Για eshop και social media** (+ size)
- **Για εκτύπωση και καταλόγους** (+ size; hidden if full purged)
- Checkbox **Να θυμάσαι την επιλογή μου**

### Locked lightbox
Image + caption: **Δεν είναι μέρος της παραγγελίας σου — μόνο προεπισκόπηση.**

### Flow
```
/app/c/:id
  ├─ select → bar → Λήψη → size sheet → download (files or zip)
  ├─ tile Λήψη → size sheet (or direct web if archived)
  ├─ locked tile → lightbox
  └─ ← → /app
```

---

# C. End-to-end flows (designer storyboards)

## 1. First publish (Basic)
Admin login → Συλλογές → Νέα συλλογή → Upload photos → Publish (optional email notify) → Customer sees collection → select → download web/full

## 2. Order-filtered publish (Pro)
Upload → Map codes Excel → Orders Excel → Publish → Customer with «μόνο παραγγελία» sees subset; locked tiles preview-only

## 3. Tag-restricted publish (Pro)
Customers get tags → Collection visibility = selected tags → Only matching customers see it in list

## 4. Storage / retention
Χώρος shows policy line → near purge date, collection shows amber note → optional Αρχειοθέτηση → customer still browses web-res

## 5. Customer access recovery
Login → Ξέχασα… → new code by SMS/email/Viber · or from collections header **Νέος κωδικός**

---

# D. What not to invent

Not in the live product today:
- Admin SMTP / billing / settings screens
- Customer account/profile page
- Search/filter on customer collections
- Lightbox for downloadable (unlocked) images
- Light mode for customer app
- Separate URL per admin view

---

# E. Asset / mock mapping (optional)

| Mock folder | Live screen |
|-------------|-------------|
| `admin_login`, `login_reset` | Admin login |
| `collections_list_*` | Admin collections list |
| `collection_wizard`, `visibility_tags`, `publish_confirmation` | Admin wizard |
| `admin_1`, `admin_2` | Customers (+ bulk) |
| `admin_3` | Messages |
| `admin_4` | Storage |
| `collection_gallery*`, `lightbox_view`, `download_options` | Customer gallery |

---

*Generated for design handoff from the Kollekta codebase. Prefer this doc + live `/admin` and `/app` over outdated mocks when they disagree.*
