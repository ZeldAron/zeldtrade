// ─── PAGE NOUVEAUTÉS (updates.html) ──────────────────────────────────────────
// Rend le changelog public depuis Changelog.getEntries(). Fichier séparé (la CSP
// interdit les <script> inline). Bilingue FR/EN depuis v0.9.378 : même mécanique
// que le reste du site (clé localStorage `zt_lang` + ?lang= + détection navigateur).
(function () {
  const list = document.getElementById('updates-list');
  if (!list) return;

  // ── Langue ────────────────────────────────────────────────────────────────
  const LS_KEY = 'zt_lang';
  function getLang() {
    try {
      const p = new URLSearchParams(location.search).get('lang');
      if (p === 'en' || p === 'fr') return p;
      const ls = localStorage.getItem(LS_KEY);
      if (ls === 'en' || ls === 'fr') return ls;
      return (navigator.language || '').toLowerCase().indexOf('fr') === 0 ? 'fr' : 'en';
    } catch (e) { return 'fr'; }
  }
  function setLang(lang) {
    try { localStorage.setItem(LS_KEY, lang); } catch (e) {}
    try { const u = new URL(location.href); u.searchParams.set('lang', lang); history.replaceState(null, '', u); } catch (e) {}
  }

  // ── Traductions du « chrome » statique de la page ───────────────────────────
  const STATIC = {
    'nav.home':       { fr: 'Accueil',                                en: 'Home' },
    'nav.app':        { fr: "Ouvrir l'app",                           en: 'Open the app' },
    'hero.eyebrow':   { fr: 'Journal de bord',                        en: 'Changelog' },
    'hero.h1':        { fr: 'Toutes les nouveautés ZeldTrade',        en: 'All ZeldTrade updates' },
    'hero.p':         { fr: "L'app évolue vite. Suis ici chaque amélioration, correctif et nouvelle fonctionnalité — et rejoins la communauté pour ne rien rater.",
                        en: 'The app evolves fast. Track every improvement, fix and new feature here — and join the community so you never miss a thing.' },
    'cta.discord':    { fr: 'Rejoindre le Discord',                   en: 'Join the Discord' },
    'cta.news':       { fr: 'Recevoir les nouveautés par email',      en: 'Get updates by email' },
    'cta.note':       { fr: 'Newsletter incluse dans ton compte gratuit · désinscription en 1 clic · zéro spam.',
                        en: 'Newsletter included with your free account · 1-click unsubscribe · zero spam.' },
    'intro':          { fr: 'Historique complet des mises à jour de ZeldTrade.',
                        en: 'Full history of ZeldTrade updates.' },
    'footer.home':    { fr: 'Accueil',                                en: 'Home' },
    'footer.privacy': { fr: 'Confidentialité',                        en: 'Privacy' },
  };
  const META = {
    fr: { title: 'Nouveautés — ZeldTrade' },
    en: { title: 'Updates — ZeldTrade' },
  };
  const EMPTY = { fr: 'Les nouveautés arrivent bientôt.', en: 'Updates are coming soon.' };

  // Mapping des tags réellement utilisés dans les entrées (label FR/EN + couleur).
  const TAG = {
    feature:  { fr: 'Nouveau',         en: 'New',        color: '#a78bfa' },
    feat:     { fr: 'Nouveau',         en: 'New',        color: '#a78bfa' },
    fix:      { fr: 'Correctif',       en: 'Fix',        color: '#facc15' },
    security: { fr: 'Sécurité',        en: 'Security',   color: '#f87171' },
    ui:       { fr: 'Interface',       en: 'Interface',  color: '#a78bfa' },
    ux:       { fr: 'Expérience',      en: 'UX',         color: '#a78bfa' },
    infra:    { fr: 'Technique',       en: 'Technical',  color: '#8b949e' },
    privacy:  { fr: 'Confidentialité', en: 'Privacy',    color: '#34d399' },
    perf:     { fr: 'Performance',     en: 'Performance',color: '#34d399' },
    data:     { fr: 'Données',         en: 'Data',       color: '#34d399' },
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const entries = (typeof Changelog !== 'undefined' && Changelog.getEntries)
    ? Changelog.getEntries() : [];

  // ── Rendu de la liste des entrées dans la langue donnée ─────────────────────
  function renderList(lang) {
    const isEn = lang === 'en';
    if (!entries.length) {
      list.innerHTML = '<p class="up-empty">' + esc(EMPTY[lang] || EMPTY.fr) + '</p>';
      return;
    }
    list.innerHTML = entries.map(function (e) {
      const title = isEn && e.titleEn ? e.titleEn : e.title;
      const tags = (e.tags || []).map(function (t) {
        const m = TAG[t] || { fr: t, en: t, color: '#8b949e' };
        const label = (isEn ? m.en : m.fr) || m.fr || t;
        return '<span class="up-tag" style="color:' + m.color + ';border-color:' + m.color + '40;background:' + m.color + '1a">' + esc(label) + '</span>';
      }).join('');
      const items = (e.items || []).map(function (it) {
        const text = isEn && it.textEn ? it.textEn : it.text;
        return '<li>' + esc(text) + '</li>';
      }).join('');
      return '' +
        '<article class="up-entry">' +
          '<div class="up-head">' +
            '<span class="up-version">v' + esc(e.version) + '</span>' +
            '<span class="up-date">' + esc(e.date) + '</span>' +
            '<span class="up-tags">' + tags + '</span>' +
          '</div>' +
          '<h3 class="up-title">' + esc(title) + '</h3>' +
          '<ul class="up-items">' + items + '</ul>' +
        '</article>';
    }).join('');
  }

  // ── Application des libellés statiques + état des boutons langue ─────────────
  function applyStatic(lang) {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const d = STATIC[el.getAttribute('data-i18n')];
      if (d && d[lang] != null) el.textContent = d[lang];
    });
    const m = META[lang];
    if (m && m.title) document.title = m.title;
    document.querySelectorAll('.lang-btn').forEach(function (b) {
      const on = b.getAttribute('data-lang') === lang;
      b.style.opacity = on ? '1' : '0.45';
      b.style.borderColor = on ? 'var(--accent-l)' : 'rgba(255,255,255,0.18)';
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function renderAll(lang) {
    applyStatic(lang);
    renderList(lang);
  }

  // ── Sélecteur de langue ─────────────────────────────────────────────────────
  document.querySelectorAll('.lang-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      const l = b.getAttribute('data-lang');
      if (l !== 'fr' && l !== 'en') return;
      setLang(l);
      renderAll(l);
    });
  });

  renderAll(getLang());
})();
