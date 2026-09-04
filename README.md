# Kollekta

Εργαλείο παράδοσης φωτογραφιών συλλογής σε πελάτες χονδρικής.

Οι πελάτες συνδέονται με **κινητό + μόνιμο κωδικό** και βλέπουν τις δημοσιευμένες συλλογές.

## Απαιτήσεις

- Node.js 20+
- `ADMIN_PASSWORD` και `SESSION_COOKIE_SECRET` (υποχρεωτικά)
- `ADMIN_EMAIL` (προτεινόμενο) — email του **superadmin**· μόνο αυτός προσθέτει/διαγράφει άλλους admins

## Τοπική εκτέλεση

```bash
cp .env.example .env
# Ρύθμισε ADMIN_PASSWORD και SESSION_COOKIE_SECRET

npm install
npm start
```

- Εφαρμογή πελατών: http://localhost:3000/app
- Admin: http://localhost:3000/admin

Smoke tests (ο server πρέπει να τρέχει):

```bash
npm test
```

## Docker

```bash
docker compose up --build          # τοπική δοκιμή
docker build -t kollekta:latest .   # build για provisioning
```

```bash
docker run -p 3000:3000 \
  -e ADMIN_PASSWORD=test123 \
  -e SESSION_COOKIE_SECRET=devsecret \
  kollekta:latest
```

## Meta-admin

Δείτε το `../meta-admin/README.md` για provisioning πολλαπλών instances με Docker.
