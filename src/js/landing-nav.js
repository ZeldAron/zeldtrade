// ─── LANDING MOBILE NAV TOGGLE ─────────────────────────────────────────────
// v0.9.210 : hamburger menu pour la nav mobile.
// Externalisé pour respecter la CSP (script-src 'self').

(function () {
  'use strict';

  const toggle = document.getElementById('navToggle');
  const links  = document.getElementById('navLinks');
  if (!toggle || !links) return;

  function setOpen(open) {
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    links.classList.toggle('is-open', open);
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    setOpen(!isOpen);
  });

  // Close menu when clicking on a link (intra-page anchor)
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => setOpen(false));
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!links.contains(e.target) && !toggle.contains(e.target)) {
      if (toggle.getAttribute('aria-expanded') === 'true') setOpen(false);
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });

  // Reset state when resizing back to desktop
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth > 640) setOpen(false);
    }, 100);
  });
})();

// ─── NAV AUTO-HIDE / REVEAL (v0.9.361) ──────────────────────────────────────
// Au scroll vers le bas, la barre de nav se rétracte (plus d'espace de lecture).
// Elle réapparaît : au scroll vers le haut, OU quand la souris touche le haut de
// l'écran, OU quand on est près du haut de page, OU au focus clavier (a11y).
(function () {
  'use strict';
  const nav = document.querySelector('.nav');
  if (!nav) return;

  const navToggle = document.getElementById('navToggle');
  const HIDE_AFTER = 240;   // ne jamais cacher tant qu'on est dans les 240 1ers px
  const TOP_ZONE   = 90;    // souris à ≤90px du haut → réaffiche
  const HIDE_DELTA = 6;     // il faut descendre franchement (>6px) pour cacher (anti-jitter)
  let lastY  = window.scrollY || 0;
  let ticking = false;

  function show() { nav.classList.remove('nav--hidden'); }
  function hide() { nav.classList.add('nav--hidden'); }

  function onScroll() {
    const y = Math.max(0, window.scrollY || 0);
    const menuOpen = navToggle && navToggle.getAttribute('aria-expanded') === 'true';
    if (y <= HIDE_AFTER || menuOpen || y < lastY) {
      show();                              // haut de page, menu ouvert, OU on remonte (dès 1px) → visible
    } else if (y > lastY + HIDE_DELTA) {
      hide();                              // on descend franchement → caché
    }
    lastY = y;
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });

  // Souris collée en haut de l'écran → on rappelle la nav
  window.addEventListener('mousemove', function (e) {
    if (e.clientY <= TOP_ZONE) show();
  }, { passive: true });

  // Accessibilité : tabuler vers un lien de la nav la réaffiche
  nav.addEventListener('focusin', show);
})();

// ─── CONFIRMATION SUPPRESSION DE COMPTE (v0.9.263) ──────────────────────────
// Après suppression du compte côté app, redirection vers /?deleted=1 → bannière
// de confirmation (sinon l'user était silencieusement renvoyé à l'accueil).
(function () {
  'use strict';
  let params;
  try { params = new URLSearchParams(window.location.search); } catch (e) { return; }
  if (params.get('deleted') !== '1') return;
  // Nettoie l'URL pour ne pas re-afficher au refresh
  try {
    params.delete('deleted');
    const qs = params.toString();
    history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
  } catch (e) {}
  const fr = (navigator.language || '').toLowerCase().indexOf('fr') === 0;
  const banner = document.createElement('div');
  banner.setAttribute('role', 'status');
  banner.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:99999;max-width:92%;background:#16161c;color:#fff;border:1px solid rgba(124, 58, 237,0.55);border-radius:12px;padding:14px 18px;font-size:14px;line-height:1.4;box-shadow:0 10px 34px rgba(0,0,0,0.45);display:flex;align-items:center;gap:12px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
  const msg = document.createElement('span');
  msg.textContent = '✓ ' + (fr
    ? 'Ton compte et toutes tes données ont été supprimés. À bientôt '
    : 'Your account and all your data have been deleted. See you soon ');
  banner.appendChild(msg);
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '✕';
  close.setAttribute('aria-label', fr ? 'Fermer' : 'Close');
  close.style.cssText = 'background:none;border:none;color:#9aa;cursor:pointer;font-size:16px;line-height:1;padding:0 0 0 4px';
  close.addEventListener('click', function () { banner.remove(); });
  banner.appendChild(close);
  function show() { document.body.appendChild(banner); setTimeout(function () { banner.remove(); }, 9000); }
  if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
})();
