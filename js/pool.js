import { $, $$, collator, tick, safeName, plural } from './util.js';
import { toast, busy } from './feedback.js';
import { state, addItem, selectedItems, PDFDocument } from './state.js';
import { renderPool, renderAll, refreshPanels, visibleItems } from './ui.js';
import { dlBlob, finalNames, openPdf, downloadZip, downloadEach, saveToFolder } from './export.js';

export async function addFiles(fileList) {
  const files = [...fileList].filter(f => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
  if (!files.length) { toast('No PDF files found in that selection.', 'warn'); return; }
  files.sort((a, b) => collator.compare(a.webkitRelativePath || a.name, b.webkitRelativePath || b.name));
  busy(true, 'Reading PDFs…', 0);
  let ok = 0;
  for (const [i, f] of files.entries()) {
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
      const it = addItem(f.name.replace(/\.pdf$/i, ''), bytes, doc.getPageCount(), 'upload', { select: true });
      state.fresh.add(it.id);
      ok++;
    } catch (e) { toast(`“${f.name}” could not be read. It may be damaged.`, 'warn'); }
    busy(true, `Reading PDFs… ${i + 1} of ${files.length}`, (i + 1) / files.length * 100);
    await tick();
  }
  busy(false); renderAll();
  if (ok) toast(`Added ${plural(ok, 'PDF')}. Now pick a tool on the right.`, 'ok');
}

const findItem = row => state.items.find(i => i.id === +row.dataset.id);

function setSel(it, on, shift) {
  const vis = visibleItems();
  if (shift && state.anchor != null) {
    const a = vis.findIndex(i => i.id === state.anchor), b = vis.findIndex(i => i.id === it.id);
    if (a > -1 && b > -1) { const [lo, hi] = [Math.min(a, b), Math.max(a, b)]; for (let k = lo; k <= hi; k++) vis[k].sel = on; }
  } else it.sel = on;
  state.anchor = it.id; renderPool(); refreshPanels();
}

export function initPool() {
  const poolList = $('#poolList');

  poolList.addEventListener('click', e => {
    if (e.target.closest('[data-add]')) return $('#fileInput').click();
    const row = e.target.closest('.row'); if (!row) return;
    const it = findItem(row); if (!it) return;
    if (e.target.matches('input[type=checkbox]')) return setSel(it, e.target.checked, e.shiftKey);
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'rm') { state.items = state.items.filter(i => i !== it); renderAll(); return; }
    if (act === 'dl') return dlBlob(finalNames([it])[0], new Blob([it.bytes], { type: 'application/pdf' }));
    if (act === 'open') return openPdf(it);
    // clicking anywhere else on the row toggles its tick
    if (!e.target.closest('.nm, .grip')) setSel(it, !it.sel, e.shiftKey);
  });
  poolList.addEventListener('change', e => {
    if (!e.target.classList.contains('nm')) return;
    const it = findItem(e.target.closest('.row'));
    it.name = safeName(e.target.value); e.target.value = it.name; refreshPanels();
  });
  poolList.addEventListener('keydown', e => { if (e.target.classList.contains('nm') && e.key === 'Enter') e.target.blur(); });

  // drag the grip to reorder
  let dragId = null;
  const clearMarks = () => $$('.over-top,.over-bottom', poolList).forEach(r => r.classList.remove('over-top', 'over-bottom'));
  poolList.addEventListener('dragstart', e => {
    const g = e.target.closest('.grip'); if (!g) return;
    const row = g.closest('.row'); dragId = +row.dataset.id;
    e.dataTransfer.setData('text/x-row', String(dragId)); e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setDragImage(row, 20, 20);
  });
  poolList.addEventListener('dragover', e => {
    if (dragId == null) return;
    const row = e.target.closest('.row'); if (!row) return;
    e.preventDefault(); clearMarks();
    const rc = row.getBoundingClientRect();
    row.classList.add(e.clientY < rc.top + rc.height / 2 ? 'over-top' : 'over-bottom');
  });
  poolList.addEventListener('drop', e => {
    if (dragId == null) return;
    const row = e.target.closest('.row'); if (!row) return;
    e.preventDefault();
    const rc = row.getBoundingClientRect(), before = e.clientY < rc.top + rc.height / 2;
    const mv = state.items.find(i => i.id === dragId), tgt = findItem(row);
    if (mv && tgt && mv !== tgt) {
      state.items.splice(state.items.indexOf(mv), 1);
      state.items.splice(state.items.indexOf(tgt) + (before ? 0 : 1), 0, mv);
    }
    dragId = null; renderAll();
  });
  poolList.addEventListener('dragend', () => { dragId = null; clearMarks(); });

  $('#addBtn').onclick = () => $('#fileInput').click();
  $('#addDirBtn').onclick = () => $('#dirInput').click();
  $('#fileInput').onchange = e => { addFiles(e.target.files); e.target.value = ''; };
  $('#dirInput').onchange = e => { addFiles(e.target.files); e.target.value = ''; };
  const bulk = fn => () => { visibleItems().forEach(fn); renderPool(); refreshPanels(); };
  $('#selAll').onclick = bulk(i => i.sel = true);
  $('#selNone').onclick = bulk(i => i.sel = false);
  $('#selInv').onclick = bulk(i => i.sel = !i.sel);
  $('#filter').oninput = e => { state.filter = e.target.value; renderPool(); };
  $('#sortBy').onchange = e => {
    const v = e.target.value; e.target.value = ''; if (!v) return;
    const by = { name: (a, b) => collator.compare(a.name, b.name), pages: (a, b) => a.pages - b.pages, size: (a, b) => a.bytes.length - b.bytes.length };
    if (v === 'reverse') state.items.reverse();
    else { const [k, d] = v.split('-'); state.items.sort(by[k]); if (d) state.items.reverse(); }
    renderAll();
  };

  $('#zipSel').onclick = () => downloadZip(selectedItems());
  $('#zipAll').onclick = () => downloadZip(state.items);
  $('#dlEach').onclick = () => downloadEach(selectedItems());
  $('#saveFolder').onclick = () => saveToFolder(selectedItems());
  $('#rmSel').onclick = () => {
    const n = selectedItems().length; if (!n) return toast('Nothing is ticked.', 'warn');
    if (!confirm(`Remove ${plural(n, 'ticked file')} from the list?`)) return;
    state.items = state.items.filter(i => !i.sel); renderAll();
  };
  $('#clearAll').onclick = () => {
    if (!state.items.length) return;
    if (!confirm('Remove every file from the list? Nothing on your disk is deleted.')) return;
    state.items = []; $('#results').hidden = true; renderAll();
  };

  // drop files from the desktop anywhere on the page
  let depth = 0;
  const isFileDrag = e => [...(e.dataTransfer?.types || [])].includes('Files');
  window.addEventListener('dragenter', e => { if (isFileDrag(e)) { depth++; $('#dropveil').hidden = false; } });
  window.addEventListener('dragleave', e => { if (isFileDrag(e) && --depth <= 0) { depth = 0; $('#dropveil').hidden = true; } });
  window.addEventListener('dragover', e => { if (isFileDrag(e)) e.preventDefault(); });
  window.addEventListener('drop', e => { if (!isFileDrag(e)) return; e.preventDefault(); depth = 0; $('#dropveil').hidden = true; addFiles(e.dataTransfer.files); });
  window.addEventListener('beforeunload', e => { if (state.items.length) { e.preventDefault(); e.returnValue = ''; } });
}
