// ─── META (FACEBOOK/INSTAGRAM) PIXEL — chargé sous CONSENTEMENT (RGPD) ───────
// Le pixel ne se charge PAS au chargement de la page : il attend le consentement
// explicite de l'utilisateur (bandeau cookies → « Accepter »). Un visiteur ayant
// déjà accepté (localStorage `zt_consent` = 'granted') le recharge automatiquement.
//
// API exposée :
//   window.ztConsent(true|false)  → enregistre le choix et charge le pixel si accepté
//   window.ztTrack('Lead' | 'CompleteRegistration' | 'Purchase', params)  → no-op tant
//                                   que le pixel n'est pas chargé (= pas de consentement)
(function () {
  'use strict';

  var META_PIXEL_ID = '27618404664430031';

  // Garde-fou : pixel inerte si l'ID n'est pas configuré.
  if (!/^\d{10,20}$/.test(META_PIXEL_ID)) { window.ztTrack = function () {}; return; }

  var loaded = false;

  function load() {
    if (loaded) return; loaded = true;
    // Snippet officiel Meta Pixel (base code).
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ?
        n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0';
      n.queue = []; t = b.createElement(e); t.async = !0; t.src = v;
      s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    try { fbq('init', META_PIXEL_ID); fbq('track', 'PageView'); } catch (e) {}
  }

  // Événements : ignorés tant qu'il n'y a pas de consentement (pixel non chargé).
  window.ztTrack = function (event, params) {
    try { if (loaded && window.fbq) fbq('track', event, params || {}); } catch (e) {}
  };

  // Appelé par le bandeau cookies. true = accepte (charge le pixel) ; false = refuse.
  window.ztConsent = function (granted) {
    try { localStorage.setItem('zt_consent', granted ? 'granted' : 'denied'); } catch (e) {}
    if (granted) load();
  };

  // Visiteur ayant déjà donné son consentement → on (re)charge le pixel directement.
  try { if (localStorage.getItem('zt_consent') === 'granted') load(); } catch (e) {}
})();
