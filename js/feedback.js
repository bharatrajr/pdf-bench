import { $ } from './util.js';

export function toast(msg, kind = '', action = null) {
  const d = document.createElement('div');
  d.className = 'toast ' + kind;
  const t = document.createElement('span'); t.textContent = msg; d.appendChild(t);
  if (action) {
    const b = document.createElement('button'); b.textContent = action.label;
    b.onclick = () => { action.run(); d.remove(); };
    d.appendChild(b);
  }
  $('#toasts').appendChild(d);
  if (!action?.sticky) {
    setTimeout(() => d.classList.add('out'), 3800);
    setTimeout(() => d.remove(), 4300);
  }
}

export function busy(on, msg, pct) {
  $('#busy').hidden = !on;
  if (!on) return;
  $('#busyMsg').textContent = msg || 'Working…';
  $('#busyBarWrap').style.visibility = pct == null ? 'hidden' : 'visible';
  $('#busyBar').style.width = (pct || 0) + '%';
}
