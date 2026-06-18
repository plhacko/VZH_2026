'use strict';

// ===== State =====
let cards = [];
let editingCardId = null;
let pendingDeleteId = null;

// ===== Storage =====
function loadCards() {
  try {
    return JSON.parse(localStorage.getItem('vzh2026_cards') || '[]');
  } catch {
    return [];
  }
}

function saveCards() {
  localStorage.setItem('vzh2026_cards', JSON.stringify(cards));
}

// ===== Utils =====
function generateId() {
  return crypto.randomUUID();
}

function formatUkolyCount(n) {
  if (n === 1) return '1 úkol';
  if (n >= 2 && n <= 4) return `${n} úkoly`;
  return `${n} úkolů`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const CENA_LABELS = { '1': 'lehká', '2': 'střední', '3': 'těžká', 'X': 'nepřeskočitelná' };


// ===== Auto-grow textareas =====
function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

// ===== Rendering — List View =====
function renderCardTile(card) {
  const badgeUtocna = card.utocna
    ? `<span class="badge badge-utocna">útočná</span>` : '';
  const badgeObsazujici = card.obsazujici
    ? `<span class="badge badge-obsazujici">obsazující</span>` : '';
  const badgeObranna = card.obranna
    ? `<span class="badge badge-obranna">obranná</span>` : '';
  const hasBadges = card.utocna || card.obsazujici || card.obranna;

  return `
    <div class="card-tile">
      <div class="card-tile-top">
        <div class="card-tile-name">${escapeHtml(card.name)}</div>
        <div class="card-tile-actions">
          <button class="btn btn-ghost btn-icon" data-action="edit-card" data-card-id="${card.id}" title="Upravit kartu" aria-label="Upravit kartu ${escapeHtml(card.name)}">✏️</button>
          <button class="btn btn-ghost btn-icon" data-action="delete-card" data-card-id="${card.id}" title="Smazat kartu" aria-label="Smazat kartu ${escapeHtml(card.name)}">🗑️</button>
        </div>
      </div>
      <div class="card-tile-meta">
        ${badgeUtocna}
        ${badgeObsazujici}
        ${badgeObranna}
        ${!hasBadges ? '<span style="font-size:.82rem;color:var(--color-text-muted)">—</span>' : ''}
      </div>
      <ul class="ukol-list">
        ${card.ukoly.map(u => {
          const cena = u.cena || '1';
          return `<li class="ukol-list-item"><span class="ukol-cena ukol-cena--${cena}" title="${CENA_LABELS[cena] || ''}">${cena}</span>${escapeHtml(u.name)}</li>`;
        }).join('')}
      </ul>
    </div>`;
}

function renderListView() {
  const sorted = [...cards].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );

  const listContent = sorted.length === 0
    ? `<div class="empty-state">
        <div class="empty-state-icon">🃏</div>
        <p>Zatím žádné karty.<br>Přidejte první kartu.</p>
       </div>`
    : `<div class="cards-grid">${sorted.map(renderCardTile).join('')}</div>`;

  document.getElementById('app').innerHTML = `
    <header class="app-header">
      <div class="app-header-inner">
        <h1 class="app-title">VZH 2026 — Herní karty</h1>
        <div class="header-actions">
          ${cards.length > 0
            ? `<button class="btn btn-ghost btn-sm" data-action="export">Exportovat JSON</button>`
            : ''}
          <button class="btn btn-primary btn-sm" data-action="new-card">+ Nová karta</button>
        </div>
      </div>
    </header>
    <div class="section-header">
      <span class="section-title">${cards.length === 0 ? '' : `${cards.length} ${cards.length === 1 ? 'karta' : cards.length <= 4 ? 'karty' : 'karet'}`}</span>
    </div>
    ${listContent}`;
}

// ===== Rendering — Form View =====
function renderUkolRow(ukol, index, total) {
  const canRemove = total > 1;
  const cena = ukol.cena || '1';
  const cenaButtons = ['1', '2', '3', 'X'].map(v =>
    `<button type="button" class="cena-btn${cena === v ? ` cena-btn--active cena-btn--${v}` : ''}"
      data-action="set-cena" data-ukol-index="${index}" data-cena="${v}"
      title="${CENA_LABELS[v]}">${v}</button>`
  ).join('');
  return `
    <div class="ukol-row" data-ukol-index="${index}">
      <div class="ukol-row-top">
        <span class="ukol-row-num">${index + 1}.</span>
        <textarea
          class="form-input ukol-input"
          placeholder="Název úkolu"
          data-ukol-index="${index}"
          maxlength="200"
          aria-label="Úkol ${index + 1}"
          rows="1"
        >${escapeHtml(ukol.name)}</textarea>
        <button
          class="btn btn-ghost btn-icon btn-sm"
          data-action="remove-ukol"
          data-ukol-index="${index}"
          title="Odebrat úkol"
          aria-label="Odebrat úkol ${index + 1}"
          ${canRemove ? '' : 'disabled'}
        >×</button>
      </div>
      <div class="cena-group">
        <span class="cena-label">Cena přeskočení:</span>
        ${cenaButtons}
      </div>
    </div>`;
}

function renderFormView(card) {
  const isEdit = card !== null;
  const name = isEdit ? card.name : '';
  const utocna = isEdit ? card.utocna : false;
  const obsazujici = isEdit ? card.obsazujici : false;
  const obranna = isEdit ? card.obranna : false;
  const ukoly = isEdit ? card.ukoly : [{ id: generateId(), name: '', cena: '1' }];
  const canAddUkol = ukoly.length < 5;

  document.getElementById('app').innerHTML = `
    <header class="app-header">
      <div class="app-header-inner">
        <h1 class="app-title">VZH 2026 — Herní karty</h1>
      </div>
    </header>
    <div class="form-header">
      <button class="btn btn-ghost btn-sm" data-action="back-to-list">← Zpět</button>
      <h2 class="form-title">${isEdit ? 'Upravit kartu' : 'Nová karta'}</h2>
    </div>
    <form class="form-card" id="card-form" novalidate>
      <div class="form-group">
        <label class="form-label" for="field-name">Název karty</label>
        <textarea
          class="form-input"
          id="field-name"
          name="name"
          placeholder="Zadejte název karty"
          maxlength="200"
          autocomplete="off"
          rows="1"
        >${escapeHtml(name)}</textarea>
        <span class="form-error" id="error-name">Název karty nesmí být prázdný.</span>
      </div>

      <div>
        <div class="section-label">Vlastnosti karty</div>
        <div class="checkboxes-group">
          <label class="checkbox-label">
            <input type="checkbox" id="field-utocna" name="utocna" ${utocna ? 'checked' : ''} />
            útočná
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="field-obsazujici" name="obsazujici" ${obsazujici ? 'checked' : ''} />
            obsazující
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="field-obranna" name="obranna" ${obranna ? 'checked' : ''} />
            obranná
          </label>
        </div>
      </div>

      <div>
        <div class="ukoly-header">
          <div class="section-label" style="margin-bottom:0">Úkoly (${ukoly.length}/5)</div>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            data-action="add-ukol"
            ${canAddUkol ? '' : 'disabled'}
          >+ Přidat úkol</button>
        </div>
        <div class="ukoly-list" id="ukoly-list">
          ${ukoly.map((u, i) => renderUkolRow(u, i, ukoly.length)).join('')}
        </div>
        <span class="form-error" id="error-ukoly"></span>
      </div>

      <div class="form-footer">
        <button type="submit" class="btn btn-primary" data-action="save-card">Uložit kartu</button>
      </div>
    </form>`;

  document.querySelectorAll('textarea.form-input').forEach(autoGrow);

  // store current ukoly in a JS-accessible form for dynamic operations
  window._formUkoly = ukoly.map(u => ({ ...u }));
}

// ===== Form Dynamic Operations =====
function getFormUkoly() {
  return window._formUkoly || [];
}

function syncUkolyFromDOM() {
  document.querySelectorAll('.ukol-input').forEach((input, i) => {
    if (window._formUkoly[i]) {
      window._formUkoly[i].name = input.value;
    }
  });
}

function refreshUkolyList() {
  const ukoly = getFormUkoly();
  const list = document.getElementById('ukoly-list');
  if (!list) return;
  list.innerHTML = ukoly.map((u, i) => renderUkolRow(u, i, ukoly.length)).join('');

  const header = list.previousElementSibling;
  if (header) {
    header.querySelector('.section-label').textContent = `Úkoly (${ukoly.length}/5)`;
  }
  const addBtn = document.querySelector('[data-action="add-ukol"]');
  if (addBtn) addBtn.disabled = ukoly.length >= 5;
  document.querySelectorAll('#ukoly-list textarea.form-input').forEach(autoGrow);
}

function handleAddUkol() {
  syncUkolyFromDOM();
  const ukoly = getFormUkoly();
  if (ukoly.length >= 5) return;
  ukoly.push({ id: generateId(), name: '', cena: '1' });
  refreshUkolyList();
  // focus the new input
  const inputs = document.querySelectorAll('.ukol-input');
  if (inputs.length) inputs[inputs.length - 1].focus();
}

function handleRemoveUkol(index) {
  syncUkolyFromDOM();
  const ukoly = getFormUkoly();
  if (ukoly.length <= 1) return;
  ukoly.splice(index, 1);
  refreshUkolyList();
}

// ===== Validation =====
function validateCardForm(name, ukoly) {
  const errors = [];
  if (!name.trim()) errors.push({ field: 'name', message: 'Název karty nesmí být prázdný.' });
  const emptyUkol = ukoly.findIndex(u => !u.name.trim());
  if (emptyUkol !== -1) errors.push({ field: 'ukoly', message: `Úkol ${emptyUkol + 1} nesmí být prázdný.` });
  if (ukoly.length < 1 || ukoly.length > 5) errors.push({ field: 'ukoly', message: 'Počet úkolů musí být 1 až 5.' });
  return errors;
}

function showFormErrors(errors) {
  // clear previous
  document.querySelectorAll('.form-error').forEach(el => el.classList.remove('visible'));
  document.querySelectorAll('.form-input').forEach(el => el.classList.remove('error'));

  errors.forEach(err => {
    const errEl = document.getElementById(`error-${err.field}`);
    if (errEl) {
      errEl.textContent = err.message;
      errEl.classList.add('visible');
    }
    if (err.field === 'name') {
      const input = document.getElementById('field-name');
      if (input) input.classList.add('error');
    }
  });
}

// ===== Save Card =====
function handleFormSubmit(e) {
  e.preventDefault();
  syncUkolyFromDOM();

  const nameInput = document.getElementById('field-name');
  const utocnaInput = document.getElementById('field-utocna');
  const obsazujiciInput = document.getElementById('field-obsazujici');
  const obrannaInput = document.getElementById('field-obranna');

  const name = nameInput ? nameInput.value : '';
  const utocna = utocnaInput ? utocnaInput.checked : false;
  const obsazujici = obsazujiciInput ? obsazujiciInput.checked : false;
  const obranna = obrannaInput ? obrannaInput.checked : false;
  const ukoly = getFormUkoly();

  const errors = validateCardForm(name, ukoly);
  if (errors.length > 0) {
    showFormErrors(errors);
    return;
  }

  const now = new Date().toISOString();

  if (editingCardId) {
    const idx = cards.findIndex(c => c.id === editingCardId);
    if (idx !== -1) {
      cards[idx] = {
        ...cards[idx],
        name: name.trim(),
        utocna,
        obsazujici,
        obranna,
        ukoly: ukoly.map(u => ({ ...u, name: u.name.trim() })),
        updatedAt: now,
      };
    }
  } else {
    cards.push({
      id: generateId(),
      name: name.trim(),
      utocna,
      obsazujici,
      obranna,
      ukoly: ukoly.map(u => ({ id: u.id || generateId(), name: u.name.trim() })),
      createdAt: now,
      updatedAt: now,
    });
  }

  saveCards();
  editingCardId = null;
  renderListView();
}

// ===== Delete =====
function handleDeleteCard(id) {
  const card = cards.find(c => c.id === id);
  if (!card) return;
  pendingDeleteId = id;
  const msg = document.getElementById('dialog-message');
  if (msg) msg.textContent = `Opravdu smazat kartu „${card.name}"?`;
  const dialog = document.getElementById('confirm-dialog');
  if (dialog) dialog.showModal();
}

function handleConfirmDelete() {
  if (!pendingDeleteId) return;
  cards = cards.filter(c => c.id !== pendingDeleteId);
  pendingDeleteId = null;
  saveCards();
  const dialog = document.getElementById('confirm-dialog');
  if (dialog) dialog.close();
  renderListView();
}

function handleCancelDelete() {
  pendingDeleteId = null;
  const dialog = document.getElementById('confirm-dialog');
  if (dialog) dialog.close();
}

// ===== Export =====
function handleExport() {
  const json = JSON.stringify(cards, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vzh2026_karty.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ===== Event Delegation =====
document.addEventListener('input', function (e) {
  if (e.target.tagName === 'TEXTAREA' && e.target.classList.contains('form-input')) {
    autoGrow(e.target);
  }
});

document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && e.target.tagName === 'TEXTAREA' && e.target.classList.contains('form-input')) {
    e.preventDefault();
  }
});

document.addEventListener('click', function (e) {
  const target = e.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  const cardId = target.dataset.cardId;
  const ukolIndex = target.dataset.ukolIndex !== undefined
    ? parseInt(target.dataset.ukolIndex, 10) : null;

  switch (action) {
    case 'new-card':
      editingCardId = null;
      renderFormView(null);
      break;

    case 'edit-card':
      editingCardId = cardId;
      renderFormView(cards.find(c => c.id === cardId) || null);
      break;

    case 'delete-card':
      handleDeleteCard(cardId);
      break;

    case 'confirm-delete':
      handleConfirmDelete();
      break;

    case 'cancel-delete':
      handleCancelDelete();
      break;

    case 'add-ukol':
      handleAddUkol();
      break;

    case 'remove-ukol':
      if (ukolIndex !== null) handleRemoveUkol(ukolIndex);
      break;

    case 'set-cena':
      syncUkolyFromDOM();
      if (ukolIndex !== null && window._formUkoly[ukolIndex]) {
        window._formUkoly[ukolIndex].cena = target.dataset.cena;
      }
      refreshUkolyList();
      break;

    case 'back-to-list':
      editingCardId = null;
      renderListView();
      break;

    case 'export':
      handleExport();
      break;

  }
});

document.addEventListener('submit', function (e) {
  if (e.target.id === 'card-form') handleFormSubmit(e);
});

// close dialog on backdrop click
document.getElementById('confirm-dialog').addEventListener('click', function (e) {
  if (e.target === this) handleCancelDelete();
});

// ===== Init =====
function init() {
  cards = loadCards();
  renderListView();
}

document.addEventListener('DOMContentLoaded', init);
