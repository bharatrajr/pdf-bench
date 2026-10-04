import { $ } from './util.js';

// pdf.js renders first-page thumbnails. Optional: if it fails, rows just show "PDF".
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
let pdfjsReady = null, chain = Promise.resolve();

function initPdfJs() {
  if (!pdfjsReady) pdfjsReady = (async () => {
    if (!window.pdfjsLib) return false;
    // Cross-origin workers are blocked, so load it as a same-origin blob.
    const r = await fetch(PDFJS_WORKER); const b = await r.blob();
    pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(b);
    return true;
  })().catch(() => false);
  return pdfjsReady;
}

export function queueThumb(it) { chain = chain.then(() => makeThumb(it)).catch(() => {}); }

async function makeThumb(it) {
  if (!(await initPdfJs())) return;
  let doc;
  try {
    doc = await pdfjsLib.getDocument({ data: it.bytes.slice() }).promise;
    const pg = await doc.getPage(1);
    const v0 = pg.getViewport({ scale: 1 });
    const vp = pg.getViewport({ scale: 132 / v0.width });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    it.thumb = c.toDataURL('image/jpeg', .7);
    const el = $(`.row[data-id="${it.id}"] .thumb`);
    if (el) el.innerHTML = `<img src="${it.thumb}" alt="">`;
  } catch (e) { /* encrypted or unsupported: no thumbnail */ }
  finally { if (doc) doc.destroy(); }
}
