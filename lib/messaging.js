const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const { sendEmail } = require('./email');
const { sendPhoneMessage } = require('./sms');
const { formatPhoneForDisplay } = require('./phone');
const {
  appUrl,
  authEmailContent,
  newCollectionEmailContent,
  guideStepsText,
} = require('./emailTemplates');

const AUTH_CHANNELS = ['email', 'viber', 'whatsapp', 'sms'];

function loginUrl() {
  return appUrl();
}

function unsubscribeUrl(customerId) {
  const token = crypto
    .createHmac('sha256', config.SESSION_COOKIE_SECRET)
    .update(String(customerId))
    .digest('hex');
  return `${config.APP_PUBLIC_URL.replace(/\/$/, '')}/api/unsubscribe/${token}`;
}

function logMessage({ customerId, destination, channel, kind, status, providerMessageId, error }) {
  db.prepare(
    `INSERT INTO message_log
      (customer_id, destination, channel, kind, status, provider_message_id, error)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(customerId, destination, channel, kind, status, providerMessageId || null, error || null);
}

function authPhoneText(kind, { code }) {
  const name = config.COMPANY_NAME || config.PRODUCT_NAME || 'Kollekta';
  const prefix = kind === 'reset' ? 'Νέος κωδικός' : 'Κωδικός';
  return `${name} ${prefix}: ${code} ${loginUrl()}`;
}

function channelOrder(preferred) {
  if (preferred && preferred !== 'auto' && AUTH_CHANNELS.includes(preferred)) {
    return [preferred, ...AUTH_CHANNELS.filter((c) => c !== preferred)];
  }
  return [...AUTH_CHANNELS];
}

async function tryChannel(customer, channel, kind, payload) {
  if (channel === 'email') {
    if (!customer.email) {
      return { channel, ok: false, error: 'no email' };
    }
    const emailContent = authEmailContent({
      kind,
      code: payload.code,
      phone: formatPhoneForDisplay(customer.phone),
    });
    const result = await sendEmail({
      to: customer.email,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });
    logMessage({
      customerId: customer.id,
      destination: customer.email,
      channel: 'email',
      kind,
      status: result.ok ? 'sent' : 'failed',
      providerMessageId: result.providerMessageId,
      error: result.error,
    });
    if (result.ok) {
      db.prepare("UPDATE customers SET email_status = 'ok', last_auth_channel = 'email' WHERE id = ?").run(
        customer.id
      );
    } else {
      db.prepare("UPDATE customers SET email_status = 'bounced' WHERE id = ?").run(customer.id);
    }
    return { channel: 'email', ok: result.ok, error: result.error };
  }

  const shortText =
    channel === 'sms'
      ? `${config.COMPANY_NAME || config.PRODUCT_NAME}: ${payload.code}`
      : authPhoneText(kind, payload);

  const result = await sendPhoneMessage({
    phone: customer.phone,
    channel,
    text: shortText,
  });

  logMessage({
    customerId: customer.id,
    destination: formatPhoneForDisplay(customer.phone),
    channel,
    kind,
    status: result.ok ? 'sent' : 'failed',
    providerMessageId: result.providerMessageId,
    error: result.error,
  });

  if (result.ok) {
    db.prepare('UPDATE customers SET last_auth_channel = ? WHERE id = ?').run(channel, customer.id);
  }

  return { channel, ok: result.ok, error: result.error };
}

async function sendAuthMessage(customer, kind, { code }) {
  const attempts = [];
  const channels = channelOrder(customer.preferred_channel);

  for (const channel of channels) {
    const attempt = await tryChannel(customer, channel, kind, { code });
    attempts.push(attempt);
    if (attempt.ok) {
      return { ok: true, channel: attempt.channel, attempts };
    }
  }

  return { ok: false, channel: null, attempts };
}

async function sendAnnouncement(customer, payload) {
  if (!customer.email || !customer.notify_by_email) {
    return { ok: false, skipped: true };
  }

  const unsub = unsubscribeUrl(customer.id);
  const emailContent = newCollectionEmailContent({
    collectionName: payload.collectionName,
    coverImageUrl: payload.coverImageUrl,
    unsubscribeLink: unsub,
  });

  const result = await sendEmail({
    to: customer.email,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
  });

  logMessage({
    customerId: customer.id,
    destination: customer.email,
    channel: 'email',
    kind: 'new_collection',
    status: result.ok ? 'sent' : 'failed',
    providerMessageId: result.providerMessageId,
    error: result.error,
  });

  if (result.ok) {
    db.prepare("UPDATE customers SET email_status = 'ok' WHERE id = ?").run(customer.id);
  } else {
    db.prepare("UPDATE customers SET email_status = 'bounced' WHERE id = ?").run(customer.id);
  }

  return { ok: result.ok, skipped: false, error: result.error };
}

module.exports = {
  sendAuthMessage,
  sendAnnouncement,
  loginUrl,
  unsubscribeUrl,
  guideStepsText,
};
