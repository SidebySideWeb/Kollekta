const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'app.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    published_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL,
    original_filename TEXT NOT NULL,
    product_code TEXT,
    full_path TEXT NOT NULL,
    web_path TEXT NOT NULL,
    thumb_path TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    name TEXT,
    erp_code TEXT,
    access_code TEXT NOT NULL,
    code_updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    default_access_mode TEXT DEFAULT 'full_access',
    preferred_channel TEXT DEFAULT 'auto',
    last_auth_channel TEXT,
    email_status TEXT DEFAULT 'unknown',
    notify_by_email INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    product_code TEXT NOT NULL,
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    customer_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    last_seen_at TEXT,
    user_agent TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS auth_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT,
    ip TEXT,
    kind TEXT NOT NULL,
    success INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS download_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    image_id INTEGER NOT NULL,
    downloaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS message_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER,
    destination TEXT NOT NULL,
    channel TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    provider_message_id TEXT,
    error TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_images_collection_id ON images(collection_id);
  CREATE INDEX IF NOT EXISTS idx_images_collection_product ON images(collection_id, product_code);
  CREATE INDEX IF NOT EXISTS idx_order_items_collection_customer ON order_items(collection_id, customer_id);
  CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
  CREATE INDEX IF NOT EXISTS idx_sessions_customer_id ON sessions(customer_id);
  CREATE INDEX IF NOT EXISTS idx_auth_attempts_phone ON auth_attempts(phone, kind, created_at);
  CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip ON auth_attempts(ip, kind, created_at);
`);

function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('collections', 'status', "TEXT NOT NULL DEFAULT 'draft'");
ensureColumn('collections', 'published_at', 'TEXT');
ensureColumn('collections', 'visibility', "TEXT DEFAULT 'all'");
ensureColumn('collections', 'visibility_tags', 'TEXT');
ensureColumn('collections', 'retention_months', 'INTEGER');
ensureColumn('collections', 'retention_pinned', 'INTEGER DEFAULT 0');
ensureColumn('collections', 'full_purged_at', 'TEXT');

ensureColumn('images', 'full_bytes', 'INTEGER DEFAULT 0');
ensureColumn('images', 'web_bytes', 'INTEGER DEFAULT 0');
ensureColumn('images', 'thumb_bytes', 'INTEGER DEFAULT 0');
ensureColumn('images', 'grid_bytes', 'INTEGER DEFAULT 0');
ensureColumn('images', 'full_purged', 'INTEGER DEFAULT 0');

ensureColumn('customers', 'tags', 'TEXT');
ensureColumn('download_log', 'variant', 'TEXT');

db.exec(`
  CREATE TABLE IF NOT EXISTS collection_customers (
    collection_id INTEGER NOT NULL,
    customer_id INTEGER NOT NULL,
    PRIMARY KEY (collection_id, customer_id),
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS storage_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total_bytes INTEGER,
    full_bytes INTEGER,
    web_bytes INTEGER,
    thumb_bytes INTEGER,
    disk_free_bytes INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_collcust ON collection_customers(customer_id);

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    password_hash TEXT NOT NULL,
    is_superadmin INTEGER NOT NULL DEFAULT 0,
    reset_hash TEXT,
    reset_expires TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
`);

ensureColumn('admins', 'is_superadmin', 'INTEGER NOT NULL DEFAULT 0');

module.exports = db;
