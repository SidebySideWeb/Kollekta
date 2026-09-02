const PRODUCT_NAME = 'Kollekta';
const COMPANY_NAME = process.env.COMPANY_NAME || '';
const COMPANY_PHONE = process.env.COMPANY_PHONE || '';
const COMPANY_EMAIL = process.env.COMPANY_EMAIL || '';
const COMPANY_ADDRESS = process.env.COMPANY_ADDRESS || '';
const ACCENT_COLOR = process.env.ACCENT_COLOR || '#8b7bf0';
const LOGO_PATH = process.env.LOGO_PATH || null;
const FOOTER_TEXT = process.env.FOOTER_TEXT || '';
const APP_PUBLIC_URL = process.env.APP_PUBLIC_URL || 'https://kollekta.gr';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_COOKIE_SECRET = process.env.SESSION_COOKIE_SECRET || '';
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'console';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = process.env.SMTP_PORT || '';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || '';
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

if (!ADMIN_PASSWORD) fail('ADMIN_PASSWORD είναι υποχρεωτικό.');
if (!SESSION_COOKIE_SECRET) fail('SESSION_COOKIE_SECRET είναι υποχρεωτικό.');

if (EMAIL_PROVIDER === 'smtp') {
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
    fail('Για EMAIL_PROVIDER=smtp απαιτούνται SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.');
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
