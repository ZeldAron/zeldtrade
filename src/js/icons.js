// ─── ICONS (v0.9.276) ─────────────────────────────────────────────────────────
// Jeu d'icônes SVG « line » cohérentes (stroke currentColor) pour remplacer les
// emojis dans l'UI — rendu plus pro. Usage : Icons.svg('target', 24).
// Toutes les icônes héritent de la couleur du texte (currentColor).

const Icons = (() => {
  'use strict';
  const P = {
    target:     '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    barChart:   '<line x1="6" y1="20" x2="6" y2="13"/><line x1="12" y1="20" x2="12" y2="8"/><line x1="18" y1="20" x2="18" y2="4"/>',
    trendingUp: '<polyline points="3 17 9 11 13 15 21 6"/><polyline points="15 6 21 6 21 12"/>',
    lineChart:  '<polyline points="3 16 8 11 12 14 16 7 21 11"/><line x1="3" y1="20" x2="21" y2="20"/>',
    dollar:     '<line x1="12" y1="2" x2="12" y2="22"/><path d="M16 6H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H8"/>',
    zap:        '<polygon points="13 2 4 14 11 14 10 22 20 10 13 10 13 2"/>',
    rocket:     '<path d="M5 15c-1.5 1-2 4-2 4s3-.5 4-2"/><path d="M12 15l-3-3a10 10 0 0 1 7-9 10 10 0 0 1-1 9l-3 3z"/><circle cx="14.5" cy="9.5" r="1.2"/>',
    medal:      '<circle cx="12" cy="9" r="5.5"/><polyline points="8.5 13.5 7 22 12 19 17 22 15.5 13.5"/>',
    star:       '<polygon points="12 2.5 14.7 9 21.5 9.3 16.2 13.7 18 20.5 12 16.7 6 20.5 7.8 13.7 2.5 9.3 9.3 9"/>',
    flame:      '<path d="M12 3c1.5 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1.8.8-2.8 1.6-3.6C10 8.7 11 7 12 3z"/>',
    shield:     '<path d="M12 3l7 3v5c0 4.3-3 7.4-7 9-4-1.6-7-4.7-7-9V6l7-3z"/>',
    calendar:   '<rect x="4" y="5" width="16" height="16" rx="2"/><line x1="4" y1="9.5" x2="20" y2="9.5"/><line x1="9" y1="3" x2="9" y2="7"/><line x1="15" y1="3" x2="15" y2="7"/>',
    lock:       '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    camera:     '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.2"/>',
    sparkle:    '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/>',
    cpu:        '<rect x="7" y="7" width="10" height="10" rx="1.5"/><line x1="10" y1="2.5" x2="10" y2="7"/><line x1="14" y1="2.5" x2="14" y2="7"/><line x1="10" y1="17" x2="10" y2="21.5"/><line x1="14" y1="17" x2="14" y2="21.5"/><line x1="2.5" y1="10" x2="7" y2="10"/><line x1="2.5" y1="14" x2="7" y2="14"/><line x1="17" y1="10" x2="21.5" y2="10"/><line x1="17" y1="14" x2="21.5" y2="14"/>',
    cookie:     '<path d="M12 3a9 9 0 1 0 9 9 4 4 0 0 1-4-4 4 4 0 0 1-4-4 .9.9 0 0 0-1-1z"/><circle cx="9" cy="11" r="1"/><circle cx="14" cy="14" r="1"/><circle cx="13" cy="9" r="0.8"/>',
    mail:       '<rect x="3" y="5" width="18" height="14" rx="2"/><polyline points="3 7 12 13 21 7"/>',
    ban:        '<circle cx="12" cy="12" r="9"/><line x1="5.6" y1="5.6" x2="18.4" y2="18.4"/>',
    bulb:       '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.3 1 2.5h6c0-1.2.3-1.8 1-2.5A6 6 0 0 0 12 3z"/>',
    paperclip:  '<path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 6"/>',
    wave:       '<path d="M5 13l1.5-1.5a2 2 0 0 1 3 0L12 14M3 9l3-3a2 2 0 0 1 3 0l4 4"/><path d="M14 6l3.5-1 .5 3.5"/><path d="M9 20a8 8 0 0 0 11-3"/>',
    bank:       '<polygon points="12 3 21 8 3 8"/><line x1="5" y1="8" x2="5" y2="17"/><line x1="10" y1="8" x2="10" y2="17"/><line x1="14" y1="8" x2="14" y2="17"/><line x1="19" y1="8" x2="19" y2="17"/><line x1="3" y1="20" x2="21" y2="20"/>',
    coin:       '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 2.5-1.5c1.5 0 2.5 1 2.5 2s-1 2-2.5 2H10h2.5c1.5 0 2.5 1 2.5 2s-1 2-2.5 2a2.5 2.5 0 0 1-2.5-1.5"/><line x1="12" y1="6" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="18"/>',
    snow:       '<line x1="12" y1="3" x2="12" y2="21"/><line x1="4" y1="7.5" x2="20" y2="16.5"/><line x1="20" y1="7.5" x2="4" y2="16.5"/>',
  };
  function svg(name, size, extra) {
    const p = P[name];
    if (!p) return '';
    const s = size || 24;
    return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra ? ' ' + extra : ''}>${p}</svg>`;
  }
  return { svg, has: n => !!P[n] };
})();
