const API = '/api/admin';

const ACCESS_MODES = [
  { value: 'full_access', label: 'Πλήρης πρόσβαση' },
  { value: 'browse_all_download_order', label: 'Περιήγηση + λήψη παραγγελίας' },
  { value: 'order_only', label: 'Μόνο παραγγελία' },
];

let currentCollectionId = null;
let activeCustomersCount = 0;
let allCustomers = [];
let allTags = [];
let customerFiltersBound = false;
let galleryModalCollectionId = null;
let galleryModalImages = [];
const gallerySelectedIds = new Set();
let imageUploadInProgress = false;

const IMAGE_BATCH_MAX_BYTES = 50 * 1024 * 1024;
const IMAGE_BATCH_MAX_FILES = 8;
const IMAGE_BATCH_UPLOAD_TIMEOUT_MS = 45 * 60 * 1000;
const IMAGE_BATCH_SLOW_SECONDS = 90;
const IMAGE_BATCH_FAST_SECONDS = 15;
const IMAGE_LARGE_UPLOAD_BYTES = 1024 * 1024 * 1024;
const IMAGE_UPLOAD_PROBE_BPS = (5 * 1e6) / 8;
const IMAGE_UPLOAD_RETRY_DELAYS_MS = [2000, 5000, 12000];

function fileUploadKey(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function sumFileBytes(files) {
  return files.reduce((sum, file) => sum + (file.size || 0), 0);
}

function formatUploadSpeed(bytesPerSecond) {
  if (!bytesPerSecond || bytesPerSecond <= 0) return '';
  if (bytesPerSecond >= 1e6) return `${(bytesPerSecond / 1e6).toFixed(1)} MB/s`;
  if (bytesPerSecond >= 1e3) return `${(bytesPerSecond / 1e3).toFixed(1)} KB/s`;
  return `${Math.round(bytesPerSecond)} B/s`;
}

function formatUploadEta(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const mins = Math.ceil(seconds / 60);
  if (mins <= 1) return 'περίπου 1 λεπτό ακόμα';
  return `περίπου ${mins} λεπτά ακόμα`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeHtml(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function parseTagsString(tags) {
  if (!tags) return [];
  return String(tags).split(',').map((t) => t.trim()).filter(Boolean);
}

function fmtBytes(n) {
  const value = Number(n) || 0;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)} GB`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)} MB`;
  if (value >= 1e3) return `${Math.round(value / 1e3)} KB`;
  return `${value} B`;
}

function statusPill(status) {
  if (status === 'active') return '<span class="pill pill-status-active">Ενεργός</span>';
  if (status === 'disabled') return '<span class="pill pill-status-disabled">Ανενεργός</span>';
  return `<span class="pill">${escapeHtml(status || '—')}</span>`;
}

function accessModeSelectHtml(customerId, currentMode, { compact = false } = {}) {
  const cls = compact ? 'access-mode-select access-mode-select-compact' : 'access-mode-select';
  return `<select class="${cls}" data-customer-id="${customerId}" aria-label="Τρόπος πρόσβασης">
    ${ACCESS_MODES.map((mode) => `
      <option value="${mode.value}" ${mode.value === currentMode ? 'selected' : ''}>${escapeHtml(mode.label)}</option>`).join('')}
  </select>`;
}

function messageKindLabel(kind) {
  const map = {
    welcome: 'Καλωσόρισμα',
    reset: 'Επαναφορά',
    new_collection: 'Νέα συλλογή',
  };
  return map[kind] || kind || '—';
}

function messageStatusPill(status) {
  if (status === 'sent') return '<span class="pill pill-msg-sent">Στάλθηκε</span>';
  if (status === 'failed') return '<span class="pill pill-msg-failed">Απέτυχε</span>';
  return `<span class="pill">${escapeHtml(status)}</span>`;
}

function renderTagList(tags) {
  const list = parseTagsString(tags);
  if (!list.length) return '—';
  return `<span class="tag-list">${list.map((t) => `<span class="tag-pill">${escapeHtml(t)}</span>`).join('')}</span>`;
}

function computeReachFromTags(tags) {
  if (!tags.length) return 0;
  return allCustomers.filter((c) => c.status === 'active').filter((c) => {
    const customerTags = parseTagsString(c.tags);
    return tags.some((t) => customerTags.includes(t));
  }).length;
}

function updateReachPreview() {
  const el = document.getElementById('reach-summary');
  if (!el) return;
  const visibility = document.querySelector('input[name="visibility"]:checked')?.value || 'all';
  let reach = activeCustomersCount;
  if (visibility === 'selected') {
    const tags = [...document.querySelectorAll('.tag-chip.selected')].map((chip) => chip.dataset.tag);
    reach = computeReachFromTags(tags);
  }
  el.innerHTML = `Θα το δουν <span class="reach-count">${reach}</span> από <span class="reach-total">${activeCustomersCount}</span> ενεργούς πελάτες.`;
}

function renderStorageChart(snapshots) {
  const ordered = [...(snapshots || [])].reverse();
  if (!ordered.length) {
    return '<p class="subtitle">Δεν υπάρχουν ακόμα δεδομένα τάσης.</p>';
  }
  const values = ordered.map((s) => Number(s.total_bytes) || 0);
  const w = 400;
  const h = 100;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const points = values.map((v, i) => {
    const x = (i / Math.max(values.length - 1, 1)) * w;
    const y = h - 6 - ((v - min) / range) * (h - 12);
    return `${x},${y}`;
  }).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" class="storage-chart" preserveAspectRatio="none" aria-hidden="true">
    <line class="axis" x1="0" y1="${h - 1}" x2="${w}" y2="${h - 1}"></line>
    <polyline points="${points}"></polyline>
  </svg>`;
}

function storageProgressClass(usedPct) {
  const warn = Number(getComputedStyle(document.documentElement).getPropertyValue('--storage-warn-percent')) || 75;
  const critical = Number(getComputedStyle(document.documentElement).getPropertyValue('--storage-critical-percent')) || 90;
  if (usedPct >= critical) return 'critical';
  if (usedPct >= warn) return 'warn';
  return '';
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, { credentials: 'include', ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Σφάλμα αιτήματος.');
  return data;
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(`view-${name}`).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
}

function setStatus(id, msg, type = '') {
  const el = document.getElementById(id);
  if (!el) return;
  if (!msg) {
    el.innerHTML = '';
    el.className = 'notice-slot hidden';
    el.hidden = true;
    return;
  }
  const titles = { success: 'Επιτυχία', error: 'Σφάλμα', info: 'Ενημέρωση' };
  const title = titles[type] || titles.info;
  el.hidden = false;
  el.className = `notice-slot notice-banner notice-${type || 'info'}`;
  el.innerHTML = `<p class="notice-title">${title}</p><p class="notice-text">${escapeHtml(msg)}</p>`;
}

function renderFileUploadRow({ inputId, accept, buttonId, buttonLabel, pickLabel, multiple = false }) {
  const multiAttr = multiple ? ' multiple' : '';
  return `
    <div class="step-actions">
      <label class="btn btn-secondary file-btn" for="${inputId}">${pickLabel}</label>
      <input type="file" id="${inputId}" class="file-picker-input" accept="${accept}"${multiAttr} hidden>
      <span class="file-picker-name" id="${inputId}-name">Δεν έχει επιλεγεί αρχείο</span>
      <button type="button" class="btn btn-primary" id="${buttonId}">${buttonLabel}</button>
    </div>`;
}

function bindFilePickerLabel(inputId) {
  const input = document.getElementById(inputId);
  const nameEl = document.getElementById(`${inputId}-name`);
  if (!input || !nameEl) return;
  input.addEventListener('change', () => {
    if (!input.files?.length) {
      nameEl.textContent = 'Δεν έχει επιλεγεί αρχείο';
      return;
    }
    if (input.multiple) {
      const noun = input.files.length === 1 ? 'αρχείο' : 'αρχεία';
      nameEl.textContent = `${input.files.length} ${noun} επιλεγμένα`;
      return;
    }
    nameEl.textContent = input.files[0].name;
  });
}

function showToast(message, type = 'success', title = '') {
  const host = document.getElementById('toast-host');
  const msg = document.getElementById('toast-message');
  const titleEl = document.getElementById('toast-title');
  if (!host || !msg) return;
  if (titleEl) {
    titleEl.textContent = title || (type === 'error' ? 'Σφάλμα' : 'Ολοκληρώθηκε');
    titleEl.classList.toggle('hidden', !titleEl.textContent);
  }
  msg.textContent = message;
  host.classList.remove('hidden', 'toast-error', 'toast-success');
  host.classList.add(type === 'error' ? 'toast-error' : 'toast-success');
}

function setUploadLoading(active, message = 'Ανέβασμα εικόνων...', options = {}) {
  const overlay = document.getElementById('upload-overlay');
  const text = document.getElementById('upload-overlay-text');
  const progressWrap = document.getElementById('upload-overlay-progress-wrap');
  const progressBar = document.getElementById('upload-overlay-progress');
  const progressLabel = document.getElementById('upload-overlay-progress-label');
  const failuresEl = document.getElementById('upload-overlay-failures');
  const { progress = null, blockNavigation = false, failures = [] } = options;

  if (!overlay) return;
  if (text) text.textContent = message;
  overlay.classList.toggle('hidden', !active);
  overlay.setAttribute('aria-busy', active ? 'true' : 'false');
  document.getElementById('upload-images-btn')?.toggleAttribute('disabled', active);
  document.getElementById('back-collection-btn')?.toggleAttribute('disabled', active && blockNavigation);

  const showProgress = active && progress && progress.total > 0;
  progressWrap?.classList.toggle('hidden', !showProgress);
  if (showProgress && progressBar) {
    const pct = Math.min(100, Math.round((progress.current / progress.total) * 100));
    progressBar.style.width = `${pct}%`;
    progressBar.parentElement?.setAttribute('aria-valuenow', String(pct));
  }
  if (progressLabel) {
    progressLabel.textContent = showProgress
      ? `${Math.min(progress.total, Math.floor(progress.current))} / ${progress.total}`
      : '';
  }

  if (failuresEl) {
    const list = failures.length ? failures : [];
    failuresEl.classList.toggle('hidden', !list.length);
    failuresEl.innerHTML = list.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  }

  if (blockNavigation) {
    if (active) {
      imageUploadInProgress = true;
      window.addEventListener('beforeunload', beforeUnloadDuringImageUpload);
    } else {
      imageUploadInProgress = false;
      window.removeEventListener('beforeunload', beforeUnloadDuringImageUpload);
    }
  }
}

function beforeUnloadDuringImageUpload(event) {
  event.preventDefault();
  event.returnValue = '';
}

function createImageUploadSession(files) {
  const pending = files.filter((file) => file);
  return {
    allFiles: pending,
    queue: [...pending],
    uploadedKeys: new Set(),
    failedFiles: [],
    totalBytes: sumFileBytes(pending),
    completedBytes: 0,
    inFlightBytes: 0,
    bytesPerSecond: null,
    adaptiveMaxBytes: IMAGE_BATCH_MAX_BYTES,
    adaptiveMaxFiles: IMAGE_BATCH_MAX_FILES,
    firstBatchDone: false,
    isUploaded(file) {
      return this.uploadedKeys.has(fileUploadKey(file));
    },
    completedCount() {
      return this.allFiles.filter((file) => this.isUploaded(file)).length;
    },
    remainingBytes() {
      return this.allFiles
        .filter((file) => !this.isUploaded(file) && !this.failedFiles.some((f) => f.file === file))
        .reduce((sum, file) => sum + file.size, 0);
    },
    buildNextBatch() {
      const batch = [];
      let batchBytes = 0;
      while (this.queue.length) {
        const file = this.queue[0];
        if (this.isUploaded(file)) {
          this.queue.shift();
          continue;
        }
        if (this.failedFiles.some((entry) => entry.file === file)) {
          this.queue.shift();
          continue;
        }
        if (batch.length >= this.adaptiveMaxFiles) break;
        if (batch.length > 0 && batchBytes + file.size > this.adaptiveMaxBytes) break;
        batch.push(this.queue.shift());
        batchBytes += file.size;
      }
      return batch;
    },
    markResults(results, batch) {
      for (const result of results || []) {
        const file = batch.find((item) => item.name === result.filename);
        if (!file || this.isUploaded(file)) continue;
        if (result.ok) {
          this.uploadedKeys.add(fileUploadKey(file));
          this.completedBytes += file.size;
        } else {
          this.failedFiles.push({ file, error: result.error || 'Αποτυχία ανεβάσματος.' });
        }
      }
    },
    markFailures(batch, errorMessage) {
      for (const file of batch) {
        if (this.isUploaded(file)) continue;
        if (this.failedFiles.some((entry) => entry.file === file)) continue;
        this.failedFiles.push({ file, error: errorMessage });
      }
    },
    adaptAfterBatch(batchBytes, durationMs) {
      const seconds = Math.max(durationMs / 1000, 0.1);
      const bps = batchBytes / seconds;
      this.bytesPerSecond = this.bytesPerSecond == null
        ? bps
        : this.bytesPerSecond * 0.6 + bps * 0.4;

      const impliedDuration = this.adaptiveMaxBytes / Math.max(this.bytesPerSecond, 1);
      if (impliedDuration > IMAGE_BATCH_SLOW_SECONDS) {
        this.adaptiveMaxBytes = Math.max(4 * 1024 * 1024, Math.floor(this.adaptiveMaxBytes / 2));
        this.adaptiveMaxFiles = Math.max(1, Math.floor(this.adaptiveMaxFiles / 2));
      } else if (seconds < IMAGE_BATCH_FAST_SECONDS) {
        this.adaptiveMaxBytes = Math.min(IMAGE_BATCH_MAX_BYTES, Math.ceil(this.adaptiveMaxBytes * 1.3));
        this.adaptiveMaxFiles = Math.min(IMAGE_BATCH_MAX_FILES, this.adaptiveMaxFiles + 1);
      }
    },
    progressState() {
      const total = this.allFiles.length;
      const currentBytes = this.completedBytes + this.inFlightBytes;
      const current = this.totalBytes ? (currentBytes / this.totalBytes) * total : this.completedCount();
      const done = Math.min(total, Math.floor(current));
      const speed = this.bytesPerSecond;
      let message = `Ανέβασμα ${done} από ${total}`;
      if (speed && speed > 0) {
        message += ` · ${formatUploadSpeed(speed)}`;
        const eta = formatUploadEta(this.remainingBytes() / speed);
        if (eta) message += ` · ${eta}`;
      }
      return { current, total, message };
    },
  };
}

function isRetryableUploadError(err) {
  return err?.status === 408 || err?.status === 413 || err?.status === 0;
}

function uploadImageBatchXHR(batch, { onUploadProgress } = {}) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    batch.forEach((file) => fd.append('images', file));

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/collections/${currentCollectionId}/images`);
    xhr.withCredentials = true;
    xhr.timeout = IMAGE_BATCH_UPLOAD_TIMEOUT_MS;

    xhr.upload.onprogress = (event) => {
      if (!onUploadProgress || !event.lengthComputable) return;
      onUploadProgress({ loaded: event.loaded, total: event.total });
    };

    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText || '{}');
      } catch {
        data = {};
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
        return;
      }
      const error = new Error(data.error || 'Σφάλμα αιτήματος.');
      error.status = xhr.status;
      reject(error);
    };

    xhr.onerror = () => {
      const error = new Error('Σφάλμα δικτύου κατά το ανέβασμα.');
      error.status = 0;
      reject(error);
    };

    xhr.ontimeout = () => {
      const error = new Error('Έληξε ο χρόνος αναμονής για την παρτίδα.');
      error.status = 408;
      reject(error);
    };

    xhr.send(fd);
  });
}

async function uploadBatchWithRetries(batch, session, refreshUi) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const pending = batch.filter((file) => (
      !session.isUploaded(file)
      && !session.failedFiles.some((entry) => entry.file === file)
    ));
    if (!pending.length) return;

    const tryCount = Math.max(1, Math.ceil(pending.length / (2 ** attempt)));
    const slice = pending.slice(0, tryCount);
    const rest = pending.slice(tryCount);

    if (attempt > 0) {
      await sleep(IMAGE_UPLOAD_RETRY_DELAYS_MS[attempt - 1]);
    }

    try {
      const started = performance.now();
      const response = await uploadImageBatchXHR(slice, {
        onUploadProgress: ({ loaded }) => {
          session.inFlightBytes = loaded;
          refreshUi();
        },
      });
      session.inFlightBytes = 0;
      session.markResults(response.results || [], slice);
      session.adaptAfterBatch(sumFileBytes(slice), performance.now() - started);
      refreshUi();

      if (rest.length) {
        await uploadBatchWithRetries(rest, session, refreshUi);
      }
      return;
    } catch (err) {
      session.inFlightBytes = 0;
      refreshUi();
      if (!isRetryableUploadError(err) || attempt === 2) {
        session.markFailures(slice, err.message || 'Αποτυχία ανεβάσματος.');
        if (rest.length) {
          await uploadBatchWithRetries(rest, session, refreshUi);
        }
        return;
      }
    }
  }
}

function hideToast() {
  document.getElementById('toast-host')?.classList.add('hidden');
}

async function applyBranding() {
  const b = await fetch('/api/branding').then(r => r.json());
  document.documentElement.style.setProperty('--accent', b.accentColor || '#8b7bf0');
  if (b.storageWarnPercent) {
    document.documentElement.style.setProperty('--storage-warn-percent', b.storageWarnPercent);
  }
  if (b.storageCriticalPercent) {
    document.documentElement.style.setProperty('--storage-critical-percent', b.storageCriticalPercent);
  }
  document.title = b.companyName ? `${b.companyName} Admin` : 'Kollekta Admin';
  const logo = document.getElementById('brand-logo');
  const name = document.getElementById('brand-name');
  if (b.logoPath) { logo.src = b.logoPath; logo.classList.remove('hidden'); name.classList.add('hidden'); }
  else name.textContent = b.companyName || 'Kollekta';
}

async function loadCollections() {
  const list = await api('/collections');
  const el = document.getElementById('collections-list');
  if (!list.length) { el.innerHTML = '<p class="subtitle">Δεν υπάρχουν συλλογές.</p>'; return; }
  el.innerHTML = list.map(c => `
    <article class="collection-card" data-id="${c.id}">
      <h3>${escapeHtml(c.name)} <span class="pill pill-${c.status}">${c.status}</span></h3>
      <p>${c.image_count} εικόνες · ${escapeHtml(c.created_at || '')}</p>
    </article>`).join('');
  el.querySelectorAll('.collection-card').forEach(card => {
    card.onclick = () => openCollection(Number(card.dataset.id), card.querySelector('h3').textContent.split(' ')[0]);
  });
}

function renderAdminImageSummary(images, collectionId) {
  const count = images?.length || 0;
  if (!count) {
    return '<p class="subtitle admin-image-empty">Δεν υπάρχουν εικόνες ακόμα.</p>';
  }
  const preview = images.slice(0, 10).map((img) => `
    <img
      src="/api/admin/collections/${collectionId}/images/${img.id}/thumb"
      alt=""
      class="admin-image-preview-thumb"
      loading="lazy">`).join('');
  const more = count > 10 ? `<span class="admin-image-preview-more">+${count - 10}</span>` : '';
  const noun = count === 1 ? 'εικόνα' : 'εικόνες';
  return `
    <div class="admin-image-summary">
      <p class="admin-image-count">${count} ${noun}</p>
      <button type="button" class="admin-image-preview" id="manage-images-btn" aria-label="Προβολή και διαχείριση εικόνων">
        ${preview}${more}
      </button>
      <button type="button" class="btn btn-secondary" id="open-image-gallery-btn">Προβολή &amp; διαχείριση</button>
    </div>`;
}

function updateGallerySelectionUi() {
  const count = gallerySelectedIds.size;
  const selectedEl = document.getElementById('image-gallery-selected');
  const deleteBtn = document.getElementById('image-gallery-delete');
  const noun = count === 1 ? 'επιλεγμένη' : 'επιλεγμένες';
  if (selectedEl) selectedEl.textContent = `${count} ${noun}`;
  if (deleteBtn) deleteBtn.disabled = count === 0;
  document.querySelectorAll('.image-gallery-card').forEach((card) => {
    const id = Number(card.dataset.id);
    card.classList.toggle('selected', gallerySelectedIds.has(id));
    const box = card.querySelector('.image-gallery-check');
    if (box) box.checked = gallerySelectedIds.has(id);
  });
}

function renderImageGalleryModalGrid() {
  const grid = document.getElementById('image-gallery-grid');
  if (!grid) return;
  if (!galleryModalImages.length) {
    grid.innerHTML = '<p class="subtitle">Δεν υπάρχουν εικόνες.</p>';
    return;
  }
  grid.innerHTML = galleryModalImages.map((img) => `
    <article class="image-gallery-card ${gallerySelectedIds.has(img.id) ? 'selected' : ''}" data-id="${img.id}">
      <label class="image-gallery-check-wrap">
        <input type="checkbox" class="image-gallery-check" ${gallerySelectedIds.has(img.id) ? 'checked' : ''}>
        <img src="/api/admin/collections/${galleryModalCollectionId}/images/${img.id}/thumb" alt="" loading="lazy">
      </label>
      <span class="mono image-gallery-name" title="${escapeHtml(img.original_filename)}">${escapeHtml(img.original_filename)}</span>
      ${img.product_code ? `<span class="pill mono image-gallery-code">${escapeHtml(img.product_code)}</span>` : ''}
    </article>`).join('');

  grid.querySelectorAll('.image-gallery-card').forEach((card) => {
    const id = Number(card.dataset.id);
    const toggle = () => {
      if (gallerySelectedIds.has(id)) gallerySelectedIds.delete(id);
      else gallerySelectedIds.add(id);
      updateGallerySelectionUi();
    };
    card.querySelector('.image-gallery-check')?.addEventListener('change', (e) => {
      e.stopPropagation();
      if (e.target.checked) gallerySelectedIds.add(id);
      else gallerySelectedIds.delete(id);
      updateGallerySelectionUi();
    });
    card.addEventListener('click', (e) => {
      if (e.target.closest('.image-gallery-check')) return;
      toggle();
    });
  });
}

function openImageGalleryModal(collectionId, images) {
  galleryModalCollectionId = collectionId;
  galleryModalImages = images || [];
  gallerySelectedIds.clear();

  const modal = document.getElementById('image-gallery-modal');
  const subtitle = document.getElementById('image-gallery-subtitle');
  const count = galleryModalImages.length;
  const noun = count === 1 ? 'εικόνα' : 'εικόνες';
  if (subtitle) subtitle.textContent = `${count} ${noun} · επίλεξε για διαγραφή`;
  modal?.classList.remove('hidden');
  renderImageGalleryModalGrid();
  updateGallerySelectionUi();
}

function closeImageGalleryModal() {
  document.getElementById('image-gallery-modal')?.classList.add('hidden');
  gallerySelectedIds.clear();
}

async function deleteSelectedGalleryImages() {
  const ids = [...gallerySelectedIds];
  if (!ids.length || !galleryModalCollectionId) return;
  const noun = ids.length === 1 ? 'εικόνα' : 'εικόνες';
  if (!confirm(`Διαγραφή ${ids.length} ${noun}; Θα αφαιρεθούν όλα τα μεγέθη (full, web, thumb).`)) return;

  setUploadLoading(true, `Διαγραφή ${ids.length} εικόν${ids.length === 1 ? 'ας' : 'ων'}...`);
  try {
    const r = await api(`/collections/${galleryModalCollectionId}/images/bulk-delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageIds: ids }),
    });
    closeImageGalleryModal();
    await openCollection(galleryModalCollectionId, document.getElementById('detail-title').textContent);
    showToast(`Διαγράφηκαν ${r.deleted} εικόν${r.deleted === 1 ? 'α' : 'ες'}.`, 'success', 'Διαγραφή');
  } catch (err) {
    showToast(err.message || 'Αποτυχία διαγραφής.', 'error', 'Σφάλμα');
  } finally {
    setUploadLoading(false);
  }
}

function bindAdminImageSummary(collection) {
  const open = () => openImageGalleryModal(collection.id, collection.images || []);
  document.getElementById('manage-images-btn')?.addEventListener('click', open);
  document.getElementById('open-image-gallery-btn')?.addEventListener('click', open);
}

function renderWizard(collection, audience = { visibility: 'all', selectedTags: [], reachCount: 0, totalActiveCustomers: 0 }) {
  const w = document.getElementById('collection-wizard');
  const isPublished = collection.status === 'published';
  const selectedSet = new Set(audience.selectedTags || []);
  const tagPickerHtml = allTags.length
    ? `<div class="tag-chip-grid">${allTags.map(({ tag, count }) => {
        const selected = selectedSet.has(tag);
        return `<button type="button" class="tag-chip ${selected ? 'selected' : ''}" data-tag="${escapeHtml(tag)}">
          <input type="checkbox" class="tag-pick hidden" value="${escapeHtml(tag)}" ${selected ? 'checked' : ''}>
          ${escapeHtml(tag)} <span class="tag-count">${count}</span>
        </button>`;
      }).join('')}</div>`
    : '<p class="subtitle">Δεν υπάρχουν tags ακόμα. Πρόσθεσέ τα στους πελάτες (στήλη Tags ή εισαγωγή Excel).</p>';

  const publishBlock = isPublished
    ? `<div class="step-body">
        <div class="notice-slot notice-banner notice-success">
          <p class="notice-title">Δημοσιευμένη</p>
          <p class="notice-text">${escapeHtml(collection.published_at || '')}</p>
        </div>
        <div class="step-actions">
          <button class="btn btn-secondary" id="unpublish-btn">Απόσυρση</button>
        </div>
      </div>`
    : `<div class="step-body">
        <div class="publish-summary">
          <h4>Σύνοψη δημοσίευσης</h4>
          <div class="summary-row"><span>Εικόνες</span><span class="mono">${collection.images?.length || 0}</span></div>
          <div class="summary-row"><span>Φιλτράρισμα παραγγελίας</span><span class="pill">${collection.hasOrderData ? 'Ενεργό' : 'Ανενεργό'}</span></div>
          <div class="summary-row"><span>Ορατότητα</span><span class="mono">${audience.reachCount} πελάτες</span></div>
        </div>
        <label class="notify-option">
          <input type="checkbox" id="notify-checkbox">
          <div>
            <strong>Ειδοποίηση πελατών με email</strong>
            <span>Θα αποσταλεί αυτόματη ειδοποίηση στους πελάτες με email μόλις δημοσιευτεί η συλλογή.</span>
          </div>
        </label>
        <div class="step-actions">
          <button class="btn btn-primary" id="publish-btn">Δημοσίευση</button>
        </div>
        <div class="notice-slot hidden" id="status-publish" role="status"></div>
      </div>`;
  w.innerHTML = `
    <article class="step-card">
      <div class="step-header"><span class="step-number">1</span><div>
        <h3>Φωτογραφίες συλλογής</h3>
        <p>Ανέβασε τις φωτογραφίες (JPG, PNG, HEIC). Οι μεγάλες συλλογές ανεβαίνουν αυτόματα σε μικρές παρτίδες (έως 50MB).</p>
      </div></div>
      <div class="step-body">
        ${renderFileUploadRow({
          inputId: 'images-input',
          accept: 'image/*',
          buttonId: 'upload-images-btn',
          buttonLabel: 'Ανέβασμα',
          pickLabel: 'Επιλογή εικόνων',
          multiple: true,
        })}
        <div class="notice-slot hidden" id="status-images" role="status"></div>
        ${renderAdminImageSummary(collection.images, collection.id)}
      </div>
    </article>

    <article class="step-card">
      <div class="step-header"><span class="step-number">2</span><div>
        <h3>Αντιστοίχιση κωδικών <span class="badge-optional">Προαιρετικό</span></h3>
        <p>Excel: <code>filename</code>/<code>εικόνα</code> + <code>product</code>/<code>κωδικ</code>.</p>
        <div class="step-downloads">
          <a class="btn btn-secondary btn-sm" href="/api/admin/samples/image-mapping" download="kollekta-image-mapping-sample.xlsx">Δείγμα Excel</a>
          <a class="btn btn-secondary btn-sm" href="/api/admin/collections/${collection.id}/export/image-mapping" download>Λήψη Excel εικόνων</a>
        </div>
      </div></div>
      <div class="step-body">
        ${renderFileUploadRow({
          inputId: 'mapping-input',
          accept: '.xlsx,.xls',
          buttonId: 'upload-mapping-btn',
          buttonLabel: 'Ανέβασμα',
          pickLabel: 'Επιλογή Excel',
        })}
        <div class="notice-slot hidden" id="status-mapping" role="status"></div>
      </div>
    </article>

    <article class="step-card">
      <div class="step-header"><span class="step-number">3</span><div>
        <h3>Παραγγελίες <span class="badge-optional">Προαιρετικό</span></h3>
        <p>Excel: <code>erp</code>/<code>email</code>/<code>phone</code> + <code>product</code>/<code>κωδικ</code>.</p>
        <div class="step-downloads">
          <a class="btn btn-secondary btn-sm" href="/api/admin/samples/orders" download="kollekta-orders-sample.xlsx">Δείγμα Excel</a>
          <a class="btn btn-secondary btn-sm" href="/api/admin/collections/${collection.id}/export/orders" download>Λήψη Excel παραγγελιών</a>
        </div>
      </div></div>
      <div class="step-body">
        ${renderFileUploadRow({
          inputId: 'orders-input',
          accept: '.xlsx,.xls',
          buttonId: 'upload-orders-btn',
          buttonLabel: 'Ανέβασμα',
          pickLabel: 'Επιλογή Excel',
        })}
        <div class="notice-slot hidden" id="status-orders" role="status"></div>
      </div>
    </article>

    <article class="step-card">
      <div class="step-header"><span class="step-number">4</span><div>
        <h3>Ορατότητα</h3>
        <p>Ποιοι πελάτες βλέπουν αυτή τη συλλογή (ανά tag).</p>
      </div></div>
      <div class="step-body">
        <div class="visibility-options">
          <label class="visibility-option"><input type="radio" name="visibility" value="all" ${audience.visibility !== 'selected' ? 'checked' : ''}>
            <div><strong>Όλοι οι πελάτες</strong><p class="subtitle">Ανοιχτή πρόσβαση σε όλο το δίκτυο.</p></div></label>
          <label class="visibility-option"><input type="radio" name="visibility" value="selected" ${audience.visibility === 'selected' ? 'checked' : ''}>
            <div><strong>Επιλεγμένα tags</strong><p class="subtitle">Περιορισμένη πρόσβαση βάσει tags.</p></div></label>
        </div>
        <div id="tag-picker" class="tag-section ${audience.visibility === 'selected' ? '' : 'hidden'}">
          <p class="tag-section-label">Επιλογή μέσω tags</p>
          ${tagPickerHtml}
        </div>
        <p class="reach-summary" id="reach-summary">Θα το δουν <span class="reach-count">${audience.reachCount}</span> από <span class="reach-total">${audience.totalActiveCustomers}</span> ενεργούς πελάτες.</p>
        <div class="step-actions">
          <button class="btn btn-primary" id="save-visibility-btn">Αποθήκευση ορατότητας</button>
        </div>
        <div class="notice-slot hidden" id="status-visibility" role="status"></div>
      </div>
    </article>

    <article class="step-card">
      <div class="step-header"><span class="step-number">5</span><div>
        <h3>Δημοσίευση</h3>
        <p>Τελικός έλεγχος πριν τη δημοσίευση.</p>
      </div></div>
      ${publishBlock}
    </article>`;

  document.querySelectorAll('input[name="visibility"]').forEach(r => {
    r.onchange = () => {
      document.getElementById('tag-picker').classList.toggle('hidden', r.value !== 'selected' || !r.checked);
      updateReachPreview();
    };
  });
  document.querySelectorAll('.tag-chip').forEach((chip) => {
    chip.onclick = () => {
      chip.classList.toggle('selected');
      const input = chip.querySelector('.tag-pick');
      if (input) input.checked = chip.classList.contains('selected');
      updateReachPreview();
    };
  });
  document.getElementById('upload-images-btn')?.addEventListener('click', uploadImages);
  document.getElementById('upload-mapping-btn')?.addEventListener('click', uploadMapping);
  document.getElementById('upload-orders-btn')?.addEventListener('click', uploadOrders);
  document.getElementById('save-visibility-btn')?.addEventListener('click', saveVisibility);
  document.getElementById('publish-btn')?.addEventListener('click', publishCollection);
  document.getElementById('unpublish-btn')?.addEventListener('click', unpublishCollection);
  bindAdminImageSummary(collection);
  bindFilePickerLabel('images-input');
  bindFilePickerLabel('mapping-input');
  bindFilePickerLabel('orders-input');
}

async function saveVisibility() {
  const visibility = document.querySelector('input[name="visibility"]:checked')?.value || 'all';
  const tags = [...document.querySelectorAll('.tag-pick:checked')].map(el => el.value);
  const audience = await api(`/collections/${currentCollectionId}/visibility`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visibility, tags }),
  });
  setStatus('status-visibility', `Αποθηκεύτηκε. Θα το δουν ${audience.reachCount} πελάτες.`, 'success');
  const collection = await api(`/collections/${currentCollectionId}`);
  renderWizard(collection, audience);
}

async function openCollection(id, name) {
  currentCollectionId = id;
  document.getElementById('detail-title').textContent = name;
  const [collection, audience, tags] = await Promise.all([
    api(`/collections/${id}`),
    api(`/collections/${id}/audience`),
    api('/customers/tags'),
  ]);
  allTags = tags;
  document.getElementById('collections-list-view').classList.add('hidden');
  document.getElementById('collection-detail-view').classList.remove('hidden');
  renderWizard(collection, audience);
}

async function uploadImages() {
  const input = document.getElementById('images-input');
  if (!input?.files.length) return setStatus('status-images', 'Επίλεξε εικόνες.', 'error');

  const files = [...input.files];
  const total = files.length;
  const totalBytes = sumFileBytes(files);

  if (totalBytes > IMAGE_LARGE_UPLOAD_BYTES) {
    const estMinutes = Math.max(1, Math.ceil(totalBytes / IMAGE_UPLOAD_PROBE_BPS / 60));
    const proceed = confirm(
      `Θα ανεβούν ${total} εικόνες (${fmtBytes(totalBytes)}). Με τη σύνδεσή σου θα χρειαστούν περίπου ${estMinutes} λεπτά. Μην κλείσεις τη σελίδα.\n\nΗ πρώτη παρτίδα θα εκτιμήσει ακριβέστερα τον χρόνο που απομένει.`
    );
    if (!proceed) return;
  }

  const session = createImageUploadSession(files);
  const batchFailures = [];

  const refreshUi = () => {
    const { current, total: progressTotal, message } = session.progressState();
    setUploadLoading(true, message, {
      blockNavigation: true,
      progress: { current, total: progressTotal },
      failures: batchFailures,
    });
  };

  setStatus('status-images', '');
  setUploadLoading(true, `Ανέβασμα 0 από ${total} εικόνες...`, {
    blockNavigation: true,
    progress: { current: 0, total },
    failures: [],
  });

  try {
    while (session.queue.length) {
      const batch = session.buildNextBatch();
      if (!batch.length) break;

      await uploadBatchWithRetries(batch, session, refreshUi);

      if (!session.firstBatchDone) {
        session.firstBatchDone = true;
        if (totalBytes > IMAGE_LARGE_UPLOAD_BYTES && session.bytesPerSecond) {
          const refinedMinutes = Math.max(1, Math.ceil(session.remainingBytes() / session.bytesPerSecond / 60));
          batchFailures.push(`Εκτίμηση μετά την πρώτη παρτίδα: περίπου ${refinedMinutes} λεπτά ακόμα.`);
          refreshUi();
        }
      }
    }

    input.value = '';
    await openCollection(currentCollectionId, document.getElementById('detail-title').textContent);

    const uploaded = session.completedCount();
    const failedEntries = session.failedFiles;
    const failedCount = failedEntries.length;
    const summaryType = failedCount && !uploaded ? 'error' : failedCount ? 'error' : 'success';
    const summary = `Ανέβηκαν ${uploaded} από ${total} εικόνες.${failedCount ? ` ${failedCount} απέτυχαν.` : ''}`;

    if (failedCount) {
      const names = failedEntries.map((entry) => entry.file.name);
      const detail = names.slice(0, 8).join(', ');
      const extra = names.length > 8 ? ` (+${names.length - 8} ακόμα)` : '';
      setStatus(
        'status-images',
        `${summary} Επίλεξε ξανά μόνο: ${detail}${extra}`,
        'error'
      );
    } else {
      setStatus('status-images', summary, 'success');
    }

    showToast(summary, summaryType, 'Ανέβασμα ολοκληρώθηκε');
  } catch (err) {
    setStatus('status-images', err.message || 'Αποτυχία ανεβάσματος.', 'error');
    showToast(err.message || 'Αποτυχία ανεβάσματος.', 'error', 'Σφάλμα ανεβάσματος');
  } finally {
    setUploadLoading(false, 'Ανέβασμα εικόνων...', { blockNavigation: true });
  }
}

async function uploadMapping() {
  const input = document.getElementById('mapping-input');
  if (!input.files[0]) return setStatus('status-mapping', 'Επίλεξε Excel.', 'error');
  const fd = new FormData(); fd.append('mapping', input.files[0]);
  const r = await api(`/collections/${currentCollectionId}/mapping`, { method: 'POST', body: fd });
  setStatus('status-mapping', `Αντιστοιχίστηκαν ${r.matchedCount}, χωρίς αντιστοίχιση ${r.unmatchedCount}.`, 'success');
  input.value = '';
  document.getElementById('mapping-input-name').textContent = 'Δεν έχει επιλεγεί αρχείο';
}

async function uploadOrders() {
  const input = document.getElementById('orders-input');
  if (!input.files[0]) return setStatus('status-orders', 'Επίλεξε Excel.', 'error');
  const fd = new FormData(); fd.append('orders', input.files[0]);
  const r = await api(`/collections/${currentCollectionId}/orders`, { method: 'POST', body: fd });
  setStatus('status-orders', `Εισήχθησαν ${r.inserted}, χωρίς επίλυση ${r.unresolvedCount}.`, 'success');
  input.value = '';
  document.getElementById('orders-input-name').textContent = 'Δεν έχει επιλεγεί αρχείο';
}

async function publishCollection() {
  if (!confirm('Δημοσίευση συλλογής;')) return;
  const notify = document.getElementById('notify-checkbox').checked;
  const r = await api(`/collections/${currentCollectionId}/publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notify }),
  });
  showToast(`Η συλλογή δημοσιεύτηκε. Ειδοποιήθηκαν ${r.notified}, παραλείφθηκαν ${r.skipped}. Θα τη δουν ${r.reachCount} πελάτες.`, 'success', 'Δημοσίευση');
  openCollection(currentCollectionId, document.getElementById('detail-title').textContent);
}

async function unpublishCollection() {
  if (!confirm('Απόσυρση δημοσιευμένης συλλογής;')) return;
  await api(`/collections/${currentCollectionId}/unpublish`, { method: 'POST' });
  showToast('Η συλλογή αποσύρθηκε από τη δημοσίευση.', 'success', 'Απόσυρση');
  openCollection(currentCollectionId, document.getElementById('detail-title').textContent);
}

function getSelectedCustomerIds() {
  return [...document.querySelectorAll('.customer-select:checked')].map((el) => Number(el.value));
}

function updateBulkCustomersBar() {
  const ids = getSelectedCustomerIds();
  const host = document.getElementById('bulk-bar-host');
  const countEl = document.getElementById('bulk-customers-count');
  if (!host || !countEl) return;
  host.classList.toggle('visible', ids.length > 0);
  countEl.textContent = String(ids.length);
  const selectAll = document.getElementById('customers-select-all');
  const boxes = [...document.querySelectorAll('.customer-select')];
  if (selectAll && boxes.length) {
    selectAll.checked = ids.length > 0 && ids.length === boxes.length;
    selectAll.indeterminate = ids.length > 0 && ids.length < boxes.length;
  }
  document.querySelectorAll('#customers-body tr').forEach((row) => {
    const box = row.querySelector('.customer-select');
    row.classList.toggle('row-selected', box?.checked);
  });
}

async function runBulkCustomerAction(action, extra = {}) {
  const ids = getSelectedCustomerIds();
  if (!ids.length) return;
  const r = await api('/customers/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, action, ...extra }),
  });
  return r;
}

function getFilteredCustomers() {
  const q = (document.getElementById('customer-search')?.value || '').trim().toLowerCase();
  const tagFilter = document.getElementById('customer-tag-filter')?.value || '';
  const statusFilter = document.getElementById('customer-status-filter')?.value || '';
  return allCustomers.filter((c) => {
    if (statusFilter && c.status !== statusFilter) return false;
    if (tagFilter) {
      const tags = parseTagsString(c.tags);
      if (!tags.includes(tagFilter)) return false;
    }
    if (!q) return true;
    const hay = `${c.name} ${c.phone} ${c.email || ''} ${c.erp_code || ''} ${c.tags || ''}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderCustomersTable(customers) {
  const body = document.getElementById('customers-body');
  if (!customers.length) {
    body.innerHTML = '<tr><td colspan="9" class="subtitle">Δεν βρέθηκαν πελάτες.</td></tr>';
    return;
  }
  body.innerHTML = customers.map(c => `
    <tr class="${c.status === 'disabled' ? 'row-disabled' : ''}">
      <td class="col-check"><input type="checkbox" class="customer-select" value="${c.id}" aria-label="Επιλογή ${escapeHtml(c.name)}"></td>
      <td>${escapeHtml(c.name)}</td>
      <td class="mono">${escapeHtml(c.phone)}</td>
      <td><span class="email-cell"><span class="email-dot email-${escapeHtml(c.email_status || 'unknown')}"></span>${escapeHtml(c.email || '—')}</span></td>
      <td>${statusPill(c.status)}</td>
      <td>${accessModeSelectHtml(c.id, c.default_access_mode, { compact: true })}</td>
      <td>${c.last_auth_channel ? `<span class="pill pill-channel">${escapeHtml(c.last_auth_channel)}</span>` : '—'}</td>
      <td>${renderTagList(c.tags)}</td>
      <td>
        <button class="btn btn-secondary" data-action="resend" data-id="${c.id}">Επαναποστολή</button>
        <button class="btn btn-secondary" data-action="reset" data-id="${c.id}">Νέος κωδικός</button>
        <button class="btn btn-secondary" data-action="disable" data-id="${c.id}">Απενεργοποίηση</button>
        <button class="btn btn-secondary" data-action="delete" data-id="${c.id}">Διαγραφή</button>
      </td>
    </tr>`).join('');

  body.querySelectorAll('.customer-select').forEach((box) => {
    box.onchange = updateBulkCustomersBar;
  });
  body.querySelectorAll('.access-mode-select').forEach((select) => {
    select.addEventListener('change', async () => {
      const id = Number(select.dataset.customerId);
      const previous = allCustomers.find((c) => c.id === id)?.default_access_mode;
      select.disabled = true;
      try {
        await api(`/customers/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ default_access_mode: select.value }),
        });
        const customer = allCustomers.find((c) => c.id === id);
        if (customer) customer.default_access_mode = select.value;
      } catch (err) {
        if (previous) select.value = previous;
        alert(err.message || 'Αποτυχία ενημέρωσης πρόσβασης.');
      } finally {
        select.disabled = false;
      }
    });
  });
  updateBulkCustomersBar();

  body.querySelectorAll('[data-action]').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (btn.dataset.action === 'resend') await api(`/customers/${id}/resend-code`, { method: 'POST' });
      if (btn.dataset.action === 'reset') {
        const r = await api(`/customers/${id}/reset-code`, { method: 'POST' });
        alert(`Νέος κωδικός: ${r.accessCode}`);
      }
      if (btn.dataset.action === 'disable' && confirm('Απενεργοποίηση;')) {
        await api(`/customers/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'disabled' }) });
      }
      if (btn.dataset.action === 'delete' && confirm('Διαγραφή πελάτη;')) {
        await api(`/customers/${id}`, { method: 'DELETE' });
      }
      loadCustomers();
    };
  });
}

async function loadCustomers() {
  const [customers, tags] = await Promise.all([
    api('/customers'),
    api('/customers/tags').catch(() => []),
  ]);
  allCustomers = customers;
  activeCustomersCount = customers.filter(c => c.status === 'active').length;
  allTags = tags;

  const tagFilter = document.getElementById('customer-tag-filter');
  if (tagFilter) {
    const current = tagFilter.value;
    tagFilter.innerHTML = '<option value="">Όλες οι ετικέτες</option>' +
      tags.map(({ tag }) => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('');
    tagFilter.value = current;
  }

  if (!customerFiltersBound) {
    document.getElementById('customer-search')?.addEventListener('input', () => renderCustomersTable(getFilteredCustomers()));
    document.getElementById('customer-tag-filter')?.addEventListener('change', () => renderCustomersTable(getFilteredCustomers()));
    document.getElementById('customer-status-filter')?.addEventListener('change', () => renderCustomersTable(getFilteredCustomers()));
    customerFiltersBound = true;
  }

  renderCustomersTable(getFilteredCustomers());
}

async function loadMessages() {
  const messages = await api('/messages');
  document.getElementById('messages-body').innerHTML = messages.map(m => `
    <tr class="${m.status === 'failed' ? 'row-failed' : ''}">
      <td>${escapeHtml(m.created_at)}</td>
      <td>${escapeHtml(m.customer_name || '—')}</td>
      <td class="mono">${escapeHtml(m.destination)}${m.error ? `<span class="msg-error">Err: ${escapeHtml(m.error)}</span>` : ''}</td>
      <td><span class="pill pill-channel">${escapeHtml(m.channel)}</span></td>
      <td>${escapeHtml(messageKindLabel(m.kind))}</td>
      <td>${messageStatusPill(m.status)}</td>
    </tr>`).join('');
}

async function loadStorage() {
  const [storage, candidates] = await Promise.all([api('/storage'), api('/storage/candidates')]);
  const usedPct = storage.disk.usedPercent || 0;
  const progressClass = storageProgressClass(usedPct);
  document.getElementById('storage-summary').innerHTML = `
    <div class="storage-overview-top">
      <div>
        <p class="storage-label">Συνολικός χώρος</p>
        <div class="storage-used">${fmtBytes(storage.total.totalBytes)}</div>
        <span class="subtitle">σε χρήση</span>
      </div>
      <div class="storage-free">
        <div><strong>${fmtBytes(storage.disk.freeBytes)}</strong> ελεύθερα</div>
        <div class="subtitle">${usedPct.toFixed(1)}% δίσκου</div>
      </div>
    </div>
    <div class="storage-progress" role="progressbar" aria-valuenow="${usedPct.toFixed(1)}" aria-valuemin="0" aria-valuemax="100">
      <div class="storage-progress-fill ${progressClass}" style="width:${Math.min(usedPct, 100)}%"></div>
    </div>
    <div class="storage-chart-section">
      <p class="storage-label">Τάση 30 ημερών</p>
      ${renderStorageChart(storage.snapshots)}
    </div>`;

  const candidatesEl = document.getElementById('storage-candidates');
  if (candidates.candidates.length) {
    candidatesEl.classList.remove('hidden');
    candidatesEl.innerHTML = `
      <h3>Προς αρχειοθέτηση</h3>
      <p>${fmtBytes(candidates.totalReclaimable)} σε ${candidates.candidates.length} συλλογές μπορούν να αρχειοθετηθούν.</p>
      <ul>${candidates.candidates.slice(0, 5).map((c) =>
        `<li>${escapeHtml(c.name)} — ${fmtBytes(c.reclaimableBytes)}</li>`
      ).join('')}</ul>`;
  } else {
    candidatesEl.classList.add('hidden');
    candidatesEl.innerHTML = '';
  }

  document.getElementById('storage-body').innerHTML = storage.total.byCollection.map(c => `
    <tr>
      <td>${escapeHtml(c.name)}</td><td>${c.imageCount}</td>
      <td class="mono">${fmtBytes(c.fullBytes)}</td><td class="mono">${fmtBytes(c.webBytes)}</td><td class="mono">${fmtBytes(c.thumbBytes)}</td><td class="mono">${fmtBytes(c.totalBytes)}</td>
      <td>${c.status === 'published' ? `<button class="btn btn-secondary purge-btn" data-id="${c.id}">Αρχειοθέτηση</button>` : ''}</td>
    </tr>`).join('');
  document.querySelectorAll('.purge-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Αρχειοθέτηση full-res;')) return;
      const dry = await api(`/collections/${btn.dataset.id}/purge-full`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dryRun: true }),
      });
      if (!confirm(`Θα διαγραφούν ${dry.filesDeleted} αρχεία (${fmtBytes(dry.bytesReclaimed)}). Συνέχεια;`)) return;
      await api(`/collections/${btn.dataset.id}/purge-full`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      loadStorage();
    };
  });
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.onclick = () => {
    showView(btn.dataset.view);
    if (btn.dataset.view === 'collections') loadCollections();
    if (btn.dataset.view === 'customers') loadCustomers();
    if (btn.dataset.view === 'messages') loadMessages();
    if (btn.dataset.view === 'storage') loadStorage();
  };
});

document.getElementById('new-collection-btn').onclick = () => document.getElementById('new-collection-form').classList.remove('hidden');
document.getElementById('cancel-collection-btn').onclick = () => document.getElementById('new-collection-form').classList.add('hidden');
document.getElementById('new-collection-form').onsubmit = async (e) => {
  e.preventDefault();
  await api('/collections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: document.getElementById('collection-name-input').value }) });
  document.getElementById('new-collection-form').classList.add('hidden');
  document.getElementById('collection-name-input').value = '';
  loadCollections();
};
document.getElementById('back-collection-btn').onclick = () => {
  if (imageUploadInProgress) {
    const leave = confirm('Το ανέβασμα εικόνων είναι σε εξέλιξη. Θέλεις σίγουρα να φύγεις;');
    if (!leave) return;
  }
  currentCollectionId = null;
  document.getElementById('collection-detail-view').classList.add('hidden');
  document.getElementById('collections-list-view').classList.remove('hidden');
  loadCollections();
};
document.getElementById('new-customer-btn').onclick = () => document.getElementById('new-customer-form').classList.toggle('hidden');
document.getElementById('new-customer-form').onsubmit = async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const r = await api('/customers', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: fd.get('name'), phone: fd.get('phone'), email: fd.get('email'),
      erpCode: fd.get('erpCode'), defaultAccessMode: fd.get('defaultAccessMode'),
      preferredChannel: fd.get('preferredChannel'),
      sendCode: fd.get('sendCode') === 'on',
    }),
  });
  const panel = document.getElementById('customer-result');
  panel.classList.remove('hidden');
  panel.innerHTML = `<p>Δημιουργήθηκε: <strong>${escapeHtml(r.customer.name)}</strong></p>
    <p class="code-reveal mono">${escapeHtml(r.accessCode)}</p>
    <button class="btn btn-secondary" onclick="navigator.clipboard.writeText('${escapeHtml(r.accessCode)}')">Αντιγραφή</button>
    ${r.sendResult ? `<p>Αποστολή: ${r.sendResult.ok ? r.sendResult.channel : 'απέτυχε'}</p>` : ''}`;
  e.target.reset();
  loadCustomers();
};
document.getElementById('import-customers-input').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append('customers', file);
  fd.append('sendCodes', document.getElementById('import-send-codes').checked);
  const r = await api('/customers/upload', { method: 'POST', body: fd });
  if (r.errors?.length) {
    const el = document.getElementById('import-errors');
    el.classList.remove('hidden');
    el.innerHTML = '<h3>Σφάλματα εισαγωγής</h3><table><tr><th>Γραμμή</th><th>Λόγος</th></tr>' +
      r.errors.map(err => `<tr><td>${err.rowIndex || err.row}</td><td>${escapeHtml(err.reason)}</td></tr>`).join('') + '</table>';
  }
  alert(`Δημιουργήθηκαν ${r.created}, παραλείφθηκαν ${r.skipped}`);
  loadCustomers();
  e.target.value = '';
};

document.getElementById('customers-select-all')?.addEventListener('change', (e) => {
  const checked = e.target.checked;
  document.querySelectorAll('#customers-body .customer-select').forEach((box) => { box.checked = checked; });
  updateBulkCustomersBar();
});

document.getElementById('bulk-dismiss-btn')?.addEventListener('click', () => {
  document.querySelectorAll('.customer-select').forEach((box) => { box.checked = false; });
  document.getElementById('bulk-tags-panel')?.classList.add('hidden');
  updateBulkCustomersBar();
});

document.getElementById('bulk-resend-btn')?.addEventListener('click', async () => {
  const ids = getSelectedCustomerIds();
  if (!ids.length || !confirm(`Επαναποστολή κωδικού σε ${ids.length} πελάτες;`)) return;
  const r = await runBulkCustomerAction('resend-code');
  alert(`Ολοκληρώθηκε: ${r.sent} απεστάλησαν, ${r.skipped} παραλείφθηκαν, ${r.failed} απέτυχαν.`);
  loadCustomers();
});

document.getElementById('bulk-disable-btn')?.addEventListener('click', async () => {
  const ids = getSelectedCustomerIds();
  if (!ids.length || !confirm(`Απενεργοποίηση ${ids.length} πελατών;`)) return;
  const r = await runBulkCustomerAction('disable');
  alert(`Απενεργοποιήθηκαν ${r.processed} πελάτες.`);
  loadCustomers();
});

document.getElementById('bulk-delete-btn')?.addEventListener('click', async () => {
  const ids = getSelectedCustomerIds();
  if (!ids.length || !confirm(`Οριστική διαγραφή ${ids.length} πελατών;`)) return;
  const r = await runBulkCustomerAction('delete');
  alert(`Διαγράφηκαν ${r.processed} πελάτες.`);
  document.getElementById('bulk-tags-panel')?.classList.add('hidden');
  loadCustomers();
});

document.getElementById('bulk-tags-btn')?.addEventListener('click', () => {
  if (!getSelectedCustomerIds().length) return;
  document.getElementById('bulk-tags-panel')?.classList.remove('hidden');
  document.getElementById('bulk-tags-input')?.focus();
});

document.getElementById('bulk-tags-cancel-btn')?.addEventListener('click', () => {
  document.getElementById('bulk-tags-panel')?.classList.add('hidden');
});

document.getElementById('bulk-tags-apply-btn')?.addEventListener('click', async () => {
  const ids = getSelectedCustomerIds();
  if (!ids.length) return;
  const mode = document.getElementById('bulk-tags-mode')?.value || 'add';
  const tags = document.getElementById('bulk-tags-input')?.value?.trim() || '';
  if (!tags && mode !== 'remove') {
    alert('Δώσε tags (χωρισμένα με κόμμα).');
    return;
  }
  const r = await runBulkCustomerAction('tags', { mode, tags });
  alert(`Ενημερώθηκαν ${r.processed} πελάτες.`);
  document.getElementById('bulk-tags-panel')?.classList.add('hidden');
  document.getElementById('bulk-tags-input').value = '';
  loadCustomers();
});

applyBranding();
loadCollections();
loadCustomers();

document.getElementById('logout-btn')?.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST', credentials: 'include' });
  location.href = '/admin/login.html';
});

function openPasswordModal() {
  document.getElementById('change-password-error')?.classList.add('hidden');
  document.getElementById('change-password-form')?.reset();
  document.getElementById('password-modal')?.classList.remove('hidden');
}

function closePasswordModal() {
  document.getElementById('password-modal')?.classList.add('hidden');
}

document.getElementById('change-password-btn')?.addEventListener('click', openPasswordModal);
document.getElementById('password-modal-cancel')?.addEventListener('click', closePasswordModal);
document.getElementById('password-modal-backdrop')?.addEventListener('click', closePasswordModal);
document.getElementById('change-password-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = document.getElementById('change-password-error');
  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;
  if (newPassword !== confirmPassword) {
    err.textContent = 'Οι νέοι κωδικοί δεν ταιριάζουν.';
    err.classList.remove('hidden');
    return;
  }
  try {
    await api('/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    closePasswordModal();
    showToast('Ο κωδικός διαχειριστή ενημερώθηκε.', 'success', 'Κωδικός');
  } catch (error) {
    err.textContent = error.message || 'Αποτυχία αλλαγής κωδικού.';
    err.classList.remove('hidden');
  }
});

document.getElementById('toast-close')?.addEventListener('click', hideToast);
document.getElementById('toast-backdrop')?.addEventListener('click', hideToast);

document.getElementById('image-gallery-close')?.addEventListener('click', closeImageGalleryModal);
document.getElementById('image-gallery-backdrop')?.addEventListener('click', closeImageGalleryModal);
document.getElementById('image-gallery-select-all')?.addEventListener('click', () => {
  galleryModalImages.forEach((img) => gallerySelectedIds.add(img.id));
  updateGallerySelectionUi();
});
document.getElementById('image-gallery-clear')?.addEventListener('click', () => {
  gallerySelectedIds.clear();
  updateGallerySelectionUi();
});
document.getElementById('image-gallery-delete')?.addEventListener('click', deleteSelectedGalleryImages);
