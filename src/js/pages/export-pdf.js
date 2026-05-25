// ─── EXPORT PDF DES TRADES (Pro only) ─────────────────────────────────────────
// Génération 100% côté client via jsPDF. Aucune donnée envoyée à un serveur.
// Sécurité :
//  - Store.isPro() check au moment du click (double check même si bouton masqué)
//  - Pas de CDN externe (lib bundlée localement, respecte CSP `script-src 'self'`)
//  - Screenshots fetchés depuis Cloud Storage uniquement si l'user y a déjà accès
//  - Aucune PII partagée avec un tiers (génération + download local)

const ExportPDF = (() => {

  // jsPDF est exposé globalement par la lib UMD via `window.jspdf.jsPDF`
  function _getJsPDF() {
    if (typeof window === 'undefined' || !window.jspdf || !window.jspdf.jsPDF) {
      throw new Error('jsPDF not loaded');
    }
    return window.jspdf.jsPDF;
  }

  // ── Brand colors (RGB pour jsPDF) ────────────────────────────────────────────
  const COLOR_BRAND   = [99, 102, 241];   // #6366f1 violet brand
  const COLOR_TEXT    = [22, 27, 34];     // #161b22 quasi noir
  const COLOR_MUTED   = [107, 114, 128];  // #6b7280 gris
  const COLOR_GREEN   = [63, 185, 80];    // #3fb950 wins
  const COLOR_RED     = [248, 81, 73];    // #f85149 losses
  const COLOR_BORDER  = [229, 231, 235];  // #e5e7eb gris très clair

  function _fmtDate(d) {
    if (!d) return '—';
    // d peut être : Date, string ISO, ou ms timestamp
    const dt = (d instanceof Date) ? d : new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  // Récupère le ms timestamp d'un trade. Le champ stocké est `date` (string ISO),
  // pas `timestamp`. Fallback sur 0 si invalide.
  function _tradeMs(t) {
    if (!t || !t.date) return 0;
    const ms = new Date(t.date).getTime();
    return isNaN(ms) ? 0 : ms;
  }
  // Récupère le netPnl d'un trade via Calc.trade() (pas stocké directement sur t).
  // Fallback sur t.pnl si Calc indisponible.
  function _tradePnl(t) {
    if (typeof Calc !== 'undefined' && typeof Calc.trade === 'function') {
      try {
        const c = Calc.trade(t);
        if (c && Number.isFinite(c.netPnl)) return c.netPnl;
      } catch {}
    }
    return Number(t.pnl) || 0;
  }
  function _tradeRr(t) {
    if (typeof Calc !== 'undefined' && typeof Calc.trade === 'function') {
      try {
        const c = Calc.trade(t);
        if (c && Number.isFinite(c.rr)) return c.rr;
      } catch {}
    }
    return Number(t.rr) || null;
  }
  function _fmtMoney(n) {
    if (n == null || isNaN(n)) return '—';
    const sign = n >= 0 ? '+' : '−';
    return `${sign}${Math.abs(n).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} $`;
  }
  function _fmtPct(n) {
    if (n == null || isNaN(n)) return '—';
    return `${(n * 100).toFixed(1)} %`;
  }

  // ── Filtrage + calcul stats ───────────────────────────────────────────────
  // accountName est le nom du compte (résolu depuis l'ID dans generate()) car
  // les trades stockent le nom du compte dans le champ `apex` (string libre).
  function _filterTrades(allTrades, startMs, endMs, accountName) {
    return allTrades.filter(t => {
      if (!t || t.invalid) return false;
      const ts = _tradeMs(t);
      if (ts < startMs || ts > endMs) return false;
      if (accountName && String(t.apex || '').trim() !== accountName) return false;
      return true;
    });
  }

  function _computeStats(trades) {
    let totalPnl = 0;
    let wins = 0, losses = 0, breakeven = 0, open = 0;
    let totalR = 0, rCount = 0;
    let best = -Infinity, worst = Infinity;
    let bestTrade = null, worstTrade = null;
    for (const t of trades) {
      const pnl = _tradePnl(t);
      totalPnl += pnl;
      if (t.outcome === 'open') open++;
      else if (pnl > 0.01) wins++;
      else if (pnl < -0.01) losses++;
      else breakeven++;
      const rr = _tradeRr(t);
      if (typeof rr === 'number' && isFinite(rr)) {
        totalR += rr;
        rCount++;
      }
      if (pnl > best) { best = pnl; bestTrade = t; }
      if (pnl < worst) { worst = pnl; worstTrade = t; }
    }
    const closed = wins + losses + breakeven;
    const winRate = closed > 0 ? wins / closed : 0;
    const avgR = rCount > 0 ? totalR / rCount : 0;
    return {
      count: trades.length, closed, open,
      wins, losses, breakeven,
      totalPnl, winRate, avgR,
      best: best === -Infinity ? 0 : best,
      worst: worst === Infinity ? 0 : worst,
      bestTrade, worstTrade,
    };
  }

  // ── Helpers de dessin ──────────────────────────────────────────────────────
  function _drawHeader(doc, username) {
    const w = doc.internal.pageSize.getWidth();
    doc.setFillColor(...COLOR_BRAND);
    doc.rect(0, 0, w, 24, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text('ZeldTrade', 14, 15);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(username || '', w - 14, 15, { align: 'right' });
  }

  function _drawFooter(doc, pageNum, totalPages) {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.2);
    doc.line(14, h - 12, w - 14, h - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_MUTED);
    doc.text('ZeldTrade — Journal de trading prop firm — zeldtrade.com', 14, h - 6);
    doc.text(`Page ${pageNum} / ${totalPages}`, w - 14, h - 6, { align: 'right' });
  }

  // ── Page de garde ─────────────────────────────────────────────────────────
  function _drawCoverPage(doc, ctx) {
    const w = doc.internal.pageSize.getWidth();
    const { username, periodLabel, accountLabel, stats } = ctx;

    _drawHeader(doc, username);

    // Titre
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(...COLOR_TEXT);
    doc.text('Rapport de trades', 14, 50);

    // Sous-titre
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(periodLabel, 14, 60);
    if (accountLabel) doc.text(accountLabel, 14, 68);

    // ── Bloc stats globales ──
    let y = 90;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_TEXT);
    doc.text('Statistiques globales', 14, y);
    y += 8;

    // Grille 2x3 de KPI
    const cellW = (w - 28 - 12) / 3; // 14 marge × 2 + 6 gap × 2
    const cellH = 24;
    const gap = 6;

    function drawKpi(col, row, label, value, color) {
      const x = 14 + col * (cellW + gap);
      const yy = y + row * (cellH + gap);
      doc.setDrawColor(...COLOR_BORDER);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, yy, cellW, cellH, 2, 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...COLOR_MUTED);
      doc.text(label.toUpperCase(), x + 4, yy + 7);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...(color || COLOR_TEXT));
      doc.text(String(value), x + 4, yy + 19);
    }

    drawKpi(0, 0, 'Trades total',  stats.count,                              COLOR_TEXT);
    drawKpi(1, 0, 'Clôturés',      stats.closed,                             COLOR_TEXT);
    drawKpi(2, 0, 'Ouverts',       stats.open,                               COLOR_TEXT);
    drawKpi(0, 1, 'P&L total',     _fmtMoney(stats.totalPnl),                stats.totalPnl >= 0 ? COLOR_GREEN : COLOR_RED);
    drawKpi(1, 1, 'Win rate',      _fmtPct(stats.winRate),                   COLOR_TEXT);
    drawKpi(2, 1, 'R:R moyen',     (stats.avgR || 0).toFixed(2),             COLOR_TEXT);

    // Wins / Losses / BE
    y += 2 * (cellH + gap) + 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(`Wins : ${stats.wins}  ·  Losses : ${stats.losses}  ·  Break-even : ${stats.breakeven}`, 14, y);

    // Best / Worst
    y += 14;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLOR_TEXT);
    doc.text('Extrêmes', 14, y);
    y += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_GREEN);
    doc.text(`Meilleur trade : ${_fmtMoney(stats.best)}` +
      (stats.bestTrade ? ` (${stats.bestTrade.instrument || ''} le ${_fmtDate(stats.bestTrade.date)})` : ''), 14, y);
    y += 7;
    doc.setTextColor(...COLOR_RED);
    doc.text(`Pire trade : ${_fmtMoney(stats.worst)}` +
      (stats.worstTrade ? ` (${stats.worstTrade.instrument || ''} le ${_fmtDate(stats.worstTrade.date)})` : ''), 14, y);

    // Note de bas de page
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(
      'Rapport généré localement par ZeldTrade. Aucune donnée transmise à un serveur tiers.',
      14, doc.internal.pageSize.getHeight() - 18
    );
  }

  // v0.9.168 : Charge screenshot Storage via <img> + canvas (contourne CORS
  // car les browsers laissent passer le draw d'image cross-origin si le
  // serveur renvoie les bons headers — Firebase Storage le fait par défaut).
  // Retourne une data URL (string), ou null si échec.
  async function _fetchScreenshotBase64(path) {
    if (!path || !Store.getTradeScreenshotUrl) {
      console.warn('[ExportPDF] _fetchScreenshotBase64: no path or Store.getTradeScreenshotUrl');
      return null;
    }
    let url;
    try {
      url = await Store.getTradeScreenshotUrl(path);
    } catch (e) {
      console.warn('[ExportPDF] getTradeScreenshotUrl failed:', path, e && e.message);
      return null;
    }
    if (!url) {
      console.warn('[ExportPDF] getTradeScreenshotUrl returned null for', path);
      return null;
    }
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width  = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          // JPEG plus petit que PNG pour les screenshots (gain ~70%)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          resolve(dataUrl);
        } catch (e) {
          console.warn('[ExportPDF] canvas readback failed (CORS ?):', path, e && e.message);
          resolve(null);
        }
      };
      img.onerror = () => {
        console.warn('[ExportPDF] img.onerror — screenshot inaccessible:', path);
        resolve(null);
      };
      img.src = url;
      // Timeout sécu 15s
      setTimeout(() => resolve(null), 15000);
    });
  }

  // v0.9.169 : Page dédiée pour un trade — screenshot optionnel
  function _drawTradeDetailPage(doc, trade, imgDataUrl, username, indexLabel) {
    _drawHeader(doc, username);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    let y = 32;

    // En-tête du trade
    const pnl       = _tradePnl(trade);
    const isWin     = pnl > 0.01;
    const isLoss    = pnl < -0.01;
    const direction = (trade.direction === 'short') ? 'SHORT' : 'LONG';
    const dirColor  = (trade.direction === 'short') ? COLOR_RED : COLOR_GREEN;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...COLOR_TEXT);
    const title = indexLabel
      ? `${indexLabel} — ${_fmtDate(trade.date)}`
      : `Trade : ${_fmtDate(trade.date)}`;
    doc.text(title, 14, y);

    // Direction badge en haut à droite
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setFillColor(...dirColor);
    doc.setTextColor(255, 255, 255);
    doc.roundedRect(w - 38, y - 5, 24, 8, 1.5, 1.5, 'F');
    doc.text(direction, w - 26, y + 1, { align: 'center' });
    y += 8;

    // Symbole + Compte
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...COLOR_MUTED);
    doc.text(`${trade.symbol || trade.instrument || '—'}  ·  ${trade.apex || '—'}`, 14, y);
    y += 6;

    // Niveaux
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_TEXT);
    doc.text(`Entry ${trade.entry ?? '—'}   SL ${trade.sl ?? '—'}   TP1 ${trade.tp1 ?? '—'}`, 14, y);
    y += 5;

    // P&L à droite
    const tradeRr = _tradeRr(trade);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...(isWin ? COLOR_GREEN : isLoss ? COLOR_RED : COLOR_TEXT));
    doc.text(_fmtMoney(pnl), w - 14, y, { align: 'right' });
    if (typeof tradeRr === 'number' && isFinite(tradeRr)) {
      doc.setFontSize(9);
      doc.setTextColor(...COLOR_MUTED);
      doc.text(`R:R ${tradeRr.toFixed(2)}`, w - 14, y - 5, { align: 'right' });
    }
    y += 4;

    // Setup + Notes
    const setupText = (trade.setup || '').trim();
    const noteText  = (trade.note || trade.notes || '').trim();
    if (setupText) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...COLOR_MUTED);
      const lines = doc.splitTextToSize(`Setup : ${setupText}`, w - 28);
      doc.text(lines, 14, y);
      y += lines.length * 4;
    }
    if (noteText) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...COLOR_MUTED);
      const lines = doc.splitTextToSize(`Notes : ${noteText}`, w - 28);
      doc.text(lines, 14, y);
      y += lines.length * 4;
    }

    y += 2;

    // Screenshot — fit dans l'espace restant avec ratio préservé
    if (imgDataUrl) {
      try {
        const imgProps = doc.getImageProperties(imgDataUrl);
        const maxW = w - 28;
        const maxH = h - y - 20; // 20mm reserve for footer
        const ratio = imgProps.width / imgProps.height;
        let imgW = maxW;
        let imgH = maxW / ratio;
        if (imgH > maxH) {
          imgH = maxH;
          imgW = maxH * ratio;
        }
        const xOffset = (w - imgW) / 2;
        doc.addImage(imgDataUrl, 'JPEG', xOffset, y, imgW, imgH, undefined, 'FAST');
      } catch (e) {
        console.warn('[ExportPDF] addImage failed for trade', trade.id, e && e.message);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(10);
        doc.setTextColor(...COLOR_MUTED);
        doc.text('Screenshot non affichable (format non supporté ou corrompu).', 14, y + 10);
      }
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(10);
      doc.setTextColor(...COLOR_MUTED);
      doc.text('Aucun screenshot pour ce trade.', 14, y + 10);
    }
  }

  // ── Génération du PDF complet ──────────────────────────────────────────────
  async function generate(opts) {
    const { startMs, endMs, accountId, onProgress } = opts || {};
    const progress = (typeof onProgress === 'function') ? onProgress : () => {};

    // 1. Garde Pro (double check sécurité)
    if (typeof Store === 'undefined' || !Store.isPro || !Store.isPro()) {
      throw new Error('Export PDF réservé aux plans Funded / Elite.');
    }

    // 2. Résoud accountId → accountName (les trades stockent le nom dans `apex`,
    // pas l'ID — donc on doit faire la conversion ici).
    let accountName = null;
    if (accountId) {
      const acc = (Store.getMyAccountById && Store.getMyAccountById(accountId)) || null;
      if (acc && acc.name) accountName = acc.name;
    }

    // 3. Récupère les trades + filtre
    const allTrades = (Store.getTrades && Store.getTrades()) || [];
    const trades = _filterTrades(allTrades, startMs, endMs, accountName);
    // Note : on autorise 0 trade — on génère quand même la page de garde
    // avec stats vides (utile pour test ou compte fraîchement créé).

    // 3. Trie en ordre chronologique (du plus ancien au plus récent) — via
    // _tradeMs car le champ stocké est `date` (string ISO), pas `timestamp`.
    trades.sort((a, b) => _tradeMs(a) - _tradeMs(b));

    // 4. Calcule les stats
    const stats = _computeStats(trades);

    // 5. Contexte global pour les renderers
    const username = (typeof Auth !== 'undefined' && Auth.getCurrentUser && Auth.getCurrentUser().username)
                  || 'Utilisateur';
    const accountLabel = (() => {
      if (!accountId) return null;
      const acc = (Store.getMyAccountById && Store.getMyAccountById(accountId))
                || (Store.getMyAccountByName && Store.getMyAccountByName(accountId));
      return acc ? `Compte : ${acc.name}` : null;
    })();
    // Note : jsPDF helvetica par défaut ne supporte pas certains caractères
    // Unicode (flèches, etc.) → on utilise ' au ' à la place de '→'.
    const periodLabel = `Période : du ${_fmtDate(startMs)} au ${_fmtDate(endMs)}`;
    const ctx = { username, periodLabel, accountLabel, stats };

    // 6. Init jsPDF
    const JsPDF = _getJsPDF();
    const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

    progress({ phase: 'building', message: 'Génération du rapport…' });

    // 7. Page de garde
    _drawCoverPage(doc, ctx);

    // 8. v0.9.169 — Une page par trade en ordre chronologique, avec
    // screenshot intégré si présent. Pas de liste compacte, pas de
    // page séparateur — chaque trade a sa page dédiée.
    let shotsCount = 0;
    for (let i = 0; i < trades.length; i++) {
      const trade = trades[i];
      progress({
        phase: 'trades',
        current: i + 1,
        total: trades.length,
        message: `Génération trade ${i + 1}/${trades.length}…`,
      });
      let imgDataUrl = null;
      if (trade.screenshotPath) {
        imgDataUrl = await _fetchScreenshotBase64(trade.screenshotPath);
        if (imgDataUrl) shotsCount++;
      }
      doc.addPage();
      _drawTradeDetailPage(doc, trade, imgDataUrl, username, `Trade ${i + 1}/${trades.length}`);
    }

    progress({ phase: 'finalizing', message: 'Finalisation du PDF…' });

    // 9. Footer sur toutes les pages
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      _drawFooter(doc, p, totalPages);
    }

    // 10. Download
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `zeldtrade-export-${dateStr}.pdf`;
    doc.save(filename);

    progress({ phase: 'done', message: 'PDF téléchargé !' });

    return { ok: true, count: trades.length, pages: totalPages, screenshots: shotsCount, filename };
  }

  return { generate };
})();
