export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
export const tick = () => new Promise(r => setTimeout(r, 0));
export const fmtSize = b => b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(0) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
export const today = () => new Date().toISOString().slice(0, 10);
export const plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`;
export const radio = name => $(`input[name="${name}"]:checked`)?.value;
export const safeName = s => {
  s = String(s).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  return s || 'untitled';
};
