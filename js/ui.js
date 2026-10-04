import { $, esc, fmtSize, plural } from './util.js';
import { state, selectedItems } from './state.js';
import { downloadZip, downloadEach } from './export.js';

// Each tool registers a preview function; only the visible tool's preview runs.
const panels = {};
export const registerPanel = (name, fn) => panels[name] = fn;

export function visibleItems() {
  const q = state.filter.trim().toLowerCase();
  return q ? state.items.filter(i => i.name.toLowerCase().includes(q)) : state.items;
}

export function renderPool() {
  const list = $('#poolList');
  state.items.forEach((it, i) => it._i = i);
  const vis = visibleItems(), has = state.items.length > 0;
  $('#selbar').hidden = !has;
  $('#poolFoot').hidden = !has;
  $('#filter').hidden = state.items.length < 7 && !state.filter;
  if (!has) {
    list.innerHTML = `<div class="empty" data-add>
      <div class="big-ico" aria-hidden="true">📄</div>
      <b>Drop PDFs here</b>or click to choose files. Nothing is uploaded.
      <div><span class="btn primary">Choose PDFs</span></div></div>`;
  } else if (!vis.length) {
    list.innerHTML = `<div class="empty small">No file names match “${esc(state.filter)}”.</div>`;
  } else {
    list.innerHTML = vis.map(it => `
      <div class="row ${it.sel ? 'sel' : ''} ${state.fresh.has(it.id) ? 'fresh' : ''}" data-id="${it.id}">
        <span class="grip" draggable="true" title="Drag to reorder">⋮⋮</span>
        <input type="checkbox" ${it.sel ? 'checked' : ''} aria-label="Tick ${esc(it.name)}">
        <button class="thumb" data-act="open" title="Open to view" aria-label="Open ${esc(it.name)}">${it.thumb ? `<img src="${it.thumb}" alt="">` : 'PDF'}</button>
        <div class="info">
          <input class="nm" value="${esc(it.name)}" spellcheck="false" aria-label="File name" title="Click to rename">
          <div class="meta"><span>#${it._i + 1}</span><span>${plural(it.pages, 'page')}</span><span>${fmtSize(it.bytes.length)}</span>${it.origin !== 'upload' ? `<span class="tag ${it.origin}">${it.origin}</span>` : ''}</div>
        </div>
        <div class="acts"><button data-act="dl" title="Download this file" aria-label="Download">⬇</button><button data-act="rm" title="Remove from list" aria-label="Remove">✕</button></div>
      </div>`).join('');
  }
  state.fresh.clear();
  updateStats();
}

export function updateStats() {
  const sel = selectedItems(), n = state.items.length;
  const pg = sel.reduce((a, i) => a + i.pages, 0);
  $('#stats').textContent = n ? `${sel.length} of ${n} ticked · ${plural(pg, 'page')}` : 'No files yet';
  const zs = $('#zipSel');
  zs.disabled = !sel.length;
  zs.textContent = sel.length > 1 ? `⬇ Download ${sel.length} as ZIP` : sel.length === 1 ? '⬇ Download ticked file' : '⬇ Tick files to download';
  $('#dlEach').disabled = !sel.length;
  updateSteps();
}

function updateSteps() {
  const n = state.items.length, s = selectedItems().length, ran = !$('#results').hidden;
  const cur = !n ? 1 : !s ? 2 : ran ? 4 : 3;
  [1, 2, 3, 4].forEach(k => {
    const li = $('#step' + k);
    li.classList.toggle('on', k === cur);
    li.classList.toggle('done', k < cur);
  });
}

export function refreshPanels() {
  updateStats();
  panels[state.tab]?.();
}

export function renderAll() { renderPool(); refreshPanels(); }

// Shown after a tool creates files: one click downloads exactly those files.
export function showResults(items, what) {
  const box = $('#results');
  if (!items.length) { box.hidden = true; return; }
  items.forEach(i => state.fresh.add(i.id));
  box.innerHTML = `<div class="ico" aria-hidden="true">✓</div>
    <div class="txt"><b>${esc(what)}: ${plural(items.length, 'new file')}</b><small>They’re in the list${items.every(i => i.sel) ? ' and ticked' : ''}. Download now, or keep working with them.</small></div>
    <button class="btn primary" data-r="zip">⬇ ${items.length > 1 ? 'Download as ZIP' : 'Download'}</button>
    ${items.length > 1 ? '<button class="btn" data-r="each">Each file</button>' : ''}
    <button class="x" data-r="close" aria-label="Dismiss">✕</button>`;
  box.onclick = e => {
    const r = e.target.closest('[data-r]')?.dataset.r;
    const alive = items.filter(i => state.items.includes(i));
    if (r === 'zip') downloadZip(alive);
    if (r === 'each') downloadEach(alive);
    if (r === 'close') { box.hidden = true; updateSteps(); }
  };
  box.hidden = false;
}
