const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: Number(config.SMTP_PORT),
      secure: Number(config.SMTP_PORT) === 465,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS,
      },
    });
  }
  return transporter;
}

function box(title, body) {
  const line = '═'.repeat(60);
  return `\n${line}\n  ${title}\n${line}\n${body}\n${line}\n`;
}

function fromAddress() {
  return config.EMAIL_FROM || '';
}

async function sendViaResend({ to, subject, text, html }) {
  const from = fromAddress();
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.message || data?.error || `Resend HTTP ${res.status}`;
    return { ok: false, error: String(message) };
  }
  return { ok: true, providerMessageId: data.id || `resend-${Date.now()}` };
}

async function sendEmail({ to, subject, text, html }) {
  if (config.EMAIL_PROVIDER === 'console') {
    console.log(
      box('EMAIL (console)', `To: ${to}\nSubject: ${subject}\n\n${text}`)
    );
    return { ok: true, providerMessageId: `console-${Date.now()}` };
  }

  if (config.EMAIL_PROVIDER === 'resend') {
    try {
      return await sendViaResend({ to, subject, text, html });
    } catch (error) {
      return { ok: false, error: error.message || 'Αποτυχία αποστολής με Resend.' };
    }
  }

  try {
    const info = await getTransporter().sendMail({
      from: fromAddress(),
      to,
      subject,
      text,
      html,
    });
    return { ok: true, providerMessageId: info.messageId };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = { sendEmail };
