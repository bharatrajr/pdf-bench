import { $, esc, tick, today, safeName, plural, radio } from '../util.js';
import { toast, busy } from '../feedback.js';
import { state, selectedItems, addItem, getDoc, clearDocCache, PDFDocument } from '../state.js';
import { registerPanel, renderAll, showResults } from '../ui.js';

export function parseRanges(str, total) {
  const groups = [], warnings = [];
  const tokens = String(str || '').split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
  for (const tok of tokens) {
    const pages = []; let bad = false;
    for (const part0 of tok.split('+')) {
      const part = part0.trim().toLowerCase().replace(/\b(last|end)\b/g, String(total));
      let m;
      if (part === 'all') { for (let i = 0; i < total; i++) pages.push(i); continue; }
      if ((m = part.match(/^(\d+)$/))) {
        const p = +m[1]; if (p < 1 || p > total) { bad = true; break; } pages.push(p - 1);
      } else if ((m = part.match(/^(\d*)\s*-\s*(\d*)$/)) && (m[1] || m[2])) {
        let a = m[1] ? +m[1] : 1, b = m[2] ? +m[2] : total;
        if (Math.min(a, b) > total || Math.max(a, b) < 1) { bad = true; break; }
        a = Math.min(Math.max(a, 1), total); b = Math.min(Math.max(b, 1), total);
        if (a <= b) for (let p = a; p <= b; p++) pages.push(p - 1); else for (let p = a; p >= b; p--) pages.push(p - 1);
      } else { bad = true; break; }
    }
    if (bad || !pages.length) warnings.push(`“${tok}” is invalid or outside pages 1–${total}`);
    else groups.push({ pages, label: tok.replace(/\s+/g, '') });
  }
  return { groups, warnings };
}

function planSplit(item, o) {
  const n = item.pages, warnings = [];
  const seq = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const mk = (arr, label) => ({ pages: arr, label, start: arr[0] + 1, end: arr[arr.length - 1] + 1 });
  let groups = [];
  if (o.mode === 'each') for (let i = 0; i < n; i++) groups.push(mk([i], String(i + 1)));
  else if (o.mode === 'chunk') {
    const k = Math.max(1, o.n | 0);
    for (let i = 0; i < n; i += k) { const e = Math.min(n, i + k) - 1; groups.push(mk(seq(i, e), i === e ? `${i + 1}` : `${i + 1}-${e + 1}`)); }
  } else if (o.mode === 'parts') {
    const p = Math.max(1, Math.min(n, o.n | 0)), base = Math.floor(n / p), extra = n % p; let s = 0;
    for (let i = 0; i < p; i++) { const len = base + (i < extra ? 1 : 0), e = s + len - 1; groups.push(mk(seq(s, e), s === e ? `${s + 1}` : `${s + 1}-${e + 1}`)); s = e + 1; }
  } else if (o.mode === 'oddeven') {
    const odd = [], even = [];
    for (let i = 0; i < n; i++) (i % 2 === 0 ? odd : even).push(i);
    if (odd.length) groups.push(mk(odd, 'odd'));
    if (even.length) groups.push(mk(even, 'even'));
  } else if (o.mode === 'ranges') {
    const r = parseRanges(o.ranges, n); groups = r.groups.map(g => mk(g.pages, g.label)); warnings.push(...r.warnings);
  } else if (o.mode === 'remove') {
    const r = parseRanges(o.ranges, n); warnings.push(...r.warnings);
    const rm = new Set(r.groups.flatMap(g => g.pages));
    const keep = [...Array(n).keys()].filter(i => !rm.has(i));
    if (keep.length) groups.push(mk(keep, 'kept')); else warnings.push('Every page would be removed');
  }
  return { groups, warnings };
}

const splitOpts = () => ({ mode: radio('splitMode'), n: +$('#splitN').value || 1, ranges: $('#splitRanges').value });
function splitName(tpl, item, g, n, total, pad) {
  const num = pad ? String(n).padStart(String(total).length, '0') : String(n);
  const map = { name: item.name, n: num, total, range: g.label, start: g.start, end: g.end, pages: g.pages.length, date: today() };
  return safeName(tpl.replace(/\{(\w+)\}/g, (m, k) => (k in map ? map[k] : m)));
}

const SPLIT_TPL = { each: '{name}_p{n}', chunk: '{name}_part{n}', parts: '{name}_part{n}', ranges: '{name}_{range}', oddeven: '{name}_{range}', remove: '{name}_trimmed' };
const RUN_LABEL = { each: 'Split into single pages', chunk: 'Split into chunks', parts: 'Split into parts', ranges: 'Split by ranges', oddeven: 'Split odd / even', remove: 'Delete pages' };
let tplTouched = false;

function syncFields() {
  const m = radio('splitMode');
  $('#fN').hidden = !(m === 'chunk' || m === 'parts');
  $('#lblN').textContent = m === 'parts' ? 'Number of parts' : 'Pages per file';
  $('#fRanges').hidden = !(m === 'ranges' || m === 'remove');
  $('#lblRanges').textContent = m === 'remove' ? 'Pages to delete' : 'Page ranges';
  $('#splitRanges').placeholder = m === 'remove' ? '1, 4-5, last' : '1-3, 4-6, 7-';
  if (!tplTouched) $('#splitTpl').value = SPLIT_TPL[m];
}

function preview() {
  const sel = selectedItems(), box = $('#splitPreview'), btn = $('#runSplit');
  const mode = radio('splitMode');
  box.className = 'preview';
  btn.textContent = RUN_LABEL[mode];
  if (!sel.length) {
    btn.disabled = true;
    box.textContent = state.items.length ? 'Tick one or more files in the list to split them.' : 'Add some PDFs first. Drop them anywhere on this page.';
    return;
  }
  const o = splitOpts(), tpl = $('#splitTpl').value || '{name}', pad = $('#splitPad').checked;
  let files = 0; const warn = new Set(), samples = [];
  for (const it of sel) {
    const { groups, warnings } = planSplit(it, o);
    warnings.forEach(w => warn.add(`${it.name}: ${w}`));
    files += groups.length;
    if (samples.length < 4) groups.slice(0, 2).forEach((g, i) => samples.push(splitName(tpl, it, g, i + 1, groups.length, pad) + '.pdf'));
  }
  if ((mode === 'ranges' || mode === 'remove') && !$('#splitRanges').value.trim()) {
    btn.disabled = true; box.classList.add('warn');
    box.textContent = mode === 'remove' ? 'Type the pages to delete, e.g. 1, 4-5, last' : 'Type the page ranges, e.g. 1-3, 4-6, 7-';
    return;
  }
  btn.disabled = !files;
  box.innerHTML = `${plural(sel.length, 'file')} → <b>${plural(files, 'new file')}</b>` +
    (samples.length ? `<ul><li>${samples.slice(0, 4).map(esc).join('</li><li>')}</li>${files > samples.length ? '<li>…</li>' : ''}</ul>` : '') +
    (warn.size ? `<ul class="w">${[...warn].slice(0, 5).map(w => `<li>${esc(w)}</li>`).join('')}</ul>` : '');
  if (warn.size || !files) box.classList.add('warn');
}

async function run() {
  const sel = selectedItems();
  if (!sel.length) return toast('Tick at least one file first.', 'warn');
  const o = splitOpts(), tpl = $('#splitTpl').value || '{name}', pad = $('#splitPad').checked;
  const selectNew = $('#splitSelect').checked, removeSrc = $('#splitRemove').checked;
  let total = 0;
  for (const it of sel) total += planSplit(it, o).groups.length;
  if (!total) return toast('Nothing to create with these settings.', 'warn');
  if (total > 400 && !confirm(`This will create ${total} files. Continue?`)) return;
  busy(true, 'Splitting…', 0);
  let done = 0; const created = [];
  try {
    for (const it of sel) {
      const { groups } = planSplit(it, o);
      if (!groups.length) continue;
      const src = await getDoc(it), fresh = [];
      for (const [gi, g] of groups.entries()) {
        const out = await PDFDocument.create();
        (await out.copyPages(src, g.pages)).forEach(p => out.addPage(p));
        const bytes = await out.save();
        fresh.push({ name: splitName(tpl, it, g, gi + 1, groups.length, pad), bytes, pages: g.pages.length });
        busy(true, `Splitting… ${++done} of ${total}`, done / total * 100); await tick();
      }
      let at = state.items.indexOf(it) + 1;
      for (const f of fresh) created.push(addItem(f.name, f.bytes, f.pages, 'split', { at: at++, select: selectNew }));
      if (selectNew) it.sel = false;
    }
    if (removeSrc) state.items = state.items.filter(i => !sel.includes(i));
    showResults(created, mode2verb(o.mode));
  } catch (e) { console.error(e); toast('Splitting stopped: ' + e.message, 'warn'); }
  clearDocCache(); busy(false); renderAll();
}
const mode2verb = m => m === 'remove' ? 'Pages deleted' : 'Split done';

export function initSplit() {
  $('#splitTpl').addEventListener('input', () => tplTouched = true);
  $('#splitCards').addEventListener('change', syncFields);
  $('#runSplit').onclick = run;
  registerPanel('split', preview);
  syncFields();
}
