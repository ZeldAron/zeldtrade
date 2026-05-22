// ─── PAGE NOUVEAUTÉS (updates.html) ──────────────────────────────────────────
// Rend le changelog public depuis Changelog.getEntries(). Fichier séparé (la CSP
// interdit les <script> inline). v0.9.294.
(function () {
  const list = document.getElementById('updates-list');
  if (!list) return;
  const entries = (typeof Changelog !== 'undefined' && Changelog.getEntries)
    ? Changelog.getEntries() : [];
  if (!entries.length) {
    list.innerHTML = '<p class="up-empty">Les nouveautés arrivent bientôt.</p>';
    return;
  }

  // Mapping complet des tags réellement utilisés dans les entrées.
  const TAG = {
    feature:  { label: 'Nouveau',         color: '#a78bfa' },
    feat:     { label: 'Nouveau',         color: '#a78bfa' },
    fix:      { label: 'Correctif',       color: '#facc15' },
    security: { label: 'Sécurité',        color: '#f87171' },
    ui:       { label: 'Interface',       color: '#a78bfa' },
    infra:    { label: 'Technique',       color: '#8b949e' },
    privacy:  { label: 'Confidentialité', color: '#34d399' },
    perf:     { label: 'Performance',     color: '#34d399' },
    data:     { label: 'Données',         color: '#34d399' },
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  list.innerHTML = entries.map(e => {
    const tags = (e.tags || []).map(t => {
      const m = TAG[t] || { label: t, color: '#8b949e' };
      return `<span class="up-tag" style="color:${m.color};border-color:${m.color}40;background:${m.color}1a">${esc(m.label)}</span>`;
    }).join('');
    const items = (e.items || []).map(it => `<li>${esc(it.text)}</li>`).join('');
    return `
      <article class="up-entry">
        <div class="up-head">
          <span class="up-version">v${esc(e.version)}</span>
          <span class="up-date">${esc(e.date)}</span>
          <span class="up-tags">${tags}</span>
        </div>
        <h3 class="up-title">${esc(e.title)}</h3>
        <ul class="up-items">${items}</ul>
      </article>`;
  }).join('');
})();
