import { $, $$, esc, tick, today, safeName, plural, radio } from '../util.js';
import { toast, busy } from '../feedback.js';
import { state, selectedItems, addItem, getDoc, clearDocCache, PDFDocument } from '../state.js';
import { registerPanel, renderAll, showResults } from '../ui.js';

export async function buildMerged(list, { interleave = false, reverseEven = false } = {}) {
  const out = await PDFDocument.create();
  const docs = []; for (const it of list) docs.push(await getDoc(it));
  if (!interleave) {
    for (const d of docs) (await out.copyPages(d, d.getPageIndices())).forEach(p => out.addPage(p));
  } else {
    const arrs = [];
    for (const [i, d] of docs.entries()) { const idx = d.getPageIndices(); if (reverseEven && i % 2 === 1) idx.reverse(); arrs.push(await out.copyPages(d, idx)); }
    const max = Math.max(...arrs.map(a => a.length));
    for (let r = 0; r < max; r++) for (const a of arrs) if (a[r]) out.addPage(a[r]);
  }
  return { bytes: await out.save(), pages: out.getPageCount() };
}

function syncFields() {
  const m = radio('mergeMode');
  $('#fGroup').hidden = m !== 'group';
  $('#fDuplex').hidden = m !== 'interleave';
  if (m === 'group') {
    $('#lblMergeName').textContent = 'Name pattern for the merged files';
    $('#hintMergeName').textContent = 'Fill-ins: {n} counter, {first} name of the first file in each group, {date}';
    if ($('#mergeName').value === 'merged') $('#mergeName').value = 'merged_{n}';
  } else {
    $('#lblMergeName').textContent = 'Name of the merged file';
    $('#hintMergeName').textContent = '';
    if ($('#mergeName').value === 'merged_{n}') $('#mergeName').value = 'merged';
  }
}

function mergeList() { const s = selectedItems(); return radio('mergeMode') === 'reverse' ? s.slice().reverse() : s; }

function preview() {
  const list = mergeList(), box = $('#mergePreview'), m = radio('mergeMode'), sel = selectedItems();
  const reversed = m === 'reverse';
  $('#mergeOrder').innerHTML = list.length ? list.map((it, i) => {
    const si = sel.indexOf(it);
    return `<li data-id="${it.id}"><b>${i + 1}</b><span class="n" title="${esc(it.name)}">${esc(it.name)}</span><span class="pg">${plural(it.pages, 'page')}</span>
      <span class="mv">${reversed ? '' : `<button data-mv="-1" ${si === 0 ? 'disabled' : ''} aria-label="Move up">▲</button><button data-mv="1" ${si === sel.length - 1 ? 'disabled' : ''} aria-label="Move down">▼</button>`}</span></li>`;
  }).join('') : `<li class="none">${state.items.length ? 'Tick the files to merge in the list.' : 'Add some PDFs first.'}</li>`;
  box.className = 'preview';
  $('#runMerge').disabled = list.length < 2;
  if (list.length < 2) { box.classList.add('warn'); box.textContent = 'Tick at least two files to merge.'; return; }
  const pages = list.reduce((a, i) => a + i.pages, 0);
  if (m === 'group') {
    const n = Math.max(2, +$('#mergeN').value || 2);
    box.innerHTML = `${plural(list.length, 'file')} in groups of ${n} → <b>${plural(Math.ceil(list.length / n), 'merged PDF')}</b>`;
  } else box.innerHTML = `${plural(list.length, 'file')} (${plural(pages, 'page')}) → <b>1 merged PDF</b>`;
}

// Move a ticked item past its neighbouring ticked item in the main list.
function move(id, dir) {
  const sel = selectedItems(), i = sel.findIndex(x => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= sel.length) return;
  const a = state.items.indexOf(sel[i]), b = state.items.indexOf(sel[j]);
  [state.items[a], state.items[b]] = [state.items[b], state.items[a]];
  renderAll();
  $(`#mergeOrder li[data-id="${id}"] button[data-mv="${dir}"]:not(:disabled)`)?.focus();
}

async function run() {
  const list = mergeList(), mode = radio('mergeMode');
  if (list.length < 2) return toast('Tick at least two files to merge.', 'warn');
  const nameIn = $('#mergeName').value || 'merged';
  const jobs = [];
  if (mode === 'group') {
    const n = Math.max(2, +$('#mergeN').value || 2);
    for (let i = 0; i < list.length; i += n) jobs.push(list.slice(i, i + n));
  } else jobs.push(list);
  busy(true, 'Merging…', 0);
  const made = [];
  try {
    for (const [ji, grp] of jobs.entries()) {
      const r = await buildMerged(grp, { interleave: mode === 'interleave', reverseEven: $('#mergeDuplex').checked });
      const num = String(ji + 1).padStart(String(jobs.length).length, '0');
      const name = safeName(nameIn.replace(/\{(\w+)\}/g, (m, k) => ({ n: num, first: grp[0].name, date: today() }[k] ?? m)));
      made.push({ name, ...r });
      busy(true, `Merging… ${ji + 1} of ${jobs.length}`, (ji + 1) / jobs.length * 100); await tick();
    }
    const selectNew = $('#mergeSelect').checked;
    if (selectNew) list.forEach(i => i.sel = false);
    const created = made.map(m => addItem(m.name, m.bytes, m.pages, 'merge', { select: selectNew }));
    if ($('#mergeRemove').checked) state.items = state.items.filter(i => !list.includes(i));
    showResults(created, 'Merge done');
  } catch (e) { console.error(e); toast('Merging stopped: ' + e.message, 'warn'); }
  clearDocCache(); busy(false); renderAll();
}

export function initMerge() {
  $$('input[name="mergeMode"]').forEach(r => r.addEventListener('change', syncFields));
  $('#mergeOrder').addEventListener('click', e => {
    const b = e.target.closest('[data-mv]'); if (!b) return;
    move(+b.closest('li').dataset.id, +b.dataset.mv);
  });
  $('#runMerge').onclick = run;
  registerPanel('merge', preview);
  syncFields();
}
