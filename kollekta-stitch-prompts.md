# Kollekta — Google Stitch prompts

Το Stitch παράγει έως 5 συνδεδεμένες οθόνες ανά batch. Τέσσερα batches, με τη σειρά.

**Σημαντικό**: τρέξε τα με τη σειρά και στο ίδιο project ώστε να κρατηθεί η συνέπεια. Μετά το Batch A, κατέβασε το `DESIGN.md` που παράγει και βάλ' το στη ρίζα του `photodelivery/` repo — το Cursor το διαβάζει αυτόματα.

**Σημείωση για το branding**: το όνομα Kollekta εμφανίζεται μόνο στο admin panel και στο default (unbranded) login. Στα white-label instances ο αγοραστής βλέπει το λογότυπο του δικού του προμηθευτή. Γι' αυτό τα mockups του customer app δείχνουν generic placeholder logo, όχι το Kollekta.

---

## BATCH A — Customer app, βασική ροή (mobile, 5 οθόνες)

Η πιο σημαντική παρτίδα. Εδώ γίνεται το 90% της πραγματικής χρήσης.

```
Design a 5-screen connected mobile app. Context: a clothing wholesaler
publishes each new season's product photography; their retail buyers
open it on their phone to browse the collection and download the images
they need for their own eshop or printed catalogue.

The audience is fashion buyers, not consumers. They are examining
garments closely to decide what to stock. Images must dominate the
screen; chrome must stay out of the way.

DESIGN LANGUAGE
Dark theme throughout. Background near-black #14141a, card surfaces
#1e1e26, raised surfaces #26262f, borders #302f3a, primary text
off-white #f0efec, secondary text muted grey-purple #a5a3ae, faint text
#706e7a, accent muted indigo-violet #8b7bf0, success #5cb896, danger
#d97070.

Monospace font for product codes and access codes. Clean system
sans-serif for everything else. Flat design, 8px corner radius,
generous spacing, no gradients, no heavy shadows, no decorative
illustration. The accent colour appears ONLY on primary actions and
selected states, never as decoration.

Minimum 44px tap targets. Respect the notch and home indicator with
safe-area padding.

This is a white-label product: show a generic placeholder logo, not a
branded one. The supplier's own logo appears here in production.

SCREEN 1 — Login
Placeholder company logo centred near the top, company name beneath it.
Two large input fields: "Κινητό τηλέφωνο" with a numeric keyboard hint,
and "Κωδικός πρόσβασης" rendered in monospace with visibly uppercase
characters.
A full-width primary button "Σύνδεση".
Below it, a quiet text link "Ξέχασα τον κωδικό μου".
Include a second variant of this screen showing the reset state: same
layout but with only a phone field, a "Αποστολή νέου κωδικού" button,
and a neutral confirmation message reading "Αν ο αριθμός είναι
καταχωρημένος, θα λάβεις νέο κωδικό."
Footer with small muted company contact details.

SCREEN 2 — Collections list
Sticky header with the placeholder logo small on the left, the buyer's
name, and a logout icon on the right.
A vertical list of large collection cards. Each card is a wide fashion
photograph (3:2 crop) with a dark gradient scrim at the bottom carrying
the collection name in medium weight, and below it in smaller muted
text the publish date and image count, e.g. "12 Μαρτίου · 42 εικόνες".
Cards are generously sized — roughly two and a half visible per screen,
not a dense list.
Show three collections. One carries a small muted pill in the corner
reading "Αρχειοθετημένη".

SCREEN 3 — Collection gallery
The most important screen in the app.
Sticky condensed header: back chevron, collection name, and on the
right two quiet text buttons separated by a dot: "Επιλογή όλων" ·
"Καθαρισμός".
A grid of exactly THREE columns, 6px gaps, 6px outer padding. Each cell
is a PORTRAIT 3:4 fashion photograph — models wearing full outfits,
studio and editorial style, cropped top-anchored so heads are never cut
off. Images fill their cells edge to edge with no visible card frame.
Every tile shows, always visible (this is a touch screen, controls must
not be hover-dependent):
  - a 32px circular checkbox in the TOP-RIGHT corner, over a small dark
    scrim so it reads against light images
  - a 32px circular download icon button in the BOTTOM-RIGHT corner,
    same treatment
  - a small monospace product code on a dark translucent pill in the
    BOTTOM-LEFT, e.g. "DRESS-114"
Keep these controls small and cornered so they never obscure the
garment.
Show four of the twelve visible tiles selected: filled accent checkbox
with a dark checkmark, plus a 2px accent border around the whole cell.
Show one tile locked: dimmed to about 35% opacity, slightly
desaturated, small lock icon top-left, no checkbox and no download
button.
A floating pill-shaped bar, horizontally centred, sits above the home
indicator with 16px margin — it floats over the grid rather than
spanning the full width. Raised surface, fully rounded, subtle border
and soft shadow. Contents left to right: "12 επιλεγμένες" in medium
weight, a muted separator dot, "περίπου 7 MB" with a small chevron
beside it, a solid accent "Λήψη" button, and a quiet X at the far
right.

SCREEN 4 — Lightbox
Full-screen, background almost pure black.
A single large garment photograph filling most of the screen,
letterboxed rather than cropped.
Overlay chrome, semi-transparent and light: a close X top-right, and
top-left the product code in monospace above a small position indicator
reading "7 / 42".
At the bottom centre, a pill-shaped button with a checkmark icon
reading "Επιλογή", so the buyer can select without leaving this view.
Subtle left and right chevrons at the vertical midpoints hinting that
swiping moves between images.

SCREEN 5 — Download size sheet
The gallery screen dimmed behind a scrim, with a bottom sheet slid up
over it, rounded on its top corners only.
Sheet title "Μέγεθος λήψης" with a small close X.
Two large tappable rows, each at least 64px tall, separated by a
hairline:
  Row 1 — bold "Για eshop και social media",
          muted sub-line "12 εικόνες · περίπου 7 MB"
  Row 2 — bold "Για εκτύπωση και καταλόγους",
          muted sub-line "12 εικόνες · περίπου 120 MB"
Row 1 is shown selected with an accent border and a small accent radio
dot on the right.
Below the rows, a checkbox "Να θυμάσαι την επιλογή μου", checked.
A full-width accent "Λήψη" button at the bottom, above the home
indicator.

Keep all five screens visually consistent: identical header treatment,
identical button shapes and heights, one spacing scale, accent colour
used sparingly.
```

---

## BATCH B — Customer app, desktop (3 οθόνες)

Μικρότερο batch, αλλά χρειάζεται: κάποιοι αγοραστές θα το ανοίξουν από γραφείο.

```
Design 3 connected DESKTOP web screens for the same fashion image
delivery app, matching the mobile version already designed. Same dark
palette, same typography, same accent usage.

Content column capped at 1600px and centred — do not stretch across an
ultrawide viewport.

SCREEN 1 — Collections list
Sticky top bar: placeholder logo left, buyer name and logout right.
A grid of collection cards, three per row, each a 3:2 fashion
photograph with the collection name and metadata below it on the dark
surface rather than overlaid.

SCREEN 2 — Collection gallery, resting state
Sticky condensed header with back chevron, collection name, and on the
right "Επιλογή όλων" · "Καθαρισμός".
A grid of FIVE columns of portrait 3:4 fashion photographs, 8px gaps.
Tiles at rest show ONLY the image and a small monospace product code
pill bottom-left — no checkboxes, no buttons. This is the key
difference from mobile: on desktop the controls are hover-revealed to
keep the grid clean.
Two tiles are shown in a selected state, which persists at rest: 2px
accent border and a filled accent checkbox visible in the top-right.

SCREEN 3 — Collection gallery, hover state
The same grid, with ONE tile under the cursor showing its hover
treatment:
  - a subtle dark scrim across the lower half of the tile
  - two circular 40px buttons side by side in the bottom-right: a
    download icon and a checkmark icon, dark translucent circles with
    light icons
  - the product code pill at full opacity
Show a cursor over that tile so the interaction is unambiguous.
The floating selection pill from the mobile design appears here too,
centred near the bottom of the viewport, with the same contents.
```

---

## BATCH C — Admin panel, μέρος 1 (desktop, 5 οθόνες)

```
Design 5 connected desktop web screens for the Kollekta admin panel.
This is the internal tool the wholesaler's staff use to publish
collections. Same design language as the buyer-facing app, but the tone
is utilitarian and data-oriented — a working tool, closer to a
developer dashboard than a consumer app. Dense but breathable.

DESIGN LANGUAGE
Identical dark palette: #14141a background, #1e1e26 surfaces, #26262f
raised, #302f3a borders, #423f52 strong borders, #f0efec text, #a5a3ae
dim, #706e7a faint, accent #8b7bf0, success #5cb896, warning #d9a441,
danger #d97070.
Monospace for product codes, IDs, access codes and file names.
Flat, 8px radius, no gradients. Content column capped around 900px and
centred.
A thin top bar carries the "Kollekta" wordmark on the left and a nav:
Συλλογές · Πελάτες · Μηνύματα · Χώρος.

SCREEN 1 — Admin login
A small centred card on the dark background, Kollekta wordmark above
it. A single password field and a full-width accent "Είσοδος" button.
Nothing else — no signup, no marketing.

SCREEN 2 — Collections list
Page header "Συλλογές" left, accent "Νέα συλλογή" button right.
Below it, an inline creation form in its open state: a text field with
placeholder "π.χ. Φθινόπωρο 2026", an accent "Δημιουργία" button and a
quiet "Ακύρωση", all on one row.
Then collection rows as cards: name in medium weight left, status pill
and muted metadata right.
Show four rows in different states: two "Δημοσιευμένη" in green-tinted
pills, one "Πρόχειρη" in grey, one "Αρχειοθετημένη" in muted amber.
Metadata reads like "42 εικόνες · 2.1 GB".

SCREEN 3 — Collection wizard
Back chevron and collection name as the page title, status pill beside
it.
A vertical sequence of five step cards, each with a numbered circle on
the left, a Greek title, a one-line muted description, a control, an
action button, and a status line beneath.
  1. Φωτογραφίες συλλογής     — required
  2. Αντιστοίχιση κωδικών     — muted "Προαιρετικό" badge
  3. Παραγγελίες              — muted "Προαιρετικό" badge
  4. Ορατότητα                — required
  5. Δημοσίευση               — required
Step 1 completed, green status line "42 εικόνες ανέβηκαν."
Step 2 completed, amber status line "Αντιστοιχίστηκαν 40, χωρίς
ταίριασμα 2."
Steps 3 to 5 idle.
The two optional steps are visually quieter — lower contrast border and
a muted badge.

SCREEN 4 — Visibility and tag picker
Step 4 expanded.
Two radio options at the top: "Όλοι οι πελάτες" and "Επιλεγμένοι
πελάτες", the second selected.
Below, a tag selector: pill-shaped chips each showing a label and a
count — "χονδρική 180", "βόρεια-ελλάδα 64", "εταιρεία-α 120", "outlet
22", "νέοι-πελάτες 31". Three chips selected with accent fill and a
dark checkmark; the rest outlined and muted.
Beneath the chips, a live summary line in slightly larger text: "Θα το
δουν 184 από 312 ενεργούς πελάτες."
Below that, a collapsed section header with a chevron reading
"Χειροκίνητη επιλογή πελατών".

SCREEN 5 — Publish confirmation
Step 5 expanded into a summary card.
Label-value rows: εικόνες 42 · φιλτράρισμα παραγγελίας "Ανενεργό" ·
ορατότητα "184 πελάτες" · ειδοποίηση με email "161 πελάτες" · χωρίς
email "23 πελάτες (δεν θα ειδοποιηθούν)".
A checkbox "Ειδοποίηση πελατών με email", checked.
A prominent accent "Δημοσίευση" button with a quiet "Ακύρωση" beside
it, and a small muted note explaining that publishing makes the
collection immediately visible.
```

---

## BATCH D — Admin panel, μέρος 2 (desktop, 4 οθόνες)

```
Design 4 more connected desktop screens for the Kollekta admin panel,
continuing exactly the same dark utilitarian language, palette, top bar
and nav as the previous batch.

SCREEN 1 — Customers table
Page header "Πελάτες" with two buttons right: accent "Νέος πελάτης" and
outlined "Εισαγωγή από Excel".
Above the table, a filter row: a search field, a dropdown "Όλες οι
ετικέτες", a dropdown "Όλες οι καταστάσεις".
A dense table with columns: selection checkbox, Όνομα, Κινητό
(monospace), Email with a small coloured status dot beside it,
Ετικέτες as small chips, Κατάσταση as a pill, Κανάλι showing a tiny
icon with a label like "email" or "sms", Τελευταία σύνδεση.
Show eight rows, varied: most active, one disabled and muted, one with
a red email status dot, one with no email at all and an amber warning
icon.
Three rows shown selected — accent-filled checkboxes and slightly
raised row backgrounds.

SCREEN 2 — Mass edit bar
The same customers table with a floating action bar anchored above the
bottom of the viewport, spanning the content width.
Left: "3 επιλεγμένοι". Right: a dropdown "Αλλαγή πρόσβασης", a dropdown
"Προσθήκη ετικέτας", an outlined "Αποστολή κωδικού", and a
danger-outlined "Απενεργοποίηση". A quiet X on the far right.
The bar sits on a raised surface with a top border and a soft shadow so
it reads as floating above the table.

SCREEN 3 — Messages log
Page header "Μηνύματα" with a muted subtitle "Τελευταίες 200
αποστολές".
A read-only table: Ημερομηνία, Πελάτης, Παραλήπτης (monospace email or
phone), Κανάλι as a small pill, Τύπος, Κατάσταση.
Ten rows. Most "Στάλθηκε" in green. Two failures with a subtle
red-tinted row background, "Απέτυχε" in the danger colour, and the
error text in small muted monospace beneath the row.
One row shows a cascade result: channel pill reads "sms" with a small
muted note beside it reading "μετά από email, viber".

SCREEN 4 — Storage dashboard
Page header "Χώρος".
A wide summary card at the top: a large figure "31.4 GB" labelled "σε
χρήση", beside "8.6 GB ελεύθερα". Below them a horizontal progress bar
filled about 78%, rendered in amber to signal the warning threshold.
Below that, a compact line chart of storage growth over 30 days — thin
accent line, no fill, minimal axes, muted gridlines.
Then a table "Συλλογές κατά μέγεθος": Συλλογή, Εικόνες, Full, Web,
Thumb, Ηλικία, Διατήρηση, and a per-row "Αρχειοθέτηση" button. Sizes in
monospace. Five rows, largest first.
At the bottom, a distinct panel "Προς αρχειοθέτηση" on a raised surface
with an amber left border, listing two old collections with their
reclaimable space and a summary line "Θα ελευθερωθούν 12.8 GB".
```

---

## Μετά το Stitch

1. Κατέβασε το `DESIGN.md` και βάλ' το στη ρίζα του `photodelivery/` repo
2. Στο Cursor: *"Read DESIGN.md and align the existing admin panel and customer app CSS with it. Keep all functionality unchanged — this is a visual pass only. Do not alter any route, query or access-control logic."*
3. Το Batch A οθόνη 3 (mobile gallery) είναι η πιο σημαντική. Αν κάτι δεν σου αρέσει, ξανατρέξε **μόνο αυτό το batch** με πιο συγκεκριμένη περιγραφή, αντί να διορθώνεις CSS με το χέρι.

## Τι άλλαξε από την προηγούμενη έκδοση

- Όνομα: **Kollekta** (το Lookdrop υπάρχει ήδη ως fashion tech προϊόν)
- Προστέθηκε **Batch B** για desktop customer view, με ρητή διάκριση hover vs touch
- Το mobile gallery δείχνει πλέον **και τα δύο κουμπιά μόνιμα ορατά** (checkbox + download ανά εικόνα)
- Το bottom bar έγινε **floating pill** αντί για full-width μπάρα, με ζωντανό μέγεθος λήψης
- Προστέθηκαν τα **"Επιλογή όλων" / "Καθαρισμός"** στο header
- Το nav του admin περιλαμβάνει πλέον και το **Μηνύματα**
