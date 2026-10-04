import { $, tick, safeName, plural } from './util.js';
import { toast, busy } from './feedback.js';

export function finalNames(list) {
  const seen = new Map();
  return list.map(it => {
    const base = safeName(it.name), key = base.toLowerCase(), c = (seen.get(key) || 0) + 1;
    seen.set(key, c);
    return (c > 1 ? `${base} (${c})` : base) + '.pdf';
  });
}

export function dlBlob(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 5000);
}

export function openPdf(it) {
  const url = URL.createObjectURL(new Blob([it.bytes], { type: 'application/pdf' }));
  if (!window.open(url, '_blank')) dlBlob(finalNames([it])[0], new Blob([it.bytes], { type: 'application/pdf' }));
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function downloadZip(list) {
  if (!list.length) return toast('Nothing to download. Tick some files first.', 'warn');
  if (list.length === 1) return downloadEach(list);
  const zip = new JSZip(), names = finalNames(list);
  list.forEach((it, i) => zip.file(names[i], it.bytes, { binary: true }));
  busy(true, 'Building ZIP…', 0);
  try {
    const blob = await zip.generateAsync({ type: 'blob', compression: 'STORE' }, m => busy(true, 'Building ZIP…', m.percent));
    dlBlob(safeName($('#zipName').value || 'pdf-bench-output') + '.zip', blob);
    toast(`Downloaded a ZIP with ${plural(list.length, 'PDF')}.`, 'ok');
  } catch (e) { toast('ZIP failed: ' + e.message, 'warn'); }
  busy(false);
}

export async function downloadEach(list) {
  if (!list.length) return toast('Nothing to download. Tick some files first.', 'warn');
  if (list.length > 10 && !confirm(`${list.length} separate downloads will start and your browser may ask permission. A ZIP is easier for big batches. Continue?`)) return;
  const names = finalNames(list);
  for (const [i, it] of list.entries()) {
    dlBlob(names[i], new Blob([it.bytes], { type: 'application/pdf' }));
    if (list.length > 1) await new Promise(r => setTimeout(r, 350));
  }
  toast(`Started ${plural(list.length, 'download')}.`, 'ok');
}

export async function saveToFolder(list) {
  if (!list.length) return toast('Nothing to save. Tick some files first.', 'warn');
  if (!window.showDirectoryPicker) return toast('This browser can’t save into a chosen folder. Use the ZIP download instead (Chrome and Edge support folders).', 'warn');
  let dir;
  try { dir = await showDirectoryPicker({ mode: 'readwrite', startIn: 'downloads' }); } catch (e) { return; }
  busy(true, 'Saving files…', 0);
  try {
    const names = finalNames(list);
    for (const [i, it] of list.entries()) {
      const fh = await dir.getFileHandle(names[i], { create: true });
      const w = await fh.createWritable(); await w.write(it.bytes); await w.close();
      busy(true, `Saving files… ${i + 1} of ${list.length}`, (i + 1) / list.length * 100); await tick();
    }
    toast(`Saved ${plural(list.length, 'file')} to “${dir.name}”.`, 'ok');
  } catch (e) { toast('Saving failed: ' + e.message, 'warn'); }
  busy(false);
}
