// ─── META (FACEBOOK/INSTAGRAM) PIXEL ─────────────────────────────────────────
// Chargé sur la landing ET l'app. Sert au retargeting + au suivi des conversions
// (inscriptions, abonnements) pour les Meta Ads.
//
// ⚠️  AARON : colle TON Pixel ID ci-dessous (un nombre d'environ 15-16 chiffres,
//     récupéré sur business.facebook.com → Gestionnaire d'événements → ton dataset).
//     Tant que ce n'est pas un vrai ID, le pixel reste INERTE (rien n'est envoyé).
//
// Helper exposé : window.ztTrack('CompleteRegistration' | 'Purchase' | 'Lead', params)
(function () {
  'use strict';

  var META_PIXEL_ID = 'REMPLACER_PAR_TON_PIXEL_ID';

  // Garde-fou : on n'active le pixel QUE si l'ID ressemble à un vrai Pixel ID.
  if (!/^\d{10,20}$/.test(META_PIXEL_ID)) {
    window.ztTrack = function () {};   // no-op tant que l'ID n'est pas configuré
    return;
  }

  // Snippet officiel Meta Pixel (base code).
  !function (f, b, e, v, n, t, s) {
    if (f.fbq) return; n = f.fbq = function () { n.callMethod ?
      n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
    n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
    s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  fbq('init', META_PIXEL_ID);
  fbq('track', 'PageView');

  // Helper global : déclenche un événement standard Meta (utilisé par le reste de l'app).
  window.ztTrack = function (event, params) {
    try { if (window.fbq) fbq('track', event, params || {}); } catch (e) {}
  };
})();
