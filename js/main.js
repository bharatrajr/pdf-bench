import { $, $$ } from './util.js';
import { state } from './state.js';
import { renderAll, refreshPanels } from './ui.js';
import { initPool, addFiles } from './pool.js';
import { initSplit } from './tools/split.js';
import { initMerge } from './tools/merge.js';
import { initCombo } from './tools/combo.js';
import { initRename } from './tools/rename.js';
import { initPwa } from './pwa.js';

const TABS = ['split', 'merge', 'combo', 'rename'];

function selectTab(name, focus = false) {
  state.tab = name;
  $$('.tab').forEach(t => { const on = t.dataset.tab === name; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
  TABS.forEach(n => $('#pane-' + n).hidden = n !== name);
  try { localStorage.setItem('pdfbench.tab', name); } catch (e) { /* storage blocked */ }
  refreshPanels();
}

function initTabs() {
  $$('.tab').forEach(b => b.onclick = () => selectTab(b.dataset.tab));
  $('.tabs').addEventListener('keydown', e => {
    const i = TABS.indexOf(state.tab), d = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (d) { e.preventDefault(); selectTab(TABS[(i + d + TABS.length) % TABS.length], true); }
  });
  const bench = $('.bench');
  bench.addEventListener('input', () => refreshPanels());
  bench.addEventListener('change', () => refreshPanels());
  // − / + buttons next to number fields
  bench.addEventListener('click', e => {
    const b = e.target.closest('[data-step]'); if (!b) return;
    const inp = b.parentElement.querySelector('input');
    const min = inp.min === '' ? -Infinity : +inp.min;
    inp.value = Math.max(min, (+inp.value || 0) + +b.dataset.step);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  let saved = null;
  try { saved = localStorage.getItem('pdfbench.tab'); } catch (e) { /* storage blocked */ }
  const fromUrl = new URLSearchParams(location.search).get('tool');
  selectTab(TABS.includes(fromUrl) ? fromUrl : TABS.includes(saved) ? saved : 'split');
}

function initHelp() {
  const dlg = $('#help');
  $('#helpBtn').onclick = () => dlg.showModal();
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  let seen = false;
  try { seen = localStorage.getItem('pdfbench.seenHelp'); localStorage.setItem('pdfbench.seenHelp', '1'); } catch (e) { seen = true; }
  if (!seen) dlg.showModal();
}

initPool();
initSplit();
initMerge();
initCombo();
initRename();
initTabs();
initHelp();
renderAll();
initPwa({ onFiles: addFiles });
