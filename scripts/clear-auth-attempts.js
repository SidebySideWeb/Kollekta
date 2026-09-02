const db = require('../db');
const cleared = db.prepare('DELETE FROM auth_attempts').run().changes;
console.log(`Cleared ${cleared} auth attempt(s).`);
const customers = db
  .prepare("SELECT name, phone, access_code, status FROM customers WHERE status = 'active'")
  .all();
for (const c of customers) {
  console.log(`${c.name} | ${c.phone} | ${c.access_code}`);
}
