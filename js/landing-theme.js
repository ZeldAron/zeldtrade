// ─── LANDING THEME (v1.0.0) ─────────────────────────────────────────────────
// Thème clair/sombre de la landing. GATÉ STAGING : sur zeldtrade-staging, défaut
// sombre + bouton de bascule (☾/☀) à côté du sélecteur de langue. En prod, ce
// script ne fait RIEN → la landing reste blanche, le bouton reste masqué.
// Partage la clé localStorage `zeld_theme` avec l'app (cohérence landing ↔ app).
// Chargé en <head> (synchrone) pour appliquer le thème avant le 1er paint (anti-FOUC).
(function () {
  'use strict';
  var KEY = 'zeld_theme';
  function isStaging() {
    try { return (location.hostname || '').indexOf('zeldtrade-staging') !== -1; }
    catch (e) { return false; }
  }
  if (!isStaging()) return;   // prod : pas de thème sombre / pas de bouton (pour l'instant)

  function stored() {
    try { var v = localStorage.getItem(KEY); return (v === 'dark' || v === 'light' || v === 'auto') ? v : 'dark'; }
    catch (e) { return 'dark'; }
  }
  function resolve(v) {
    if (v === 'auto') {
      try { return (window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark'; }
      catch (e) { return 'dark'; }
    }
    return v;
  }
  function apply(r) {
    var h = document.documentElement;
    if (r === 'dark') h.setAttribute('data-theme', 'dark');
    else h.removeAttribute('data-theme');
  }

  apply(resolve(stored()));   // anti-FOUC (ce script tourne dans le <head>)

  function refreshBtn() {
    var b = document.getElementById('themeToggle');
    if (!b) return;
    var dark = resolve(stored()) === 'dark';
    b.style.display = '';
    b.textContent = dark ? '☀' : '☾';
    b.setAttribute('aria-pressed', dark ? 'true' : 'false');
    b.title = dark ? 'Passer en clair' : 'Passer en sombre';
  }
  function set(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
    apply(resolve(v));
    refreshBtn();
  }
  function init() {
    refreshBtn();
    var b = document.getElementById('themeToggle');
    if (b) b.addEventListener('click', function () {
      set(resolve(stored()) === 'dark' ? 'light' : 'dark');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
