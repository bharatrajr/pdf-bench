import { $, esc, today, safeName, plural, radio } from '../util.js';
import { toast } from '../feedback.js';
import { state, selectedItems } from '../state.js';
import { registerPanel, renderAll, refreshPanels } from '../ui.js';

function opts() {
  return {
    scope: radio('rnScope'), trimS: Math.max(0, +$('#rnTrimS').value || 0), trimE: Math.max(0, +$('#rnTrimE').value || 0),
    find: $('#rnFind').value, repl: $('#rnRepl').value, regex: $('#rnRegex').checked, cs: $('#rnCase').checked,
    spaces: $('#rnSpaces').value, kase: $('#rnKase').value, special: $('#rnSpecial').checked,
    tpl: $('#rnTpl').value || '{name}', start: +$('#rnStart').value || 0, step: +$('#rnStep').value || 1, pad: Math.max(1, +$('#rnPad').value || 1),
    prefix: $('#rnPrefix').value, suffix: $('#rnSuffix').value
  };
}

function computeName(it, i, o) {
  let s = it.name;
  if (o.trimS) s = s.slice(o.trimS);
  if (o.trimE) s = s.slice(0, Math.max(0, s.length - o.trimE));
  if (o.find) {
    try {
      const src = o.regex ? o.find : o.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      s = s.replace(new RegExp(src, o.cs ? 'g' : 'gi'), o.repl);
    } catch (e) { /* invalid pattern: skip */ }
  }
  if (o.special) s = s.replace(/[^\p{L}\p{N}\s._\-+()]/gu, '');
  if (o.spaces === '_' || o.spaces === '-') s = s.replace(/\s+/g, o.spaces);
  else if (o.spaces === 'none') s = s.replace(/\s+/g, '');
  if (o.kase === 'lower') s = s.toLowerCase();
  else if (o.kase === 'upper') s = s.toUpperCase();
  else if (o.kase === 'title') s = s.toLowerCase().replace(/(^|[\s_\-.])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  else if (o.kase === 'sentence') s = s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const counter = String(o.start + i * o.step).padStart(o.pad, '0');
  s = o.tpl.replace(/\{(\w+)\}/g, (m, k) => ({ name: s, i: counter, pages: it.pages, origin: it.origin, date: today() }[k] ?? m));
  return safeName(o.prefix + s + o.suffix);
}

const targets = o => o.scope === 'all' ? state.items : selectedItems();

function preview() {
  const o = opts(), list = targets(o), box = $('#rnPreview');
  if (!list.length) {
    $('#runRename').disabled = true;
    box.innerHTML = `<div class="preview warn">${o.scope === 'all' || !state.items.length ? 'The list is empty. Add some PDFs first.' : 'Tick one or more files in the list, or choose “All files”.'}</div>`;
    return;
  }
  const names = list.map((it, i) => computeName(it, i, o));
  const changed = names.filter((n, i) => n !== list[i].name).length;
  $('#runRename').disabled = !changed;
  const counts = new Map(); names.forEach(n => counts.set(n.toLowerCase(), (counts.get(n.toLowerCase()) || 0) + 1));
  const dups = [...counts.values()].filter(c => c > 1).length;
  let invalid = ''; if (o.regex && o.find) { try { new RegExp(o.find); } catch (e) { invalid = '<li>The regular expression is not valid, so Find/Replace is skipped.</li>'; } }
  box.innerHTML = `<div class="preview ${dups || invalid ? 'warn' : ''}"><b>${changed}</b> of ${plural(list.length, 'name')} will change.${changed ? '' : ' Change a rule above to see new names.'}` +
    ((dups || invalid) ? `<ul class="w">${dups ? `<li>${dups} name${dups > 1 ? 's are' : ' is'} used more than once. Duplicates get “(2)”, “(3)” added when you download.</li>` : ''}${invalid}</ul>` : '') + `</div>` +
    `<table class="rtable"><thead><tr><th>Now</th><th>New name</th></tr></thead><tbody>` +
    list.slice(0, 40).map((it, i) => `<tr><td>${esc(it.name)}</td><td class="new ${names[i] !== it.name ? 'chg' : ''}">${esc(names[i])}</td></tr>`).join('') +
    `</tbody></table>` + (list.length > 40 ? `<p class="muted" style="margin:-10px 0 16px">Showing the first 40 of ${list.length}.</p>` : '');
}

export function initRename() {
  registerPanel('rename', preview);
  // insert a fill-in token at the cursor in the name pattern
  document.querySelectorAll('.ins').forEach(b => b.onclick = () => {
    const f = $('#rnTpl'), s = f.selectionStart ?? f.value.length, e = f.selectionEnd ?? s;
    f.value = f.value.slice(0, s) + b.dataset.ins + f.value.slice(e);
    f.focus(); f.setSelectionRange(s + b.dataset.ins.length, s + b.dataset.ins.length);
    refreshPanels();
  });
  $('#runRename').onclick = () => {
    const o = opts(), list = targets(o);
    if (!list.length) return toast('No files to rename.', 'warn');
    state.undoNames = state.items.map(i => [i.id, i.name]);
    list.forEach((it, i) => it.name = computeName(it, i, o));
    $('#undoRename').disabled = false;
    renderAll();
    toast(`Renamed ${plural(list.length, 'file')}.`, 'ok', { label: 'Undo', run: () => $('#undoRename').click() });
  };
  $('#undoRename').onclick = () => {
    if (!state.undoNames) return;
    const m = new Map(state.undoNames);
    state.items.forEach(i => { if (m.has(i.id)) i.name = m.get(i.id); });
    state.undoNames = null; $('#undoRename').disabled = true; renderAll(); toast('Names restored.', 'ok');
  };
}
