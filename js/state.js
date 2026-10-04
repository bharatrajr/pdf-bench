import { queueThumb } from './thumbs.js';

export const { PDFDocument } = window.PDFLib;

export const state = { items: [], seq: 0, anchor: null, filter: '', undoNames: null, tab: 'split', fresh: new Set() };
const docCache = new Map();

export const selectedItems = () => state.items.filter(i => i.sel);

export function addItem(name, bytes, pages, origin, { at = null, select = false } = {}) {
  const it = { id: ++state.seq, name, bytes, pages, origin, sel: select, thumb: null };
  if (at == null) state.items.push(it); else state.items.splice(at, 0, it);
  queueThumb(it);
  return it;
}

export async function getDoc(it) {
  if (!docCache.has(it.id)) docCache.set(it.id, await PDFDocument.load(it.bytes, { ignoreEncryption: true, updateMetadata: false }));
  return docCache.get(it.id);
}
export const clearDocCache = () => docCache.clear();
