// ─── LANDING — Carrousel témoignages ────────────────────────────────────────
// v0.9.332 : affiche UN témoignage à la fois, auto-rotation, points de navigation,
// pause au survol. Externalisé (CSP script-src 'self'). Dégradation gracieuse :
// sans JS, la 1ʳᵉ carte (class="is-active" dans le HTML) reste affichée.

(function () {
  'use strict';

  const wrap = document.querySelector('.testi-carousel');
  const dotsWrap = document.querySelector('.testi-dots');
  if (!wrap) return;
  const cards = Array.prototype.slice.call(wrap.querySelectorAll('figure'));
  if (cards.length < 2) return;   // 1 seul témoignage → rien à faire défiler

  const INTERVAL = 6000;
  let idx = Math.max(0, cards.findIndex(function (c) { return c.classList.contains('is-active'); }));
  if (idx < 0) idx = 0;
  let timer = null;

  const dots = cards.map(function (_, i) {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'testi-dot' + (i === idx ? ' is-active' : '');
    d.setAttribute('aria-label', 'Témoignage ' + (i + 1));
    d.addEventListener('click', function () { go(i); restart(); });
    if (dotsWrap) dotsWrap.appendChild(d);
    return d;
  });

  function go(i) {
    idx = (i + cards.length) % cards.length;
    cards.forEach(function (c, j) { c.classList.toggle('is-active', j === idx); });
    dots.forEach(function (d, j) { d.classList.toggle('is-active', j === idx); });
  }
  function next()    { go(idx + 1); }
  function restart() { if (timer) clearInterval(timer); timer = setInterval(next, INTERVAL); }
  function stop()    { if (timer) { clearInterval(timer); timer = null; } }

  go(idx);
  restart();

  // Pause au survol (desktop) ; reprise à la sortie.
  wrap.addEventListener('mouseenter', stop);
  wrap.addEventListener('mouseleave', restart);
  // Pause quand l'onglet n'est pas visible (évite de "sauter" plusieurs cartes).
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop(); else restart();
  });
})();
