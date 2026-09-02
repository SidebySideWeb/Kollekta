const config = require('../config');

function box(title, body) {
  const line = '═'.repeat(60);
  return `\n${line}\n  ${title}\n${line}\n${body}\n${line}\n`;
}

async function sendViaConsole({ phone, channel, text }) {
  console.log(box(`${channel.toUpperCase()} (console)`, `To: ${phone}\n\n${text}`));
  return { ok: true, providerMessageId: `console-${channel}-${Date.now()}` };
}

async function sendViaYuboto({ phone, channel, text }) {
  if (channel === 'whatsapp') {
    return { ok: false, error: 'channel not supported by provider' };
  }

  if (!config.YUBOTO_API_TOKEN) {
    return { ok: false, error: 'YUBOTO_API_TOKEN missing' };
  }

  try {
    const response = await fetch('https://services.yuboto.com/omni/v1/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.YUBOTO_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: phone,
        from: config.MESSAGING_SENDER_ID,
        channel,
        text,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: data.error || data.message || 'Yuboto send failed' };
    }
    return { ok: true, providerMessageId: data.id || data.messageId };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function sendViaTwilio({ phone, channel, text }) {
  if (channel === 'viber') {
    return { ok: false, error: 'channel not supported by provider' };
  }

  const to =
    channel === 'whatsapp'
      ? phone.startsWith('whatsapp:')
        ? phone
        : `whatsapp:+${phone}`
      : phone.startsWith('+')
        ? phone
        : `+${phone}`;

  const body = new URLSearchParams({
    To: to,
    From: channel === 'whatsapp' ? `whatsapp:${config.TWILIO_FROM}` : config.TWILIO_FROM,
    Body: text,
  });

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization:
            'Basic ' +
            Buffer.from(`${config.TWILIO_ACCOUNT_SID}:${config.TWILIO_AUTH_TOKEN}`).toString(
              'base64'
            ),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      }
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, error: data.message || 'Twilio send failed' };
    }
    return { ok: true, providerMessageId: data.sid };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

async function sendPhoneMessage({ phone, channel, text }) {
  if (config.MESSAGING_PROVIDER === 'console') {
    return sendViaConsole({ phone, channel, text });
  }
  if (config.MESSAGING_PROVIDER === 'yuboto') {
    return sendViaYuboto({ phone, channel, text });
  }
  if (config.MESSAGING_PROVIDER === 'twilio') {
    return sendViaTwilio({ phone, channel, text });
  }
  return { ok: false, error: `Unknown messaging provider: ${config.MESSAGING_PROVIDER}` };
}

module.exports = { sendPhoneMessage };
