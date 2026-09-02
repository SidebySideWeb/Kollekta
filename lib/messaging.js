const crypto = require('crypto');
const db = require('../db');
const config = require('../config');
const { sendEmail } = require('./email');
const { sendPhoneMessage } = require('./sms');
const { formatPhoneForDisplay } = require('./phone');

const AUTH_CHANNELS = ['email', 'viber', 'whatsapp', 'sms'];

function loginUrl() {
  return `${config.APP_PUBLIC_URL.replace(/\/$/, '')}/app/login`;
}

function unsubscribeUrl(customerId) {
  const token = crypto
    .createHmac('sha256', config.SESSION_COOKIE_SECRET)
    .update(String(customerId))
    .digest('hex');
  return `${config.APP_PUBLIC_URL.replace(/\/$/, '')}/api/unsubscribe/${token}`;
}

function wrapHtml(title, bodyHtml) {
  const logo = config.LOGO_PATH
    ? `<img src="${config.LOGO_PATH}" alt="${config.COMPANY_NAME}" style="max-height:48px;margin-bottom:16px;">`
    : `<h1 style="color:${config.ACCENT_COLOR};margin:0 0 16px;">${config.COMPANY_NAME}</h1>`;

  return `<!DOCTYPE html><html><body style="font-family:sans-serif;color:#222;max-width:560px;margin:0 auto;padding:24px;">
    ${logo}
    <h2 style="color:${config.ACCENT_COLOR};">${title}</h2>
    ${bodyHtml}
    <p style="color:#666;font-size:13px;margin-top:32px;">${config.COMPANY_NAME}</p>
  </body></html>`;
}

function welcomeText({ companyName, code, loginUrl: url }) {
  return `${companyName}\nΟ κωδικός πρόσβασής σου: ${code}\nΣύνδεση: ${url}`;
}

function welcomeEmail({ companyName, code, loginUrl: url }) {
  return {
    text: welcomeText({ companyName, code, loginUrl: url }),
    html: wrapHtml(
      'Καλώς ήρθες',
      `<p>Ο κωδικός πρόσβασής σου είναι: <strong style="font-family:monospace;font-size:20px;">${code}</strong></p><p><a href="${url}">${url}</a></p>`
    ),
  };
}

function resetText({ companyName, code, loginUrl: url }) {
  return `${companyName}\nΝέος κωδικός: ${code}\nΣύνδεση: ${url}`;
}

function resetEmail({ companyName, code, loginUrl: url }) {
  return {
    text: resetText({ companyName, code, loginUrl: url }),
    html: wrapHtml(
      'Νέος κωδικός πρόσβασης',
      `<p>Ο νέος κωδικός σου είναι: <strong style="font-family:monospace;font-size:20px;">${code}</strong></p><p><a href="${url}">${url}</a></p>`
    ),
  };
}

function newCollectionEmail({ companyName, collectionName, loginUrl: url, coverImageUrl }) {
  const cover = coverImageUrl
    ? `<p><img src="${coverImageUrl}" alt="" style="max-width:100%;border-radius:8px;"></p>`
    : '';
  return {
    text: `${companyName}\nΝέα συλλογή: ${collectionName}\nΔες τη συλλογή: ${url}`,
    html: wrapHtml(
      'Νέα συλλογή',
      `${cover}<p>Η συλλογή <strong>${collectionName}</strong> είναι διαθέσιμη.</p><p><a href="${url}">Άνοιγμα εφαρμογής</a></p><p style="font-size:12px;color:#888;"><a href="${url}">Απεγγραφή ειδοποιήσεων</a></p>`
    ),
  };
}

function logMessage({ customerId, destination, channel, kind, status, providerMessageId, error }) {
  db.prepare(
    `INSERT INTO message_log
      (customer_id, destination, channel, kind, status, provider_message_id, error)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(customerId, destination, channel, kind, status, providerMessageId || null, error || null);
}

function authSubject(kind) {
  if (kind === 'welcome') return `${config.COMPANY_NAME} — Κωδικός πρόσβασης`;
  if (kind === 'reset') return `${config.COMPANY_NAME} — Νέος κωδικός`;
  return `${config.COMPANY_NAME} — Κωδικός πρόσβασης`;
}

function authText(kind, payload) {
  if (kind === 'welcome') return welcomeText(payload);
  if (kind === 'reset') return resetText(payload);
  return welcomeText(payload);
}

function authEmail(kind, payload) {
  if (kind === 'welcome') return welcomeEmail(payload);
  if (kind === 'reset') return resetEmail(payload);
  return welcomeEmail(payload);
}

function channelOrder(preferred) {
  if (preferred && preferred !== 'auto' && AUTH_CHANNELS.includes(preferred)) {
    return [preferred, ...AUTH_CHANNELS.filter((c) => c !== preferred)];
  }
  return [...AUTH_CHANNELS];
}

async function tryChannel(customer, channel, kind, payload) {
  const basePayload = {
    companyName: config.COMPANY_NAME,
    code: payload.code,
    loginUrl: loginUrl(),
  };

  if (channel === 'email') {
    if (!customer.email) {
      return { channel, ok: false, error: 'no email' };
    }
    const emailContent = authEmail(kind, basePayload);
    const result = await sendEmail({
      to: customer.email,
      subject: authSubject(kind),
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

  const text = authText(kind, basePayload);
  const shortText =
    channel === 'sms'
      ? `${config.COMPANY_NAME}: ${payload.code}`
      : `${config.COMPANY_NAME} κωδικός: ${payload.code} ${loginUrl()}`;

  const result = await sendPhoneMessage({
    phone: customer.phone,
    channel,
    text: channel === 'sms' ? shortText : shortText,
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

  const emailContent = newCollectionEmail({
    companyName: config.COMPANY_NAME,
    collectionName: payload.collectionName,
    loginUrl: loginUrl(),
    coverImageUrl: payload.coverImageUrl,
  });

  const htmlWithUnsub = emailContent.html.replace(
    'Απεγγραφή ειδοποιήσεων',
    `<a href="${unsubscribeUrl(customer.id)}">Απεγγραφή ειδοποιήσεων</a>`
  );

  const result = await sendEmail({
    to: customer.email,
    subject: `${config.COMPANY_NAME} — Νέα συλλογή: ${payload.collectionName}`,
    text: `${emailContent.text}\n\nΑπεγγραφή: ${unsubscribeUrl(customer.id)}`,
    html: htmlWithUnsub,
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
};
