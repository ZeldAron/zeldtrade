// ─── THEME MANAGER (v0.9.239) ─────────────────────────────────────────────────
// Dark / Light / Auto (suit prefers-color-scheme).
// Persistance localStorage `zeld_theme` = 'dark' | 'light' | 'auto' (default).
// Application via attribut `data-theme` sur <html> (lu par CSS [data-theme="light"]).
//
// API publique :
//   Theme.get()         → 'dark' | 'light' | 'auto'
//   Theme.getResolved() → 'dark' | 'light' (résout 'auto' selon OS)
//   Theme.set('dark' | 'light' | 'auto') → applique + sauvegarde
//   Theme.onChange(fn)  → callback à chaque changement effectif
//
// IMPORTANT : ce script est chargé en premier dans app.html pour éviter le FOUC
// (flash of unstyled / unthemed content) — il applique le thème avant que le
// reste du DOM ne soit parsé/rendu.

const Theme = (() => {
  const KEY = 'zeld_theme';
  const VALID = new Set(['dark', 'light', 'auto']);
  const callbacks = [];

  // v1.0.0 : sur l'environnement de TEST (zeldtrade-staging), le thème par défaut
  // est le NOIR complet (pour évaluer le rendu sombre). La prod reste en blanc.
  // Un choix explicite de l'user (localStorage) prime toujours sur ce défaut.
  function _isStaging() {
    try { return (location.hostname || '').indexOf('zeldtrade-staging') !== -1; }
    catch { return false; }
  }
  function _defaultTheme() { return _isStaging() ? 'dark' : 'light'; }

  function _readStored() {
    try {
      const v = localStorage.getItem(KEY);
      return VALID.has(v) ? v : _defaultTheme();
    } catch { return _defaultTheme(); }
  }

  function _resolveAuto() {
    try {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    } catch {}
    return 'dark';
  }

  function get() { return _readStored(); }

  function getResolved() {
    const pref = _readStored();
    return pref === 'auto' ? _resolveAuto() : pref;
  }

  function _apply(resolved) {
    const html = document.documentElement;
    if (resolved === 'light') html.setAttribute('data-theme', 'light');
    else                      html.removeAttribute('data-theme'); // dark = default
  }

  function set(value) {
    if (!VALID.has(value)) value = 'auto';
    try { localStorage.setItem(KEY, value); } catch {}
    const resolved = value === 'auto' ? _resolveAuto() : value;
    _apply(resolved);
    callbacks.forEach(cb => { try { cb(resolved, value); } catch {} });
  }

  function onChange(cb) {
    if (typeof cb === 'function') callbacks.push(cb);
  }

  // ── Init au plus tôt (anti-FOUC) ──────────────────────────────────────────
  _apply(getResolved());

  // Si l'user est en mode 'auto', écouter les changements OS (dark mode système).
  try {
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => { if (get() === 'auto') _apply(getResolved()); };
    // addEventListener moderne, fallback addListener pour vieux Safari
    if (mql.addEventListener) mql.addEventListener('change', handler);
    else if (mql.addListener) mql.addListener(handler);
  } catch {}

  return { get, getResolved, set, onChange };
})();
