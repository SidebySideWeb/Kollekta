const PRODUCT_NAME = 'Kollekta';
const COMPANY_NAME = String(process.env.COMPANY_NAME || '').trim();
const COMPANY_PHONE = String(process.env.COMPANY_PHONE || '').trim();
const COMPANY_EMAIL = String(process.env.COMPANY_EMAIL || '').trim();
const COMPANY_ADDRESS = String(process.env.COMPANY_ADDRESS || '').trim();
const ACCENT_COLOR = process.env.ACCENT_COLOR || '#8b7bf0';
const LOGO_PATH = String(process.env.LOGO_PATH || '').replace(/\s+/g, '').trim() || null;
const FOOTER_TEXT = process.env.FOOTER_TEXT || '';
const APP_PUBLIC_URL = String(process.env.APP_PUBLIC_URL || 'https://kollekta.gr').replace(/\s+/g, '').trim()
  || 'https://kollekta.gr';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_COOKIE_SECRET = process.env.SESSION_COOKIE_SECRET || '';
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'console';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = process.env.SMTP_PORT || '';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = String(process.env.SMTP_FROM || '').replace(/\s+/g, ' ').trim();
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim();
const MESSAGING_PROVIDER = process.env.MESSAGING_PROVIDER || 'console';
const MESSAGING_SENDER_ID = process.env.MESSAGING_SENDER_ID || '';
const YUBOTO_API_TOKEN = process.env.YUBOTO_API_TOKEN || '';
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM = process.env.TWILIO_FROM || '';
const DEFAULT_RETENTION_MONTHS = process.env.DEFAULT_RETENTION_MONTHS
  ? Number(process.env.DEFAULT_RETENTION_MONTHS)
  : 18;
const RETENTION_AUTO_PURGE = process.env.RETENTION_AUTO_PURGE === 'true';
const STORAGE_WARN_PERCENT = Number(process.env.STORAGE_WARN_PERCENT) || 75;
const STORAGE_CRITICAL_PERCENT = Number(process.env.STORAGE_CRITICAL_PERCENT) || 90;
const RATE_LIMIT_LOGIN_MAX_FAILURES = Number(process.env.RATE_LIMIT_LOGIN_MAX_FAILURES) || 15;
const RATE_LIMIT_LOGIN_WINDOW_MINUTES = Number(process.env.RATE_LIMIT_LOGIN_WINDOW_MINUTES) || 15;
const RATE_LIMIT_LOGIN_MAX_PER_IP = Number(process.env.RATE_LIMIT_LOGIN_MAX_PER_IP) || 60;
const RATE_LIMIT_RESET_MAX_PER_PHONE = Number(process.env.RATE_LIMIT_RESET_MAX_PER_PHONE) || 10;
const RATE_LIMIT_RESET_MAX_PER_IP = Number(process.env.RATE_LIMIT_RESET_MAX_PER_IP) || 30;

function fail(message) {
  console.error(`Σφάλμα ρύθμισης: ${message}`);
  process.exit(1);
}

function publicHostname() {
  try {
    return new URL(APP_PUBLIC_URL).hostname || '';
  } catch {
    return '';
  }
}

function quoteFromDisplayName(name) {
  const clean = String(name || '').trim().replace(/[\r\n"]/g, '');
  const display = clean || PRODUCT_NAME;
  if (/[,<>@()]/.test(display) || /\s/.test(display)) {
    return `"${display}"`;
  }
  return display;
}

/**
 * Sending domain for Resend/SMTP.
 * For client.kollekta.gr prefer parent kollekta.gr (must be verified once in Resend).
 * Override with EMAIL_FROM_DOMAIN.
 */
function resolveEmailFromDomain() {
  const explicit = String(process.env.EMAIL_FROM_DOMAIN || '').replace(/\s+/g, '').trim().toLowerCase();
  if (explicit) return explicit;
  const host = publicHostname().toLowerCase();
  const brandParent = host.match(/^[^.]+\.(kollekta\.gr)$/);
  if (brandParent) return brandParent[1];
  return host;
}

function resolveEmailLocalPart() {
  const explicit = String(process.env.EMAIL_LOCAL_PART || '').replace(/\s+/g, '').trim();
  if (explicit) return explicit.replace(/[^a-zA-Z0-9._+-]/g, '') || 'noreply';

  const host = publicHostname().toLowerCase();
  const fromDomain = resolveEmailFromDomain();
  if (fromDomain && host.endsWith(`.${fromDomain}`)) {
    const sub = host.slice(0, -(fromDomain.length + 1));
    if (sub && !sub.includes('.')) {
      return sub.replace(/[^a-zA-Z0-9._+-]/g, '') || 'noreply';
    }
  }
  return 'noreply';
}

/** e.g. Moutaki <moutaki@kollekta.gr> */
function buildDefaultEmailFrom() {
  const domain = resolveEmailFromDomain();
  if (!domain || domain === 'localhost' || domain.endsWith('.local')) return '';
  const local = resolveEmailLocalPart();
  return `${quoteFromDisplayName(COMPANY_NAME)} <${local}@${domain}>`;
}

const EMAIL_FROM = String(process.env.EMAIL_FROM || SMTP_FROM || buildDefaultEmailFrom())
  .replace(/\s+/g, ' ')
  .trim();
const EMAIL_FROM_DOMAIN = resolveEmailFromDomain();
const EMAIL_LOCAL_PART = resolveEmailLocalPart();

if (!ADMIN_PASSWORD) fail('ADMIN_PASSWORD είναι υποχρεωτικό.');
if (!SESSION_COOKIE_SECRET) fail('SESSION_COOKIE_SECRET είναι υποχρεωτικό.');

if (EMAIL_PROVIDER === 'smtp') {
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !EMAIL_FROM) {
    fail('Για EMAIL_PROVIDER=smtp απαιτούνται SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS και EMAIL_FROM (ή COMPANY_NAME + APP_PUBLIC_URL).');
  }
}

if (EMAIL_PROVIDER === 'resend') {
  if (!RESEND_API_KEY) {
    fail('Για EMAIL_PROVIDER=resend απαιτείται RESEND_API_KEY.');
  }
  if (!EMAIL_FROM) {
    fail('Για EMAIL_PROVIDER=resend βάλε APP_PUBLIC_URL=https://client.kollekta.gr και COMPANY_NAME, ή EMAIL_FROM / EMAIL_FROM_DOMAIN.');
  }
}

if (MESSAGING_PROVIDER === 'yuboto') {
  if (!YUBOTO_API_TOKEN || !MESSAGING_SENDER_ID) {
    fail('Για MESSAGING_PROVIDER=yuboto απαιτούνται YUBOTO_API_TOKEN και MESSAGING_SENDER_ID.');
  }
}

if (MESSAGING_PROVIDER === 'twilio') {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM) {
    fail('Για MESSAGING_PROVIDER=twilio απαιτούνται TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM.');
  }
}

const publicBranding = {
  companyName: COMPANY_NAME,
  companyPhone: COMPANY_PHONE,
  companyEmail: COMPANY_EMAIL,
  companyAddress: COMPANY_ADDRESS,
  accentColor: ACCENT_COLOR,
  logoPath: LOGO_PATH,
  footerText: FOOTER_TEXT,
  storageWarnPercent: STORAGE_WARN_PERCENT,
  storageCriticalPercent: STORAGE_CRITICAL_PERCENT,
};

module.exports = {
  PRODUCT_NAME,
  COMPANY_NAME,
  COMPANY_PHONE,
  COMPANY_EMAIL,
  COMPANY_ADDRESS,
  ACCENT_COLOR,
  LOGO_PATH,
  FOOTER_TEXT,
  APP_PUBLIC_URL,
  ADMIN_PASSWORD,
  SESSION_COOKIE_SECRET,
  EMAIL_PROVIDER,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  EMAIL_FROM,
  EMAIL_FROM_DOMAIN,
  EMAIL_LOCAL_PART,
  RESEND_API_KEY,
  MESSAGING_PROVIDER,
  MESSAGING_SENDER_ID,
  YUBOTO_API_TOKEN,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_FROM,
  DEFAULT_RETENTION_MONTHS,
  RETENTION_AUTO_PURGE,
  STORAGE_WARN_PERCENT,
  STORAGE_CRITICAL_PERCENT,
  RATE_LIMIT_LOGIN_MAX_FAILURES,
  RATE_LIMIT_LOGIN_WINDOW_MINUTES,
  RATE_LIMIT_LOGIN_MAX_PER_IP,
  RATE_LIMIT_RESET_MAX_PER_PHONE,
  RATE_LIMIT_RESET_MAX_PER_IP,
  publicBranding,
};
