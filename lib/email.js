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

async function sendEmail({ to, subject, text, html }) {
  if (config.EMAIL_PROVIDER === 'console') {
    console.log(
      box('EMAIL (console)', `To: ${to}\nSubject: ${subject}\n\n${text}`)
    );
    return { ok: true, providerMessageId: `console-${Date.now()}` };
  }

  try {
    const info = await getTransporter().sendMail({
      from: config.SMTP_FROM,
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
