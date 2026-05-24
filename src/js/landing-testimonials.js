// ─── LANDING — Carrousel témoignages (glissant) ─────────────────────────────
// v0.9.333 : 1 témoignage visible, la piste DÉFILE automatiquement en translation
// vers le suivant (boucle infinie fluide via un clone de la 1ʳᵉ carte). Points de
// navigation, pause au survol. Externalisé (CSP). Sans JS → 1ʳᵉ carte visible.

(function () {
  'use strict';

  const viewport = document.querySelector('.testi-viewport');
  const track    = document.querySelector('.testi-track');
  const dotsWrap = document.querySelector('.testi-dots');
  if (!viewport || !track) return;

  const cards = Array.prototype.slice.call(track.querySelectorAll('figure'));
  const N = cards.length;
  if (N < 2) return;   // 1 seul témoignage → rien à faire défiler

  const INTERVAL = 5000;   // temps d'affichage par carte
  const DUR      = 600;    // durée du glissement (ms)

  // Clone de la 1ʳᵉ carte en fin de piste → le passage dernière → première glisse
  // vers l'avant sans à-coup, puis on revient à l'index 0 sans animation.
  const clone = cards[0].cloneNode(true);
  clone.setAttribute('aria-hidden', 'true');
  track.appendChild(clone);

  let idx = 0, timer = null, animating = false;

  const dots = cards.map(function (_, i) {
    const d = document.createElement('button');
    d.type = 'button';
    d.className = 'testi-dot' + (i === 0 ? ' is-active' : '');
    d.setAttribute('aria-label', 'Témoignage ' + (i + 1));
    d.addEventListener('click', function () { idx = i; paint(true); restart(); });
    if (dotsWrap) dotsWrap.appendChild(d);
    return d;
  });

  function paint(animate) {
    track.style.transition = animate ? ('transform ' + DUR + 'ms ease') : 'none';
    track.style.transform  = 'translateX(' + (-idx * 100) + '%)';
    dots.forEach(function (d, j) { d.classList.toggle('is-active', j === (idx % N)); });
  }

  function next() {
    if (animating) return;
    animating = true;
    idx++;
    paint(true);
    if (idx === N) {
      // on glisse jusqu'au clone (= visuel carte 0), puis reset instantané à 0
      setTimeout(function () { idx = 0; paint(false); animating = false; }, DUR + 40);
    } else {
      setTimeout(function () { animating = false; }, DUR + 40);
    }
  }

  function restart() { if (timer) clearInterval(timer); timer = setInterval(next, INTERVAL); }
  function stop()    { if (timer) { clearInterval(timer); timer = null; } }

  paint(false);
  restart();

  viewport.addEventListener('mouseenter', stop);
  viewport.addEventListener('mouseleave', restart);
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else restart(); });
})();
