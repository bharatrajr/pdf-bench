# PDF Bench

Split, merge, combine and bulk-rename PDFs in your browser. Installable PWA, works offline, and files never leave your device.

**Live:** https://bharatrajr.github.io/pdf-bench/

## Structure

```
index.html              page markup
manifest.webmanifest    PWA manifest (install, file handling, shortcuts)
sw.js                   service worker (offline cache)
css/styles.css
js/main.js              entry: wires tabs, help, PWA
js/pool.js              file list: add, tick, reorder, drag & drop
js/ui.js                rendering, step guide, results banner
js/export.js            ZIP / per-file / folder downloads
js/tools/*.js           split, merge, combine, rename
icons/
```

## Run locally

```
python -m http.server 8765
```

## Releasing

Bump `VERSION` in `sw.js` whenever any file changes, so installed copies pick up the update.
