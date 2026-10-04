import { $, esc, tick, safeName, plural } from '../util.js';
import { toast, busy } from '../feedback.js';
import { selectedItems, addItem, clearDocCache } from '../state.js';
import { registerPanel, renderAll, showResults } from '../ui.js';
import { buildMerged } from './merge.js';

const CAP = 3000;
function nCk(n, k) { if (k < 0 || k > n) return 0; k = Math.min(k, n - k); let r = 1; for (let i = 1; i <= k; i++) r = r * (n - k + i) / i; return Math.round(r); }
function nPk(n, k) { if (k > n) return 0; let r = 1; for (let i = 0; i < k; i++) r *= (n - i); return r; }
function comboCount(m, lo, hi, ordered) { let t = 0; for (let k = lo; k <= hi; k++) t += ordered ? nPk(m, k) : nCk(m, k); return t; }
function* combinations(arr, k, start = 0, cur = []) {
  if (cur.length === k) { yield cur.slice(); return; }
  for (let i = start; i < arr.length; i++) { cur.push(arr[i]); yield* combinations(arr, k, i + 1, cur); cur.pop(); }
}
function* permutations(arr, k, cur = [], used = new Set()) {
  if (cur.length === k) { yield cur.slice(); return; }
  for (let i = 0; i < arr.length; i++) { if (used.has(i)) continue; used.add(i); cur.push(arr[i]); yield* permutations(arr, k, cur, used); cur.pop(); used.delete(i); }
}

function comboRange() {
  const m = selectedItems().length;
  let lo = Math.max(1, +$('#comboMin').value || 1), hi = Math.max(lo, +$('#comboMax').value || lo);
  hi = Math.min(hi, m); lo = Math.min(lo, hi);
  return { m, lo, hi, ordered: $('#comboOrdered').checked };
}

function preview() {
  const sel = selectedItems(), box = $('#comboPreview'), btn = $('#runCombo');
  $('#comboKey').innerHTML = sel.length ? sel.map((it, i) => `<span class="chip"><b>${i + 1}</b>${esc(it.name)}</span>`).join('') : '<span class="muted">No files ticked.</span>';
  box.className = 'preview';
  const { m, lo, hi, ordered } = comboRange();
  if (m < 2) { btn.disabled = true; box.classList.add('warn'); box.textContent = 'Tick at least two files to combine.'; return; }
  const c = comboCount(m, lo, hi, ordered);
  const sizes = lo === hi ? `${lo} at a time` : `${lo} to ${hi} at a time`;
  box.innerHTML = `${plural(m, 'file')}, ${sizes}${ordered ? ', order matters' : ''} → <b>${c.toLocaleString()} merged PDF${c === 1 ? '' : 's'}</b>`;
  btn.disabled = c > CAP || !c;
  if (c > CAP) { box.classList.add('bad'); box.innerHTML += `<ul class="w"><li>That’s over the limit of ${CAP.toLocaleString()}. Lower “at most” or turn off “order matters”.</li></ul>`; }
  else if (c > 150) { box.classList.add('warn'); box.innerHTML += `<ul class="w"><li>That’s a lot of files. It may take a while and use plenty of memory.</li></ul>`; }
}

async function run() {
  const sel = selectedItems(), { m, lo, hi, ordered } = comboRange();
  if (m < 2) return toast('Tick at least two files to combine.', 'warn');
  const count = comboCount(m, lo, hi, ordered);
  if (count > CAP) return toast(`That would make ${count.toLocaleString()} files. The limit is ${CAP.toLocaleString()}.`, 'warn');
  if (count > 150 && !confirm(`This will create ${count.toLocaleString()} PDFs. Continue?`)) return;
  const naming = $('#comboNaming').value;
  const idOf = new Map(sel.map((it, i) => [it.id, i + 1]));
  busy(true, 'Generating combinations…', 0);
  const results = []; let n = 0;
  try {
    for (let k = lo; k <= hi; k++) {
      for (const combo of (ordered ? permutations(sel, k) : combinations(sel, k))) {
        n++;
        const r = await buildMerged(combo);
        let name;
        if (naming === 'ids') name = 'combo_' + combo.map(c => idOf.get(c.id)).join('-');
        else if (naming === 'seq') name = 'combo_' + String(n).padStart(String(count).length, '0');
        else { name = combo.map(c => c.name).join(' + '); if (name.length > 120) name = name.slice(0, 117) + '…'; }
        results.push({ name: safeName(name), ...r });
        busy(true, `Generating… ${n} of ${count}`, n / count * 100); await tick();
      }
    }
    const selectNew = $('#comboSelect').checked;
    if (selectNew) sel.forEach(i => i.sel = false);
    showResults(results.map(r => addItem(r.name, r.bytes, r.pages, 'combo', { select: selectNew })), 'Combinations done');
  } catch (e) { console.error(e); toast('Stopped: ' + e.message, 'warn'); }
  clearDocCache(); busy(false); renderAll();
}

export function initCombo() {
  $('#runCombo').onclick = run;
  registerPanel('combo', preview);
}
