const root = document.getElementById('app-root');
const selectedIds = new Set();
let galleryData = null;
let collectionId = null;
let branding = {};

const DOWNLOAD_PREF_KEY = 'pd_download_size';
const DOWNLOAD_REMEMBER_KEY = 'pd_download_remember';
const ZIP_THRESHOLD_BYTES = 50 * 1024 * 1024;

let pendingDownloadIds = null;

function getDownloadPreference() {
  if (localStorage.getItem(DOWNLOAD_REMEMBER_KEY) === 'false') return null;
  const pref = localStorage.getItem(DOWNLOAD_PREF_KEY);
  return pref === 'web' || pref === 'full' ? pref : null;
}

function setDownloadPreference(size, remember) {
  if (remember) {
    localStorage.setItem(DOWNLOAD_PREF_KEY, size);
    localStorage.setItem(DOWNLOAD_REMEMBER_KEY, 'true');
  } else {
    localStorage.removeItem(DOWNLOAD_PREF_KEY);
    localStorage.setItem(DOWNLOAD_REMEMBER_KEY, 'false');
  }
}

function formatApproxBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value >= 1e9) return `περίπου ${(value / 1e9).toFixed(1)} GB`;
  if (value >= 1e6) return `περίπου ${Math.max(1, Math.round(value / 1e6))} MB`;
  if (value >= 1e3) return `περίπου ${Math.max(1, Math.round(value / 1e3))} KB`;
  return `περίπου ${value} B`;
}

function getSelectedDownloadableImages() {
  if (!galleryData) return [];
  return galleryData.images.filter((img) => selectedIds.has(img.id) && img.downloadable);
}

function getDownloadTargetImages() {
  if (!galleryData) return [];
  if (pendingDownloadIds?.length) {
    const idSet = new Set(pendingDownloadIds);
    return galleryData.images.filter((img) => idSet.has(img.id) && img.downloadable);
  }
  return getSelectedDownloadableImages();
}

function sumImageBytes(images, size) {
  let bytes = 0;
  for (const img of images) {
    if (size === 'web') bytes += img.webBytes || 0;
    else bytes += img.fullAvailable ? (img.fullBytes || 0) : (img.webBytes || 0);
  }
  return bytes;
}

function computeSelectionTotals(size) {
  const images = getDownloadTargetImages();
  return { count: images.length, bytes: sumImageBytes(images, size) };
}

function shouldUseZip(images, size) {
  if (images.length <= 1) return false;
  return sumImageBytes(images, size) > ZIP_THRESHOLD_BYTES;
}

function filenameFromDisposition(header) {
  if (!header) return null;
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8) return decodeURIComponent(utf8[1]);
  const plain = header.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1] : null;
}

function sizeSummaryLine(size) {
  const { count, bytes } = computeSelectionTotals(size);
  const noun = count === 1 ? 'εικόνα' : 'εικόνες';
  return `${count} ${noun} · ${formatApproxBytes(bytes)}`;
}

function closeDownloadSheet() {
  pendingDownloadIds = null;
  document.getElementById('download-sheet-host')?.classList.remove('open');
}

function openDownloadSheet() {
  const host = document.getElementById('download-sheet-host');
  if (!host) return;
  const fullOption = document.getElementById('download-opt-full');
  if (fullOption) {
    fullOption.classList.toggle('hidden', !galleryData?.fullAvailable);
  }
  document.getElementById('download-opt-web-size').textContent = sizeSummaryLine('web');
  document.getElementById('download-opt-full-size').textContent = sizeSummaryLine('full');
  const remember = document.getElementById('download-remember');
  if (remember) remember.checked = localStorage.getItem(DOWNLOAD_REMEMBER_KEY) !== 'false';
  host.classList.add('open');
}

function updateDownloadButton() {
  const btn = document.getElementById('download-btn');
  const chevron = document.getElementById('download-options-btn');
  if (!btn) return;
  const pref = getDownloadPreference();
  const archived = galleryData && galleryData.fullAvailable === false;
  if (archived) {
    btn.textContent = 'Λήψη';
    chevron?.classList.add('hidden');
    return;
  }
  if (pref) {
    btn.textContent = pref === 'web' ? 'Λήψη · eshop' : 'Λήψη · εκτύπωση';
    chevron?.classList.remove('hidden');
  } else {
    btn.textContent = 'Λήψη';
    chevron?.classList.add('hidden');
  }
}

function handleDownloadClick() {
  pendingDownloadIds = null;
  const images = getSelectedDownloadableImages();
  if (!images.length) return;

  if (galleryData?.fullAvailable === false) {
    runDownload(images, 'web');
    return;
  }
  if (images.length === 1) {
    openDownloadSheet();
    return;
  }
  const pref = getDownloadPreference();
  if (pref) {
    runDownload(images, pref);
    return;
  }
  openDownloadSheet();
}

function escapeHtml(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatPublishedDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('el-GR', { day: 'numeric', month: 'long' });
}

function toggleImageSelection(id, card) {
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  card.classList.toggle('selected', selectedIds.has(id));
  updateActionBar();
}

async function downloadSingleFile(imageId, size) {
  const effectiveSize = galleryData?.fullAvailable === false ? 'web' : size;
  const res = await fetch(
    `/api/collections/${collectionId}/download/${imageId}?size=${encodeURIComponent(effectiveSize)}`,
    { credentials: 'include' }
  );
  if (!res.ok) throw new Error('download failed');
  const blob = await res.blob();
  const filename = filenameFromDisposition(res.headers.get('Content-Disposition')) || 'image.jpg';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function downloadZip(images, size) {
  const effectiveSize = galleryData?.fullAvailable === false ? 'web' : size;
  const res = await fetch(`/api/collections/${collectionId}/download-zip`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageIds: images.map((img) => img.id), size: effectiveSize }),
  });
  if (!res.ok) throw new Error('download failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${galleryData.collectionName}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function runDownload(images, size) {
  if (!images.length) return;

  const btn = document.getElementById('download-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Προετοιμασία...';
  }

  try {
    const effectiveSize = galleryData?.fullAvailable === false ? 'web' : size;
    if (shouldUseZip(images, effectiveSize)) {
      await downloadZip(images, effectiveSize);
    } else {
      for (const img of images) {
        await downloadSingleFile(img.id, effectiveSize);
      }
    }
  } finally {
    pendingDownloadIds = null;
    if (btn) {
      btn.disabled = false;
      updateDownloadButton();
    }
  }
}

function path() {
  const p = location.pathname.replace(/\/$/, '');
  if (p === '/app' || p === '/app/login') return p;
  const m = p.match(/^\/app\/c\/(\d+)$/);
  return m ? `/app/c/${m[1]}` : '/app';
}

function navigate(to) {
  history.pushState({}, '', to);
  render();
}

async function api(url, options = {}) {
  const res = await fetch(url, { credentials: 'include', ...options });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 || data.requiresLogin) {
    navigate('/app/login');
    throw new Error('login');
  }
  return { res, data };
}

async function applyBranding() {
  branding = await fetch('/api/branding').then(r => r.json());
  document.documentElement.style.setProperty('--accent', branding.accentColor || '#8b7bf0');
  if (branding.companyName) document.title = branding.companyName;
  const footer = document.getElementById('site-footer');
  const parts = [];
  if (branding.companyName) parts.push(`<p><strong>${escapeHtml(branding.companyName)}</strong></p>`);
  if (branding.companyPhone) parts.push(`<p>${escapeHtml(branding.companyPhone)}</p>`);
  if (branding.companyEmail) parts.push(`<p>${escapeHtml(branding.companyEmail)}</p>`);
  if (branding.companyAddress) parts.push(`<p>${escapeHtml(branding.companyAddress)}</p>`);
  if (branding.footerText) parts.push(`<p>${escapeHtml(branding.footerText)}</p>`);
  if (parts.length) { footer.innerHTML = parts.join(''); footer.classList.remove('hidden'); }
}

function renderLogin() {
  const loginHeading = branding.logoPath
    ? `<img src="${escapeHtml(branding.logoPath)}" alt="" class="login-logo">`
    : `<h1>${escapeHtml(branding.companyName || 'Kollekta')}</h1>`;
  if (!branding.logoPath && !branding.companyName) document.title = 'Kollekta';
  root.innerHTML = `<div class="login-screen">
    <div class="form-card">
      <div class="login-brand" id="login-brand">
        ${loginHeading}
      </div>
      <div id="login-form-wrap">
        <div class="form-field">
          <label for="phone">Κινητό τηλέφωνο</label>
          <input type="tel" id="phone" inputmode="numeric" placeholder="69…" autocomplete="tel">
        </div>
        <div class="form-field">
          <label for="code">Κωδικός πρόσβασης</label>
          <input type="text" id="code" class="code-input" placeholder="Κωδικός" autocapitalize="characters" autocomplete="off">
        </div>
        <p id="login-error" class="error hidden"></p>
        <button class="btn btn-primary" id="login-btn">Σύνδεση</button>
        <button class="link-btn" id="forgot-btn">Ξέχασα τον κωδικό μου</button>
      </div>
      <div id="reset-form-wrap" class="hidden">
        <div class="login-brand">
          <span class="reset-icon" aria-hidden="true">🔑</span>
          <h1>Επαναφορά</h1>
        </div>
        <p class="reset-intro">Αν ο αριθμός είναι καταχωρημένος, θα λάβεις νέο κωδικό.</p>
        <div class="form-field">
          <label for="reset-phone">Κινητό τηλέφωνο</label>
          <input type="tel" id="reset-phone" inputmode="numeric" placeholder="69…">
        </div>
        <p id="reset-msg" class="hidden"></p>
        <button class="btn btn-primary" id="reset-btn">Αποστολή νέου κωδικού</button>
        <button class="link-btn" id="back-login-btn">← Επιστροφή στη σύνδεση</button>
      </div>
    </div>
  </div>`;

  document.getElementById('code').oninput = (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  document.getElementById('forgot-btn').onclick = () => {
    document.getElementById('login-brand')?.classList.add('hidden');
    document.getElementById('login-form-wrap').classList.add('hidden');
    document.getElementById('reset-form-wrap').classList.remove('hidden');
  };
  document.getElementById('back-login-btn').onclick = () => {
    document.getElementById('login-brand')?.classList.remove('hidden');
    document.getElementById('reset-form-wrap').classList.add('hidden');
    document.getElementById('login-form-wrap').classList.remove('hidden');
  };
  document.getElementById('login-btn').onclick = async () => {
    const err = document.getElementById('login-error');
    err.classList.add('hidden');
    const res = await fetch('/api/auth/login', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: document.getElementById('phone').value, code: document.getElementById('code').value }),
    });
    if (res.status === 429) {
      err.textContent = 'Πολλές προσπάθειες. Δοκίμασε ξανά αργότερα.';
      err.classList.remove('hidden'); return;
    }
    if (!res.ok) {
      err.textContent = 'Λάθος αριθμός ή κωδικός.';
      err.classList.remove('hidden'); return;
    }
    navigate('/app');
  };
  document.getElementById('reset-btn').onclick = async () => {
    await fetch('/api/auth/reset', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: document.getElementById('reset-phone').value }),
    });
    const msg = document.getElementById('reset-msg');
    msg.textContent = 'Αν ο αριθμός είναι καταχωρημένος, θα λάβεις νέο κωδικό.';
    msg.classList.remove('hidden');
  };
}

async function renderCollections() {
  let me, collections;
  try {
    me = (await api('/api/auth/me')).data;
    collections = (await api('/api/collections')).data;
  } catch { return; }

  root.innerHTML = `<header class="header header-collections">
    <h1>Συλλογές</h1>
    <span class="header-user">${escapeHtml(me.name || '')}</span>
    <button class="btn-icon" id="logout-btn" type="button" aria-label="Έξοδος" title="Έξοδος">⎋</button>
  </header>
  <div class="screen collections-screen">
    <h2 class="page-title">Συλλογές</h2>
    <div class="collection-list" id="collection-list"></div>
  </div>`;

  document.getElementById('logout-btn').onclick = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    navigate('/app/login');
  };

  const list = document.getElementById('collection-list');
  if (!collections.length) {
    list.innerHTML = '<p class="empty">Δεν υπάρχουν δημοσιευμένες συλλογές ακόμα.</p>';
    return;
  }
  list.innerHTML = collections.map(c => {
    const datePart = formatPublishedDate(c.publishedAt);
    const meta = datePart ? `${datePart} · ${c.imageCount} εικόνες` : `${c.imageCount} εικόνες`;
    const cover = c.coverThumbUrl
      ? `<img src="${escapeHtml(c.coverThumbUrl)}" alt="" loading="lazy">`
      : '<div class="collection-card-placeholder">Χωρίς εξώφυλλο</div>';
    return `
    <article class="collection-card" data-id="${c.id}">
      <div class="collection-card-cover">${cover}
        <div class="collection-card-scrim"><h2>${escapeHtml(c.name)}</h2></div>
      </div>
      <div class="collection-card-meta"><p>${meta}</p></div>
    </article>`;
  }).join('');
  list.querySelectorAll('.collection-card').forEach(card => {
    card.onclick = () => navigate(`/app/c/${card.dataset.id}`);
  });
}

function updateActionBar() {
  const bar = document.getElementById('action-bar');
  if (!bar) return;
  const count = selectedIds.size;
  const noun = count === 1 ? 'επιλεγμένη' : 'επιλεγμένες';
  document.getElementById('selected-count').textContent = `${count} ${noun}`;
  const sizeBtn = document.getElementById('selected-size');
  if (sizeBtn) {
    sizeBtn.classList.toggle('hidden', count === 0);
    if (count > 0) {
      const pref = getDownloadPreference() || 'web';
      sizeBtn.textContent = `${sizeSummaryLine(pref)} ▾`;
    }
  }
  bar.classList.toggle('hidden', count === 0);
  updateDownloadButton();
}

async function renderGallery() {
  collectionId = Number(path().split('/').pop());
  selectedIds.clear();
  let data;
  try { data = (await api(`/api/collections/${collectionId}`)).data; } catch { return; }
  galleryData = data;

  root.innerHTML = `<header class="header gallery-header">
    <button class="btn-back" id="back-btn" type="button" aria-label="Πίσω">←</button>
    <h1>${escapeHtml(data.collectionName)}</h1>
    <div class="header-actions">
      <button class="btn-ghost" id="select-all-btn" type="button">Επιλογή όλων</button>
      <button class="btn-ghost" id="clear-header-btn" type="button">Καθαρισμός</button>
    </div>
  </header>
  ${data.hasPurgedImages ? '<p class="hint-banner">Αρχειοθετημένη συλλογή — οι εικόνες είναι σε ανάλυση web.</p>' : ''}
  <div class="screen gallery-screen"><div class="gallery-grid" id="gallery-grid"></div></div>
  <div id="action-bar" class="action-bar hidden">
    <div class="action-bar-info">
      <span id="selected-count">0 επιλεγμένες</span>
      <button type="button" id="selected-size" class="hidden"></button>
    </div>
    <div class="action-buttons">
      <div class="download-split">
        <button class="btn btn-primary" id="download-btn">Λήψη</button>
        <button class="btn btn-primary download-chevron-btn hidden" id="download-options-btn" type="button" aria-label="Αλλαγή μεγέθους">▾</button>
      </div>
    </div>
    <button class="action-dismiss" id="clear-btn" type="button" aria-label="Καθαρισμός">×</button>
  </div>
  <div id="download-sheet-host" class="download-sheet-host">
    <div class="download-sheet-backdrop" id="download-sheet-backdrop"></div>
    <div class="download-sheet" role="dialog" aria-labelledby="download-sheet-title">
      <div class="download-sheet-handle" aria-hidden="true"></div>
      <div class="download-sheet-header">
        <h2 id="download-sheet-title">Μέγεθος λήψης</h2>
        <button type="button" class="download-sheet-close" id="download-sheet-close" aria-label="Κλείσιμο">×</button>
      </div>
      <button type="button" class="download-option" id="download-opt-web" data-size="web">
        <div class="download-option-text">
          <strong>Για eshop και social media</strong>
          <span id="download-opt-web-size"></span>
        </div>
        <span class="download-option-radio" aria-hidden="true"></span>
      </button>
      <button type="button" class="download-option" id="download-opt-full" data-size="full">
        <div class="download-option-text">
          <strong>Για εκτύπωση και καταλόγους</strong>
          <span id="download-opt-full-size"></span>
        </div>
        <span class="download-option-radio" aria-hidden="true"></span>
      </button>
      <label class="checkbox-label download-remember">
        <input type="checkbox" id="download-remember" checked> Να θυμάσαι την επιλογή μου
      </label>
    </div>
  </div>
  <div id="lightbox" class="lightbox hidden">
    <button class="lightbox-close" id="lightbox-close">×</button>
    <img id="lightbox-image" alt="">
    <p id="lightbox-caption"></p>
  </div>`;

  document.getElementById('back-btn').onclick = () => navigate('/app');
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = data.images.map(img => `
    <article class="thumb-card ${img.downloadable ? '' : 'locked'} ${selectedIds.has(img.id) ? 'selected' : ''}"
      data-id="${img.id}" data-downloadable="${img.downloadable}" data-web="${escapeHtml(img.webUrl)}">
      <img src="${escapeHtml(img.thumbUrl)}" loading="lazy" alt="">
      <div class="thumb-scrim-top" aria-hidden="true"></div>
      <div class="thumb-scrim-bottom" aria-hidden="true"></div>
      ${img.productCode ? `<span class="product-tag mono">${escapeHtml(img.productCode)}</span>` : ''}
      ${img.downloadable ? `
        <div class="thumb-actions">
          <button type="button" class="check-toggle" aria-label="Επιλογή">✓</button>
          <button type="button" class="thumb-download" aria-label="Λήψη">↓</button>
        </div>` : '<span class="lock-icon" aria-hidden="true">🔒</span>'}
    </article>`).join('');

  function handleTileDownload(imageId) {
    pendingDownloadIds = [imageId];
    if (galleryData?.fullAvailable === false) {
      runDownload(getDownloadTargetImages(), 'web');
      return;
    }
    openDownloadSheet();
  }

  grid.querySelectorAll('.thumb-card').forEach(card => {
    const id = Number(card.dataset.id);
    card.querySelector('.check-toggle')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleImageSelection(id, card);
    });
    card.querySelector('.thumb-download')?.addEventListener('click', (e) => {
      e.stopPropagation();
      handleTileDownload(id);
    });
    card.onclick = () => {
      if (card.dataset.downloadable !== 'true') {
        document.getElementById('lightbox-image').src = card.dataset.web;
        document.getElementById('lightbox-caption').textContent = 'Δεν είναι μέρος της παραγγελίας σου — μόνο προεπισκόπηση.';
        document.getElementById('lightbox').classList.remove('hidden');
        return;
      }
      toggleImageSelection(id, card);
    };
  });

  document.getElementById('lightbox-close').onclick = () => document.getElementById('lightbox').classList.add('hidden');
  const clearSelection = () => {
    selectedIds.clear();
    grid.querySelectorAll('.selected').forEach((c) => c.classList.remove('selected'));
    updateActionBar();
  };
  document.getElementById('clear-btn').onclick = clearSelection;
  document.getElementById('clear-header-btn').onclick = clearSelection;
  document.getElementById('select-all-btn').onclick = () => {
    grid.querySelectorAll('.thumb-card[data-downloadable="true"]').forEach((card) => {
      const id = Number(card.dataset.id);
      selectedIds.add(id);
      card.classList.add('selected');
    });
    updateActionBar();
  };
  document.getElementById('selected-size')?.addEventListener('click', () => {
    pendingDownloadIds = null;
    if (selectedIds.size) openDownloadSheet();
  });
  document.getElementById('download-btn').onclick = handleDownloadClick;
  document.getElementById('download-options-btn').onclick = (e) => {
    e.stopPropagation();
    pendingDownloadIds = null;
    openDownloadSheet();
  };
  document.getElementById('download-sheet-close').onclick = closeDownloadSheet;
  document.getElementById('download-sheet-backdrop').onclick = closeDownloadSheet;
  document.querySelectorAll('.download-option').forEach((btn) => {
    btn.onclick = async () => {
      const size = btn.dataset.size;
      const remember = document.getElementById('download-remember').checked;
      const images = getDownloadTargetImages();
      setDownloadPreference(size, remember);
      document.getElementById('download-sheet-host')?.classList.remove('open');
      await runDownload(images, size);
    };
  });
  updateDownloadButton();
}

async function render() {
  const p = path();
  if (p === '/app/login') return renderLogin();
  if (p.startsWith('/app/c/')) return renderGallery();
  return renderCollections();
}

window.onpopstate = render;
applyBranding().then(render);
