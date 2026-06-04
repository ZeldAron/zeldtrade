// ─── ANALYTICS (v0.9.277) — tracking produit léger, 1ʳᵉ partie ─────────────────
// Journalise les pages visitées + actions clés des utilisateurs CONNECTÉS dans
// Firestore (`analyticsEvents`), pour l'onglet « Activité » de l'admin.
// Phase 1 : connectés uniquement (uid). Aucune donnée publicitaire, pas de cookie
// supplémentaire — mesure d'usage 1ʳᵉ partie (mentionnée dans la politique de
// confidentialité). Fire-and-forget : ne bloque jamais l'UI.

const Analytics = (() => {
  'use strict';
  const COL = 'analyticsEvents';
  const _seenPages = new Set();              // dedup page_view par session
  // id de session éphémère (mémoire) — regroupe les events d'une même visite,
  // sans persistance ni cookie.
  const _sid = Math.random().toString(36).slice(2, 12);

  function _uid() {
    try { return (typeof _fbAuth !== 'undefined' && _fbAuth.currentUser) ? _fbAuth.currentUser.uid : null; }
    catch { return null; }
  }

  function track(type, meta) {
    try {
      if (typeof _fbDb === 'undefined' || !_fbDb || typeof firebase === 'undefined') return;
      const uid = _uid();
      if (!uid) return;                       // Phase 1 : connectés uniquement
      const doc = {
        type: String(type || '').slice(0, 40),
        uid,
        sid:  _sid,
        ts:   firebase.firestore.FieldValue.serverTimestamp(),
      };
      if (meta && typeof meta === 'object') {
        if (meta.page)  doc.page  = String(meta.page).slice(0, 40);
        if (meta.label) doc.label = String(meta.label).slice(0, 60);
      }
      _fbDb.collection(COL).add(doc).catch(() => {});
    } catch (e) { /* silencieux : l'analytics ne doit jamais casser l'app */ }
  }

  // Vue de page — dédupliquée par session (1 event par page et par visite)
  function page(name) {
    const key = String(name || '');
    if (_seenPages.has(key)) return;
    _seenPages.add(key);
    track('page_view', { page: key });
  }

  // v0.9.278 — ping « visite » (compteur cookieless), 1 fois par session.
  // Compté côté serveur (CF recordVisit → publicStats). Inclut la landing.
  function pingVisit() {
    try {
      // v1.0.2 : appareil admin (flag posé par la page admin) → ne compte pas mes visites.
      if (localStorage.getItem('zt_notrack') === '1') return;
      if (sessionStorage.getItem('zeld_visit_ping')) return;
      sessionStorage.setItem('zeld_visit_ping', '1');
      if (typeof _fbFunctions !== 'undefined' && _fbFunctions) {
        _fbFunctions.httpsCallable('recordVisit')().catch(() => {});
      }
    } catch (e) { /* silencieux */ }
  }

  return { track, page, pingVisit };
})();
window.Analytics = Analytics;
