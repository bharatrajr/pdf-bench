import { $ } from './util.js';
import { toast } from './feedback.js';

export function initPwa({ onFiles }) {
  // Install button: shown only when the browser offers installation.
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; $('#installBtn').hidden = false; });
  $('#installBtn').onclick = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null; $('#installBtn').hidden = true;
  };
  window.addEventListener('appinstalled', () => { $('#installBtn').hidden = true; toast('PDF Bench is installed. You can open PDFs with it from your file manager.', 'ok'); });

  // Opened from the OS with "Open with → PDF Bench" (File Handling API).
  if ('launchQueue' in window) {
    launchQueue.setConsumer(async params => {
      if (!params.files?.length) return;
      const files = await Promise.all(params.files.map(h => h.getFile()));
      onFiles(files);
    });
  }

  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offerUpdate = sw => toast('A new version of PDF Bench is ready.', '', {
      label: 'Update', sticky: true, run: () => sw.postMessage('skipWaiting')
    });
    if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      sw?.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(sw);
      });
    });
  }).catch(() => { /* offline support unavailable */ });

  // Reload only when an update replaces an existing worker, never on the first install.
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return; reloading = true;
    location.reload();
  });
}
