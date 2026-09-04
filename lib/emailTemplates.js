const config = require('../config');

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function appUrl() {
  return `${String(config.APP_PUBLIC_URL || '').replace(/\/$/, '')}/app`;
}

function brandName() {
  return config.COMPANY_NAME || config.PRODUCT_NAME || 'Kollekta';
}

function wrapHtml(title, bodyHtml) {
  const name = escapeHtml(brandName());
  const accent = escapeHtml(config.ACCENT_COLOR || '#8b7bf0');
  const logo = config.LOGO_PATH
    ? `<img src="${escapeHtml(config.LOGO_PATH)}" alt="${name}" style="max-height:56px;margin:0 auto 20px;display:block;">`
    : `<h1 style="color:${accent};margin:0 0 20px;font-size:24px;text-align:center;">${name}</h1>`;

  return `<!DOCTYPE html>
<html lang="el">
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">
    <div style="background:#ffffff;border-radius:12px;padding:28px 24px;border:1px solid #e4e4e7;">
      ${logo}
      <h2 style="color:${accent};margin:0 0 16px;font-size:20px;line-height:1.3;">${escapeHtml(title)}</h2>
      ${bodyHtml}
    </div>
    <p style="color:#71717a;font-size:12px;line-height:1.5;margin:16px 8px 0;text-align:center;">
      ${name}
      ${config.COMPANY_EMAIL ? `<br>${escapeHtml(config.COMPANY_EMAIL)}` : ''}
      ${config.COMPANY_PHONE ? `<br>${escapeHtml(config.COMPANY_PHONE)}` : ''}
    </p>
  </div>
</body>
</html>`;
}

function guideStepsText({ appLink, includePasswordNote = true }) {
  const lines = [
    'Οδηγίες χρήσης',
    '',
    '1) Σύνδεση',
    `   • Ανοίξτε: ${appLink}`,
    '   • Καταχωρήστε το κινητό σας τηλέφωνο',
  ];
  if (includePasswordNote) {
    lines.push('   • Καταχωρήστε τον κωδικό πρόσβασης που σας στάλθηκε');
  } else {
    lines.push('   • Καταχωρήστε τον κωδικό πρόσβασης που έχετε ήδη λάβει');
  }
  lines.push(
    '   • Πατήστε «Σύνδεση»',
    '',
    '2) Συλλογές',
    '   • Μετά τη σύνδεση βλέπετε τις διαθέσιμες συλλογές φωτογραφιών',
    '   • Πατήστε μία συλλογή για να ανοίξετε τις εικόνες της',
    '',
    '3) Λήψη εικόνων',
    '   • Μέσα στη συλλογή επιλέξτε μία ή περισσότερες εικόνες',
    '   • Μπορείτε να επιλέξετε όλες με «Επιλογή όλων»',
    '   • Πατήστε «Λήψη» για να κατεβάσετε:',
    '     – μία εικόνα μεμονωμένα, ή',
    '     – πολλές μαζικά (όπου χρειάζεται ως αρχείο ZIP)',
    '',
    'Αν ξεχάσετε τον κωδικό, στην οθόνη σύνδεσης επιλέξτε «Ξέχασα τον κωδικό μου».'
  );
  return lines.join('\n');
}

function guideStepsHtml({ appLink, includePasswordNote = true }) {
  const passwordLine = includePasswordNote
    ? '<li>Καταχωρήστε τον <strong>κωδικό πρόσβασης</strong> που σας στάλθηκε</li>'
    : '<li>Καταχωρήστε τον <strong>κωδικό πρόσβασης</strong> που έχετε ήδη λάβει</li>';

  return `
  <div style="margin:24px 0 0;padding:16px;background:#fafafa;border-radius:8px;border:1px solid #eee;">
    <p style="margin:0 0 12px;font-weight:700;font-size:15px;">Οδηγίες χρήσης</p>
    <p style="margin:0 0 8px;font-weight:600;">1. Σύνδεση</p>
    <ol style="margin:0 0 16px;padding-left:20px;line-height:1.55;color:#333;">
      <li>Πηγαίνετε στο <a href="${escapeHtml(appLink)}" style="color:${escapeHtml(config.ACCENT_COLOR)};">${escapeHtml(appLink)}</a></li>
      <li>Καταχωρήστε το <strong>κινητό</strong> σας τηλέφωνο</li>
      ${passwordLine}
      <li>Πατήστε <strong>Σύνδεση</strong></li>
    </ol>
    <p style="margin:0 0 8px;font-weight:600;">2. Συλλογές</p>
    <ul style="margin:0 0 16px;padding-left:20px;line-height:1.55;color:#333;">
      <li>Μετά τη σύνδεση βλέπετε τις διαθέσιμες συλλογές φωτογραφιών</li>
      <li>Πατήστε μία συλλογή για να ανοίξετε τις εικόνες της</li>
    </ul>
    <p style="margin:0 0 8px;font-weight:600;">3. Λήψη εικόνων</p>
    <ul style="margin:0 0 12px;padding-left:20px;line-height:1.55;color:#333;">
      <li>Επιλέξτε μία ή περισσότερες εικόνες μέσα στη συλλογή</li>
      <li>Χρησιμοποιήστε <strong>Επιλογή όλων</strong> αν θέλετε όλες τις εικόνες</li>
      <li>Πατήστε <strong>Λήψη</strong> για μεμονωμένη ή μαζική λήψη (ZIP όπου χρειάζεται)</li>
    </ul>
    <p style="margin:0;font-size:13px;color:#666;line-height:1.5;">
      Αν ξεχάσετε τον κωδικό, στην οθόνη σύνδεσης επιλέξτε «Ξέχασα τον κωδικό μου».
    </p>
  </div>`;
}

function passwordBlockHtml(code) {
  return `
  <div style="margin:16px 0;padding:16px;background:#111;border-radius:8px;text-align:center;">
    <p style="margin:0 0 6px;color:#a1a1aa;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;">Κωδικός πρόσβασης</p>
    <p style="margin:0;color:#fff;font-family:Consolas,Monaco,monospace;font-size:28px;letter-spacing:0.12em;font-weight:700;">${escapeHtml(code)}</p>
  </div>`;
}

function authEmailContent({ kind, code, phone }) {
  const appLink = appUrl();
  const name = brandName();
  const isReset = kind === 'reset';
  const title = isReset ? 'Νέος κωδικός πρόσβασης' : 'Καλώς ήρθατε';
  const introText = isReset
    ? `Σας στέλνουμε νέο κωδικό πρόσβασης για την πλατφόρμα φωτογραφιών της ${name}.`
    : `Σας στέλνουμε τον κωδικό πρόσβασης για την πλατφόρμα φωτογραφιών της ${name}.`;
  const subject = isReset
    ? `${name} — Νέος κωδικός πρόσβασης`
    : `${name} — Κωδικός πρόσβασης & οδηγίες`;

  const phoneLine = phone ? `Κινητό σύνδεσης: ${phone}` : null;

  const text = [
    name,
    '',
    introText,
    '',
    phoneLine,
    `Κωδικός πρόσβασης: ${code}`,
    '',
    guideStepsText({ appLink, includePasswordNote: true }),
    '',
    `Σύνδεση: ${appLink}`,
  ].filter((line) => line !== null).join('\n');

  const html = wrapHtml(
    title,
    `
    <p style="margin:0 0 12px;line-height:1.55;">${escapeHtml(introText)}</p>
    ${phone ? `<p style="margin:0 0 8px;color:#555;">Κινητό σύνδεσης: <strong>${escapeHtml(phone)}</strong></p>` : ''}
    ${passwordBlockHtml(code)}
    <p style="margin:0 0 8px;text-align:center;">
      <a href="${escapeHtml(appLink)}" style="display:inline-block;background:${escapeHtml(config.ACCENT_COLOR)};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">
        Άνοιγμα εφαρμογής
      </a>
    </p>
    ${guideStepsHtml({ appLink, includePasswordNote: true })}
    `
  );

  return { subject, text, html };
}

function newCollectionEmailContent({ collectionName, coverImageUrl, unsubscribeLink }) {
  const appLink = appUrl();
  const name = brandName();
  const title = 'Νέα συλλογή διαθέσιμη';
  const subject = `${name} — Νέα συλλογή: ${collectionName}`;
  const intro = `Η συλλογή «${collectionName}» είναι πλέον διαθέσιμη στην πλατφόρμα φωτογραφιών της ${name}.`;

  const coverHtml = coverImageUrl
    ? `<p style="margin:0 0 16px;"><img src="${escapeHtml(coverImageUrl)}" alt="" style="max-width:100%;border-radius:8px;display:block;"></p>`
    : '';

  const text = [
    name,
    '',
    intro,
    '',
    guideStepsText({ appLink, includePasswordNote: false }),
    '',
    `Σύνδεση: ${appLink}`,
    unsubscribeLink ? `\nΑπεγγραφή: ${unsubscribeLink}` : '',
  ].join('\n');

  const html = wrapHtml(
    title,
    `
    ${coverHtml}
    <p style="margin:0 0 12px;line-height:1.55;">${escapeHtml(intro)}</p>
    <p style="margin:0 0 8px;text-align:center;">
      <a href="${escapeHtml(appLink)}" style="display:inline-block;background:${escapeHtml(config.ACCENT_COLOR)};color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">
        Δείτε τη συλλογή
      </a>
    </p>
    ${guideStepsHtml({ appLink, includePasswordNote: false })}
    ${unsubscribeLink
      ? `<p style="margin:20px 0 0;font-size:12px;color:#888;text-align:center;"><a href="${escapeHtml(unsubscribeLink)}" style="color:#888;">Απεγγραφή ειδοποιήσεων</a></p>`
      : ''}
    `
  );

  return { subject, text, html };
}

module.exports = {
  appUrl,
  authEmailContent,
  newCollectionEmailContent,
  guideStepsText,
};
