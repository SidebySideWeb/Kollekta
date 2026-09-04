const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');

const config = require('./config');
const adminRoutes = require('./routes/admin');
const customerRoutes = require('./routes/customer');
const { cleanupOldAttempts } = require('./lib/rateLimit');
const { startRetentionJob } = require('./lib/retention');
const { takeSnapshot } = require('./lib/storage');
const { cleanupTmpDir } = require('./lib/uploadTmp');
const {
  authenticateAdmin,
  getAdminById,
  requestPasswordReset,
  confirmPasswordReset,
  resetAvailable,
  ensureBootstrapAdmin,
} = require('./lib/adminAuth');
const db = require('./db');

ensureBootstrapAdmin();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_COOKIE = 'pd_admin';
const adminDir = path.join(__dirname, 'public', 'admin');
const appDir = path.join(__dirname, 'public', 'app');
const sharedDir = path.join(__dirname, 'public', 'shared');
const logoDir = path.join(__dirname, 'public', 'logo');
const tokensCss = path.join(sharedDir, 'tokens.css');

function adminCookieOptions() {
  return {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };
}

for (const dir of [logoDir, sharedDir, path.join(__dirname, 'data'), path.join(__dirname, 'uploads'), path.join(__dirname, 'tmp')]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

cleanupTmpDir();

app.set('trust proxy', true);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(config.SESSION_COOKIE_SECRET));

function getAdminIdFromCookie(req) {
  const raw = req.signedCookies[ADMIN_COOKIE];
  if (raw == null || raw === false) return null;
  // Legacy cookie value from single-password era
  if (raw === '1') {
    ensureBootstrapAdmin();
    const first = db.prepare('SELECT id FROM admins ORDER BY id LIMIT 1').get();
    return first ? first.id : null;
  }
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isAdminAuthenticated(req) {
  const adminId = getAdminIdFromCookie(req);
  if (!adminId) return false;
  const admin = getAdminById(adminId);
  if (!admin) return false;
  req.adminId = admin.id;
  req.admin = admin;
  return true;
}

function requireAdmin(req, res, next) {
  if (isAdminAuthenticated(req)) return next();
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'Απαιτείται σύνδεση διαχειριστή.' });
  }
  return res.redirect('/admin/login.html');
}

app.get('/api/branding', (_req, res) => {
  res.json({
    ...config.publicBranding,
    adminResetAvailable: resetAvailable(),
  });
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({
    id: req.admin.id,
    email: req.admin.email,
    name: req.admin.name || '',
    isSuperadmin: Number(req.admin.is_superadmin) === 1,
  });
});

app.post('/api/login', (req, res) => {
  const email = String(req.body.email || '');
  const password = String(req.body.password || '');
  const admin = authenticateAdmin(email, password);
  if (!admin) {
    return res.status(401).json({ error: 'Λάθος email ή κωδικός πρόσβασης.' });
  }
  res.cookie(ADMIN_COOKIE, String(admin.id), {
    ...adminCookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({ ok: true, admin });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie(ADMIN_COOKIE, adminCookieOptions());
  res.json({ ok: true });
});

app.post('/api/admin-auth/forgot', async (req, res) => {
  try {
    const result = await requestPasswordReset(req.body.email);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message || 'Αποτυχία αποστολής.' });
  }
});

app.post('/api/admin-auth/reset', (req, res) => {
  const email = String(req.body.email || '');
  const code = String(req.body.code || '');
  const newPassword = String(req.body.newPassword || '');
  const result = confirmPasswordReset(email, code, newPassword);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }
  res.clearCookie(ADMIN_COOKIE, adminCookieOptions());
  res.json({ ok: true, message: 'Ο κωδικός ενημερώθηκε. Συνδέσου με τον νέο κωδικό.' });
});

app.get('/shared/tokens.css', (_req, res) => {
  res.type('css').sendFile(tokensCss);
});
app.use('/shared', express.static(sharedDir));
app.use('/logo', express.static(logoDir));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api', customerRoutes);

app.get('/admin/login.html', (_req, res) => {
  res.sendFile(path.join(adminDir, 'login.html'));
});
app.get('/admin/style.css', (_req, res) => {
  res.sendFile(path.join(adminDir, 'style.css'));
});
app.get('/admin/tokens.css', (_req, res) => {
  res.type('css').sendFile(tokensCss);
});

app.use('/api/admin', requireAdmin, adminRoutes);
app.use('/admin', requireAdmin, express.static(adminDir));

app.use('/app-assets', express.static(appDir));
app.get(['/app', '/app/*path'], (_req, res) => {
  res.sendFile(path.join(appDir, 'index.html'));
});

app.get('/', (_req, res) => {
  res.redirect('/app');
});

function cleanupExpiredSessions() {
  db.prepare("DELETE FROM sessions WHERE datetime(expires_at) <= datetime('now')").run();
}

cleanupOldAttempts();
cleanupExpiredSessions();
takeSnapshot();
startRetentionJob();
setInterval(() => {
  cleanupOldAttempts();
  cleanupExpiredSessions();
}, 60 * 60 * 1000);
setInterval(() => {
  takeSnapshot();
}, 24 * 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`${config.PRODUCT_NAME} app:    http://localhost:${PORT}/app`);
  console.log(`${config.PRODUCT_NAME} admin:  http://localhost:${PORT}/admin`);
});
