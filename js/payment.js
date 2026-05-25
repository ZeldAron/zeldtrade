// ─── PAYMENT PAGE — i18n bilingue ─────────────────────────────────────────────
(function () {
  const lang = localStorage.getItem('jtrade_lang') || 'fr';
  const en   = lang === 'en';
  const $    = id => document.getElementById(id);

  $('badge').textContent      = en ? 'Under construction' : 'En cours de construction';
  $('title').textContent      = en ? 'Payment page' : 'Page de paiement';
  $('sub').innerHTML          = en
    ? 'The payment system is under development.<br><strong>Funded</strong> and <strong>Elite</strong> subscriptions will be available soon.'
    : 'Le système de paiement est en cours de développement.<br>Les abonnements <strong>Funded</strong> et <strong>Elite</strong> seront bientôt disponibles.';
  $('price-pro').textContent  = en ? 'Price coming soon' : 'Prix bientôt disponible';
  $('price-lt').textContent   = en ? 'Price coming soon' : 'Prix bientôt disponible';
  $('info-title').textContent = en ? 'Get access right now' : 'Obtenir un accès dès maintenant';
  $('info-body').innerHTML    = en
    ? 'During the beta, paid access is activated via a <strong>promo code</strong>.<br>Go back to the Offers page and enter your code in the dedicated field — or contact us through the in-app contact form.'
    : 'Pendant la bêta, l\'accès payant s\'active via un <strong>code promo</strong>.<br>Retourne sur la page Offres et entre ton code dans le champ dédié — ou contacte-nous via le formulaire intégré à l\'application.';
  $('back-link').textContent  = en ? '← Back to ZeldTrade' : '← Retour à ZeldTrade';
  document.title              = en ? 'Payment — ZeldTrade' : 'Paiement — ZeldTrade';
})();
