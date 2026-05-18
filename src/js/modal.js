// ─── MODAL / WIZARD ───────────────────────────────────────────────────────────
// Wizard 3 étapes : Direction → Screenshot (IA) → Détails + calcul

const Modal = (() => {
  let editingId     = null;
  let onSaved       = null;
  let direction     = null;    // 'long' | 'short'
  let capturedImage = null;    // base64
  let parsedTrade   = null;    // { entry, sl, tp1, tp2, tp3, instrument }
  let _forceClaude  = false;   // v0.9.223 — set par "Réanalyser" pour forcer Claude direct
  let capital       = 50000;
  let feePerSide    = 2.14;
  let feeTakerPct   = null;  // v0.9.190 : null = trade non-crypto, sinon % (ex: 0.05)
  let spreadCost    = 0;
  let firmKey       = 'apex';

  // Screenshot du trade (persistant — Firebase Storage)
  // shotBlob : Blob compressé en mémoire au paste, uploadé au save
  // shotExistingPath : path Storage si on édite un trade qui a déjà un screenshot
  // shotPendingDelete : true si user a cliqué Supprimer sur un screenshot existant
  let shotBlob          = null;
  let shotExistingPath  = null;
  let shotPendingDelete = false;
  // Pré-génère un ID trade pour le mode création (utile pour upload Storage avant save)
  let pendingTradeId    = null;

  function getSpreadForInstrument(fk, instr) {
    const sp = Store.getSpreadsByFirm(fk || 'apex');
    return sp[instr] != null ? sp[instr] : 0;
  }

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const STATUS_LABEL = { evaluation: 'EVAL', funded: 'PA' };

  // ── Navigation ──────────────────────────────────────────────────────────────
  function goToStep(n) {
    [1, 2, 3].forEach(i => {
      $('wp' + i).style.display = i === n ? '' : 'none';
      const dot = $('wdot' + i);
      dot.className = 'wdot' + (i < n ? ' done' : i === n ? ' active' : '');
    });
    if ($('wline12')) $('wline12').className = 'wdot-line' + (n > 1 ? ' done' : '');
    if ($('wline23')) $('wline23').className = 'wdot-line' + (n > 2 ? ' done' : '');
  }

  // ── Étape 1 : Direction ──────────────────────────────────────────────────────
  function setDirection(d) {
    direction = d;
    $('wBtnLong').className  = 'dir-btn' + (d === 'long'  ? ' active-long'  : '');
    $('wBtnShort').className = 'dir-btn' + (d === 'short' ? ' active-short' : '');
    const badge = $('wDirBadge');
    badge.textContent      = d === 'long' ? 'LONG' : 'SHORT';
    badge.style.color      = d === 'long' ? 'var(--green)' : 'var(--red)';
    badge.style.background = d === 'long' ? 'var(--green-dim)' : 'var(--red-dim)';
    goToStep(2);
    const groqBadge = $('groqStatusBadge');
    if (groqBadge) {
      // Avec la Cloud Function, l'IA est toujours disponible côté serveur
      groqBadge.textContent = i18n.t('modal.groq.active');
      groqBadge.style.color = 'var(--green)';
    }
    setTimeout(() => $('wDropZone').focus?.(), 150);
  }

  // ── Étape 2 : Image ─────────────────────────────────────────────────────────

  // Validation magic bytes — anti-MIME spoofing.
  // Le MIME type côté navigateur est facilement falsifiable ; on vérifie la
  // signature binaire (4-12 premiers octets) pour confirmer qu'il s'agit
  // bien d'une image légitime.
  function isValidImageMagicBytes(bytes) {
    if (bytes.length < 12) return false;
    // PNG : 89 50 4E 47 0D 0A 1A 0A
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true;
    // JPEG : FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true;
    // GIF87a / GIF89a : 47 49 46 38
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true;
    // WEBP : RIFF....WEBP (RIFF = 52 49 46 46, then 4 bytes size, then 57 45 42 50)
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return true;
    // BMP : 42 4D
    if (bytes[0] === 0x42 && bytes[1] === 0x4D) return true;
    return false;
  }

  function loadImageFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { UI.toast('Format non supporté — utilise une image (PNG, JPG…)', true); return; }
    if (file.size > 10 * 1024 * 1024)   { UI.toast('Image trop lourde (max 10 Mo)', true); return; }

    // Vérification magic bytes avant lecture complète (évite de charger un fichier malicieux)
    file.slice(0, 12).arrayBuffer().then(buf => {
      const head = new Uint8Array(buf);
      if (!isValidImageMagicBytes(head)) {
        UI.toast('Fichier invalide — l\'image semble corrompue ou son extension a été modifiée.', true);
        return;
      }
      const reader = new FileReader();
      reader.onload = ev => {
        const b64 = ev.target.result.split(',')[1];
        capturedImage = b64;
        $('wPreviewImg').src             = 'data:image/png;base64,' + b64;
        $('wDropPrompt').style.display   = 'none';
        $('wImagePreview').style.display = '';
        $('wDropZone').classList.add('has-image');
        analyzeImage();
      };
      reader.readAsDataURL(file);
    }).catch(() => {
      UI.toast('Erreur de lecture du fichier.', true);
    });
  }

  function clearImage() {
    capturedImage = null;
    parsedTrade   = null;
    $('wDropZone').classList.remove('has-image');
    $('wDropPrompt').style.display   = '';
    $('wImagePreview').style.display = 'none';
    $('wPreviewImg').src             = '';
    $('wAnalysisStatus').style.display = 'none';
    $('wAnalysisResult').style.display = 'none';
  }

  function parseTextHint(text) {
    const t = text.toLowerCase();
    const r = { entry: null, sl: null, tp1: null, tp2: null, tp3: null, contracts: 1 };
    const findNum = (keys) => {
      for (const k of keys) {
        const m = t.match(new RegExp(k + '[\\s:=]+([\\d.]+)', 'i'));
        if (m) return parseFloat(m[1]);
      }
      return null;
    };
    r.entry     = findNum(['entry', 'entrée', 'entree', 'e']);
    r.sl        = findNum(['sl', 'stop']);
    r.tp1       = findNum(['tp1', 'tp', 'target', 'profit']);
    r.tp2       = findNum(['tp2']);
    r.tp3       = findNum(['tp3']);
    // v0.9.162 (B7b fix) : parseFloat + regex décimal pour gérer "0.2 lots"
    const lotsM = t.match(/(\d+(?:\.\d+)?)\s*(lots?|contrats?)/i);
    if (lotsM) r.contracts = parseFloat(lotsM[1]);
    return (r.entry || r.sl || r.tp1) ? r : null;
  }

  // ── Cloudflare Turnstile (v0.9.160 — hybride : token si dispo, sinon CF
  // applique rate-limit IP). Échec gracieux pour navigateurs incompatibles
  // (Safari ITP, Firefox + content blockers, etc.).
  const _TURNSTILE_SITE_KEY = '0x4AAAAAADQkL2_LnsGG4b2_';
  let _turnstileWidgetId = null;

  function _getTurnstileToken() {
    return new Promise((resolve) => {
      // Resolve EMPTY si Turnstile SDK pas chargé (CSP blocker, extension, etc.)
      if (typeof turnstile === 'undefined') {
        console.warn('[Turnstile] SDK absent — fallback rate-limit IP server-side');
        return resolve('');
      }
      let container = document.getElementById('turnstileContainer');
      if (!container) {
        container = document.createElement('div');
        container.id = 'turnstileContainer';
        container.style.cssText = 'position:fixed;left:-9999px;top:-9999px;visibility:hidden';
        document.body.appendChild(container);
      }
      if (_turnstileWidgetId !== null) {
        try { turnstile.reset(_turnstileWidgetId); } catch {}
      }
      try {
        _turnstileWidgetId = turnstile.render(container, {
          sitekey: _TURNSTILE_SITE_KEY,
          size: 'invisible',
          callback: (token) => resolve(token || ''),
          'error-callback': () => { console.warn('[Turnstile] error-callback'); resolve(''); },
          'expired-callback': () => { console.warn('[Turnstile] expired'); resolve(''); },
        });
        try { turnstile.execute(_turnstileWidgetId); } catch (e) {
          console.warn('[Turnstile] execute failed:', e && e.message);
          return resolve('');
        }
        // Timeout sécu : 8s puis on lâche et on laisse le rate-limit IP prendre le relais
        setTimeout(() => resolve(''), 8000);
      } catch (e) {
        console.warn('[Turnstile] render failed:', e && e.message);
        resolve('');
      }
    });
  }

  // ── Helper : trie 3 niveaux de prix et les assigne selon la direction ────────
  // Évite que l'IA confonde Entry/SL/TP si elle interprète mal les couleurs
  // (les utilisateurs peuvent personnaliser leurs zones d'ordre TradingView).
  // Logique : pour un LONG → min=SL, mid=Entry, max=TP. Inverse pour SHORT.
  function _sortLevelsByDirection(values, isLong) {
    const nums = values.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
    if (nums.length < 3) return null;
    const sorted = [...nums].sort((a, b) => a - b);
    const min = sorted[0], mid = sorted[Math.floor(sorted.length / 2)], max = sorted[sorted.length - 1];
    if (isLong) return { sl: min, entry: mid, tp1: max };
    return { tp1: min, entry: mid, sl: max };
  }

  // ── Groq Vision API (via Cloud Function — clé API jamais exposée au client) ──
  async function analyzeWithGroq(imageB64, _unusedApiKey, direction) {
    const isLong = direction !== 'short';
    // v0.9.220 — Prompt insiste sur les LABELS d'ORDRES (LMT/STP/SL/TP/OCO)
    // + gestion des screenshots split-screen (Sierra Chart, multi-monitor setup).
    const prompt =
      `You are reading a trading chart screenshot (TradingView, NinjaTrader, Sierra Chart, MT4/MT5, cTrader, ThinkorSwim, Quantower, ATAS, or similar platforms).\n` +
      `This is a ${isLong ? 'LONG' : 'SHORT'} trade.\n\n` +

      `STEP 1 — If the screenshot shows MULTIPLE chart panels side-by-side (Sierra Chart split-screen,\n` +
      `dual-monitor capture, etc.), FOCUS ONLY on the panel that contains visible ORDER LABELS\n` +
      `(LMT, STP, SL, TP, OCO). Ignore other panels (volume profile, orderbook, reversal chart, footprint).\n` +
      `Pick the 3 prices from THE SAME panel — never mix prices from different panels.\n\n` +

      `STEP 2 — In that panel, only consider horizontal lines/boxes that have an ORDER LABEL next to them.\n` +
      `Valid order labels (case-insensitive): "LMT", "STP", "STP LMT", "SL", "TP", "OCO", "Limit", "Stop",\n` +
      `"Take Profit", "Stop Loss", or a small position icon (cart 🛒, briefcase 💼) with "Brut" or "P&L" or "USD".\n\n` +

      `IGNORE these lines (they are indicators, NOT trade levels):\n` +
      `- VPOC (Volume Point of Control — usually an orange/yellow horizontal line)\n` +
      `- VWAP, MA, EMA, SMA, Dynamic, Anchored lines\n` +
      `- Volume bars, profile histograms on the right side\n` +
      `- The current live price ticker (top-left "B:", "C:", "Ch:")\n` +
      `- Right-axis labels with ⊕ symbol or HH:MM countdown timer\n` +
      `- Any horizontal line WITHOUT an order label nearby (it's likely an indicator)\n` +
      `- Right-axis prices in OTHER panels (e.g. orderbook side panel)\n\n` +

      `Find EXACTLY 3 horizontal levels that have order labels and assign them:\n` +
      `${isLong
        ? `- TOP (highest price)    → tp1   (often label "LMT" or "TP" or rectangle with cart icon)\n- MIDDLE                 → entry (often blue/teal label "STP LMT" or position icon with "Brut")\n- BOTTOM (lowest price)  → sl    (often label "STP" or "SL")`
        : `- TOP (highest price)    → sl    (often label "STP" or "SL")\n- MIDDLE                 → entry (often blue/teal label "STP LMT" or position icon with "Brut")\n- BOTTOM (lowest price)  → tp1   (often label "LMT" or "TP")`}\n\n` +

      `RULES:\n` +
      `- A complete trade has 3 levels WITH order labels. If you see 4+ lines, the extras are indicators (ignore them).\n` +
      `- European format may use "," or " " (28 944,25 = 28944.25)\n` +
      `- Never invent numbers. Copy EXACTLY from the chart.\n` +
      `- Constraint: ${isLong ? 'sl < entry < tp1' : 'tp1 < entry < sl'}\n` +
      `- Read the EXACT price from the right axis (the price label aligned with the order line).\n\n` +

      `Respond with ONLY this JSON on one line:\n` +
      `{"entry":NUMBER,"sl":NUMBER,"tp1":NUMBER}`;

    // v0.9.217 — Retiré llama-3.2-vision-preview (deprecated par Groq, retourne 404).
    // Llama 4 Scout/Maverick sont les modèles vision officiels en GA.
    const GROQ_MODELS = [
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'meta-llama/llama-4-maverick-17b-128e-instruct',
    ];

    // Appel via Cloud Function (clé Groq côté serveur, quota enforce côté serveur)
    if (!_fbFunctions) throw new Error('Service IA indisponible — recharge la page.');

    // v0.9.160 : hybride Turnstile + rate-limit IP.
    // Si Turnstile fonctionne (la majorité des browsers) → token valide → CF passe.
    // Sinon (Safari ITP, content blocker Firefox, etc.) → token vide → CF applique
    // rate-limit IP strict (1 analyse / 5 min / IP) comme fallback.
    const turnstileToken = await _getTurnstileToken();

    const callable = _fbFunctions.httpsCallable('analyzeChart');
    let lastError = null;
    // v0.9.216 — Garde le meilleur résultat partiel (1 ou 2 valeurs) pour fallback
    // si AUCUN modèle Groq n'arrive à détecter les 3 niveaux complets.
    let bestPartial = null;
    const _partialScore = r => (r ? (r.entry ? 1 : 0) + (r.sl ? 1 : 0) + (r.tp1 ? 1 : 0) : 0);

    for (const model of GROQ_MODELS) {
      let data;
      try {
        const result = await callable({ model, prompt, imageB64, turnstileToken });
        data = result.data;
      } catch (e) {
        lastError = e;
        const code = e.code || '';
        const msg  = e.message || '';
        console.warn('[Groq via CF] error for', model, ':', code, msg, e);
        if (code === 'functions/unauthenticated' || code === 'unauthenticated')
          throw new Error('Tu dois être connecté pour analyser un screenshot.');
        if (code === 'functions/resource-exhausted' || code === 'resource-exhausted')
          throw new Error(msg || 'Limite quotidienne atteinte. Passe Pro pour des analyses illimitées.');
        if (code === 'functions/failed-precondition' || code === 'failed-precondition')
          // v0.9.141 : afficher le vrai message serveur (email non vérifié,
          // captcha invalide, etc.) au lieu du mapping erroné "Clé Groq invalide"
          // qui datait de l'époque où la clé Groq était côté client.
          throw new Error(msg || 'Action non autorisée — vérifie ton compte.');
        if (code === 'functions/invalid-argument' || code === 'invalid-argument')
          throw new Error('Requête invalide : ' + msg);
        if (code === 'functions/internal' || code === 'internal')
          throw new Error('Erreur serveur : ' + msg);
        // Erreur réseau ou modèle indisponible → essayer le suivant
        continue;
      }

      const text = data.choices?.[0]?.message?.content || '';

      // Parsing robuste : JSON dans markdown ou brut
      const jsonStr = (text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || [])[1]
                   || (text.match(/(\{[\s\S]*?\})/) || [])[1]
                   || '';
      if (!jsonStr) {
        // Fallback : extraire les nombres directement du texte
        const nums = [...text.matchAll(/\b(\d{4,6}(?:\.\d+)?)\b/g)].map(m => parseFloat(m[1]));
        if (nums.length >= 3) {
          // v0.9.215 — Tri direction-aware (corrige LONG vs SHORT)
          const reordered = _sortLevelsByDirection(nums.slice(0, 3), isLong);
          if (reordered) return reordered;
        }
        continue;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) continue;
        const result = {};
        for (const key of ['entry', 'sl', 'tp1', 'tp2']) {
          if (key in parsed) {
            const v = parseFloat(parsed[key]);
            // v0.9.218 — Filtre les 0 et négatifs (l'IA peut retourner 0 au lieu de null)
            if (!isNaN(v) && isFinite(v) && v > 0) result[key] = v;
          }
        }
        // v0.9.215 — Anti confusion couleur : si on a Entry+SL+TP1, on re-trie
        // et réassigne selon la direction (TP > Entry > SL pour LONG, inverse pour SHORT).
        // Évite que l'IA inverse Entry/TP quand TradingView affiche 2 zones rouges
        // (OCO take-profit + stop-loss avec le même style de couleur).
        const triplet = [result.entry, result.sl, result.tp1];
        const reordered = _sortLevelsByDirection(triplet, isLong);
        if (reordered) {
          // 3 valeurs détectées → tri direction-aware et retour immédiat
          result.entry = reordered.entry;
          result.sl    = reordered.sl;
          result.tp1   = reordered.tp1;
          return result;
        }
        // v0.9.216 — Si seulement 1-2 valeurs détectées, on garde comme fallback
        // et on essaye le modèle suivant (peut-être qu'un autre modèle Groq lit les 3).
        if (_partialScore(result) > _partialScore(bestPartial)) {
          bestPartial = result;
        }
      } catch { continue; }
    }

    // v0.9.216 — Aucun modèle n'a retourné 3 valeurs : on renvoie le meilleur partiel
    // (au moins 1 valeur). L'user verra "Niveaux détectés (compléter en étape 3)"
    // et pourra saisir le niveau manquant à la main + Réanalyser.
    if (bestPartial && _partialScore(bestPartial) >= 1) {
      return bestPartial;
    }

    if (lastError) {
      throw new Error('IA : ' + (lastError.message || lastError.code || 'erreur inconnue'));
    }
    throw new Error(i18n.t('modal.groq.nomodel'));
  }

  // ── Claude Vision via Cloud Function (fallback pour screenshots complexes) ──
  // v0.9.222 — Gated server-side aux tiers Funded/Elite/Beta (Trader = Groq only).
  async function analyzeWithClaude(imageB64, direction) {
    const isLong = direction !== 'short';
    // Même prompt que Groq (déjà optimisé v0.9.220)
    const prompt =
      `You are reading a trading chart screenshot (TradingView, NinjaTrader, Sierra Chart, MT4/MT5, cTrader, ThinkorSwim, Quantower, ATAS, or similar platforms).\n` +
      `This is a ${isLong ? 'LONG' : 'SHORT'} trade.\n\n` +
      `STEP 1 — If the screenshot shows MULTIPLE chart panels side-by-side, FOCUS ONLY on the panel\n` +
      `that contains visible ORDER LABELS (LMT, STP, SL, TP, OCO). Ignore other panels (volume profile,\n` +
      `orderbook, reversal chart, footprint). Pick the 3 prices from THE SAME panel.\n\n` +
      `STEP 2 — Only consider horizontal lines/boxes that have an ORDER LABEL next to them.\n` +
      `Valid labels: "LMT", "STP", "STP LMT", "SL", "TP", "OCO", "Limit", "Stop", or a position icon\n` +
      `(cart 🛒, briefcase 💼) with "Brut" or "P&L" or "USD".\n\n` +
      `IGNORE: VPOC, VWAP, MA, EMA, SMA, Dynamic, Anchored lines; volume bars; live price ticker;\n` +
      `right-axis labels with ⊕ symbol or HH:MM countdown; any horizontal line WITHOUT order label.\n\n` +
      `Find EXACTLY 3 horizontal levels with order labels and assign by position:\n` +
      `${isLong
        ? `- TOP (highest price)    → tp1\n- MIDDLE                 → entry\n- BOTTOM (lowest price)  → sl`
        : `- TOP (highest price)    → sl\n- MIDDLE                 → entry\n- BOTTOM (lowest price)  → tp1`}\n\n` +
      `European format may use "," or " " (28 944,25 = 28944.25). Constraint: ${isLong ? 'sl < entry < tp1' : 'tp1 < entry < sl'}.\n` +
      `Read EXACT prices from the right axis. Prefer giving an approximate number from the visible axis over null. Return null ONLY if no horizontal line/box with a price label is visible at all.\n\n` +
      `Respond with ONLY this JSON on one line:\n{"entry":NUMBER,"sl":NUMBER,"tp1":NUMBER}`;

    if (!_fbFunctions) throw new Error('Service IA indisponible — recharge la page.');
    const turnstileToken = await _getTurnstileToken();
    const callable = _fbFunctions.httpsCallable('analyzeChart');

    let result;
    try {
      const resp = await callable({ provider: 'claude', model: 'claude-sonnet', prompt, imageB64, turnstileToken });
      result = resp.data;
    } catch (e) {
      console.warn('[Claude via CF] error:', e.code, e.message);
      if (e.code === 'functions/permission-denied' || e.code === 'permission-denied') {
        // Tier insuffisant — déjà filtré côté client mais double safety
        return null;
      }
      // Réseau ou autre → on retourne null, le client gardera le résultat Groq partiel
      return null;
    }

    const text = result.choices?.[0]?.message?.content || '';
    const jsonStr = (text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || [])[1]
                 || (text.match(/(\{[\s\S]*?\})/) || [])[1]
                 || '';
    if (!jsonStr) return null;

    let parsed;
    try { parsed = JSON.parse(jsonStr); } catch { return null; }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;

    const out = {};
    for (const key of ['entry', 'sl', 'tp1', 'tp2']) {
      if (key in parsed) {
        const v = parseFloat(parsed[key]);
        if (!isNaN(v) && isFinite(v) && v > 0) out[key] = v;
      }
    }
    // Tri direction-aware (même logique que Groq)
    const triplet = [out.entry, out.sl, out.tp1];
    const reordered = _sortLevelsByDirection(triplet, isLong);
    if (reordered) {
      out.entry = reordered.entry;
      out.sl    = reordered.sl;
      out.tp1   = reordered.tp1;
    }
    return out;
  }

  // Helper : check si le tier de l'user permet le fallback Claude (Funded+)
  function _canUseClaudeFallback() {
    if (typeof Store === 'undefined' || typeof Store.getTier !== 'function') return false;
    const tier = Store.getTier();
    return tier === 'funded' || tier === 'elite' || tier === 'beta';
  }

  async function analyzeImage() {
    if (!capturedImage) return;

    const statusEl = $('wAnalysisStatus');
    const retryBtn = $('wBtnRetry');
    const textHint = ($('wTextHint').value || '').trim();

    statusEl.style.display  = 'block';
    statusEl.innerHTML      = `<span style="color:var(--muted)">${i18n.t('modal.groq.analyzing')}</span>`;
    $('wBtnNext2').disabled = true;
    $('wAnalysisResult').style.display = 'none';
    retryBtn.style.display  = 'none';

    try {

      // Pré-check côté client (UX rapide — la Cloud Function fait le vrai check)
      if (!Store.canAnalyzeToday()) {
        statusEl.innerHTML = `<span style="color:var(--red)">${i18n.t('err.limit.ai')}</span>
          <span style="color:var(--muted)"> <a href="#" id="goOffersLink" style="color:var(--accent)">${i18n.t('err.limit.ai.cta')}</a></span>`;
        const lk = document.getElementById('goOffersLink');
        if (lk) lk.addEventListener('click', e => {
          e.preventDefault();
          Modal.close();
          document.querySelector('[data-page="offers"]').click();
        });
        $('wBtnNext2').disabled = false;
        retryBtn.style.display = 'none';
        return;
      }

      // v0.9.223 — Force Claude direct si l'user clique "Réanalyser" (opt-in fallback explicite).
      // Sinon route normale : Groq d'abord + fallback Claude auto si Groq raté.
      const _scoreResult = r => r ? ((r.entry ? 1 : 0) + (r.sl ? 1 : 0) + (r.tp1 ? 1 : 0)) : 0;
      const _isAberrantTrade = (r) => {
        if (!r || !r.entry || !r.sl || !r.tp1) return false;
        const risk   = Math.abs(Number(r.entry) - Number(r.sl));
        const reward = Math.abs(Number(r.tp1) - Number(r.entry));
        if (risk < 0.5 || reward < 0.5) return true; // écart trop petit = erreur lecture digit
        const rr = reward / risk;
        return rr < 0.2 || rr > 15;
      };

      let result;
      if (_forceClaude && _canUseClaudeFallback()) {
        // Réanalyse forcée → Claude direct sans passer par Groq
        statusEl.innerHTML = `<span style="color:var(--accent-l)">🤖 Analyse approfondie via Claude…</span>`;
        try {
          result = await analyzeWithClaude(capturedImage, direction);
        } catch (e) {
          console.warn('[Claude direct] failed:', e && e.message);
          result = null;
        }
        Store.refreshAiUsage();
        _forceClaude = false; // reset pour la prochaine analyse
      } else {
        // Route normale : Groq d'abord
        result = await analyzeWithGroq(capturedImage, null, direction);
        Store.refreshAiUsage();

        // Fallback Claude si Groq insuffisant OU résultat aberrant (R:R cassé)
        const groqScore   = _scoreResult(result);
        const groqAberrant = _isAberrantTrade(result);
        const groqBad     = groqScore < 3 || groqAberrant;
        if (groqBad && _canUseClaudeFallback()) {
          statusEl.innerHTML = `<span style="color:var(--accent-l)">🤖 Analyse approfondie via Claude…</span>`;
          try {
            const claudeResult = await analyzeWithClaude(capturedImage, direction);
            // On garde Claude SI il fait mieux (score plus haut OU non-aberrant)
            const claudeScore = _scoreResult(claudeResult);
            const claudeAberrant = _isAberrantTrade(claudeResult);
            if (claudeResult && (claudeScore > groqScore || (claudeScore === groqScore && !claudeAberrant && groqAberrant))) {
              result = claudeResult;
            }
          } catch (e) {
            console.warn('[Claude fallback] failed:', e && e.message);
            // Continue silencieusement avec le résultat Groq partiel
          }
        }
      }

      let { entry, sl, tp1 } = result || {};
      entry = entry || null; sl = sl || null; tp1 = tp1 || null;

      // Complète avec le hint texte si valeurs manquantes
      if (textHint) {
        const hint = parseTextHint(textHint);
        if (hint) {
          if (!entry && hint.entry) entry = hint.entry;
          if (!sl    && hint.sl)    sl    = hint.sl;
          if (!tp1   && hint.tp1)   tp1   = hint.tp1;
        }
      }

      if (!entry && !sl && !tp1) {
        const hint = parseTextHint(textHint);
        if (hint) {
          parsedTrade = hint;
          statusEl.innerHTML = `<span style="color:var(--amber)">${i18n.t('modal.img.unreadable')}</span>`;
        } else {
          throw new Error(i18n.t('modal.groq.notfound'));
        }
      } else {
        parsedTrade = { entry, sl, tp1, tp2: null, tp3: null, instrument: null, contracts: 1 };
        // Swap si incohérent avec la direction
        if (parsedTrade.entry && parsedTrade.sl && parsedTrade.tp1) {
          if (direction === 'long'  && parsedTrade.sl > parsedTrade.entry)
            [parsedTrade.sl, parsedTrade.tp1] = [parsedTrade.tp1, parsedTrade.sl];
          if (direction === 'short' && parsedTrade.sl < parsedTrade.entry)
            [parsedTrade.sl, parsedTrade.tp1] = [parsedTrade.tp1, parsedTrade.sl];
        }
        const missing = (!entry || !sl || !tp1) ? ` <span style="color:var(--amber)">${i18n.t('modal.complete.step3')}</span>` : '';

        // v0.9.220 — Détection R:R aberrant → warning visible
        let warningHtml = '';
        if (parsedTrade.entry && parsedTrade.sl && parsedTrade.tp1) {
          const e = Number(parsedTrade.entry);
          const s = Number(parsedTrade.sl);
          const t = Number(parsedTrade.tp1);
          const risk   = Math.abs(e - s);
          const reward = Math.abs(t - e);
          const rr     = risk > 0 ? reward / risk : 0;
          // R:R aberrant (très bas < 0.2 ou très haut > 15) ou écart Entry-TP < 1 point
          if (rr < 0.2 || rr > 15 || reward < 1 || risk < 1) {
            warningHtml = ` <span style="color:var(--red);font-weight:600">⚠ R:R suspect (${rr.toFixed(2)}) — vérifie les valeurs</span>`;
          }
        }

        // v0.9.222 — Upsell Claude pour les Trader si Groq a raté (missing values).
        // Funded/Elite ont déjà eu le fallback Claude automatique en amont.
        let upsellHtml = '';
        const _tier = (typeof Store !== 'undefined' && Store.getTier) ? Store.getTier() : 'trader';
        if ((missing || warningHtml) && _tier === 'trader') {
          upsellHtml = ` <a href="#" id="aiUpsellLink" style="color:var(--accent-l);font-size:11px;text-decoration:underline">Passe Funded pour analyse approfondie via Claude →</a>`;
        }

        statusEl.innerHTML = `<span style="color:var(--green)">${i18n.t('modal.levels.detected')}</span>${missing}${warningHtml}${upsellHtml} <span style="color:var(--muted);font-size:10px">via IA</span>`;

        const _upsellLink = document.getElementById('aiUpsellLink');
        if (_upsellLink) {
          _upsellLink.addEventListener('click', e => {
            e.preventDefault();
            Modal.close();
            const offersBtn = document.querySelector('[data-page="offers"]');
            if (offersBtn) offersBtn.click();
          });
        }
      }

      function renderEditablePills() {
        const fv        = v => (v !== null && !isNaN(Number(v)) && Number(v) !== 0) ? Number(v) : '';
        const container = $('wAnalysisResult');
        container.innerHTML = '';
        const PILL_KEYS = new Set(['entry', 'sl', 'tp1', 'tp2', 'tp3']);
        const pills = [
          { cls: 'wpill wpill-edit',          label: 'Entry', key: 'entry', val: fv(parsedTrade.entry) },
          { cls: 'wpill wpill-sl wpill-edit',  label: 'SL',    key: 'sl',   val: fv(parsedTrade.sl)    },
          { cls: 'wpill wpill-tp wpill-edit',  label: 'TP1',   key: 'tp1',  val: fv(parsedTrade.tp1)   },
          ...(parsedTrade.tp2 ? [{ cls: 'wpill wpill-tp wpill-edit', label: 'TP2', key: 'tp2', val: Number(parsedTrade.tp2) }] : []),
          ...(parsedTrade.tp3 ? [{ cls: 'wpill wpill-tp wpill-edit', label: 'TP3', key: 'tp3', val: Number(parsedTrade.tp3) }] : []),
        ];
        pills.forEach(({ cls, label, key, val }) => {
          const div   = document.createElement('div');
          div.className = cls;
          const span  = document.createElement('span');
          span.textContent = label;
          const input = document.createElement('input');
          input.type        = 'number';
          input.step        = '0.1';
          input.dataset.pill = key;
          input.placeholder = '—';
          if (val !== '') input.value = val;
          const handler = () => {
            if (!PILL_KEYS.has(input.dataset.pill)) return;
            parsedTrade[input.dataset.pill] = parseFloat(input.value) || null;
          };
          input.addEventListener('change', handler);
          input.addEventListener('input',  handler);
          div.appendChild(span);
          div.appendChild(input);
          container.appendChild(div);
        });
      }
      renderEditablePills();
      $('wAnalysisResult').style.display = 'flex';
      $('wBtnNext2').disabled = false;
      retryBtn.style.display  = 'inline-flex';

    } catch (e) {
      // v0.9.224 — Re-auth admin requise (session > 60 min) : message clair + bouton logout
      if (e && typeof e.message === 'string' && e.message.includes('admin-reauth-required')) {
        statusEl.innerHTML =
          `<span style="color:var(--amber)">⚠ Re-connexion admin requise (session &gt;60 min).</span>` +
          ` <a href="#" id="adminReauthBtn" style="color:var(--accent-l);text-decoration:underline">Se déconnecter pour se reconnecter →</a>`;
        const lk = document.getElementById('adminReauthBtn');
        if (lk) lk.addEventListener('click', async (ev) => {
          ev.preventDefault();
          try {
            if (typeof Auth !== 'undefined' && Auth.signOut) await Auth.signOut();
            else if (typeof firebase !== 'undefined' && firebase.auth) await firebase.auth().signOut();
            location.reload();
          } catch (err) { console.warn('[admin reauth] signOut failed', err); location.reload(); }
        });
        $('wBtnNext2').disabled = false;
        retryBtn.style.display  = 'inline-flex';
        return;
      }
      statusEl.innerHTML = '';
      const _errSpan = document.createElement('span');
      _errSpan.style.color = 'var(--red)';
      _errSpan.textContent = '✗ ' + (e.message || i18n.t('modal.unknown.error'));
      statusEl.appendChild(_errSpan);
      $('wBtnNext2').disabled = false;
      retryBtn.style.display  = 'inline-flex';
    }
  }

  // ── Étape 3 : Calcul ────────────────────────────────────────────────────────
  const INSTR_CAT = {
    MES1:'Indices Micro', ES1:'Indices Full', MNQ1:'Indices Micro', NQ1:'Indices Full',
    MYM1:'Indices Micro', YM1:'Indices Full', M2K1:'Indices Micro', RTY1:'Indices Full',
    MGC1:'Métaux', GC1:'Métaux',
    MCL1:'Énergie', CL1:'Énergie', ZN1:'Taux',
    US500:'Indices CFD', US100:'Indices CFD', US30:'Indices CFD', GER40:'Indices CFD', UK100:'Indices CFD',
    XAUUSD:'Métaux CFD', EURUSD:'Forex', GBPUSD:'Forex', USDJPY:'Forex', USOIL:'Énergie CFD',
    // Crypto (v0.9.190)
    BTCUSDT:'Crypto perp', ETHUSDT:'Crypto perp', SOLUSDT:'Crypto perp', BNBUSDT:'Crypto perp', XRPUSDT:'Crypto perp',
    ADAUSDT:'Crypto perp', AVAXUSDT:'Crypto perp', DOGEUSDT:'Crypto perp', LINKUSDT:'Crypto perp', DOTUSDT:'Crypto perp',
    'BTC-USD':'Crypto spot', 'ETH-USD':'Crypto spot', 'SOL-USD':'Crypto spot', 'XRP-USD':'Crypto spot', 'AVAX-USD':'Crypto spot',
  };

  // v0.9.190 — Whitelists d'instruments par type de compte crypto
  const CRYPTO_INSTRS_BINANCE = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','AVAXUSDT','DOGEUSDT','LINKUSDT','DOTUSDT'];
  const CRYPTO_INSTRS_COINBASE = ['BTC-USD','ETH-USD','SOL-USD','XRP-USD','AVAX-USD'];

  function populateInstrumentSelect(fk, keepVal) {
    // v0.9.190 : si compte crypto sélectionné, lister les paires crypto
    const apexValue = $('wApex') ? $('wApex').value : '';
    const account = apexValue && Store.getAccountByName ? Store.getAccountByName(apexValue) : null;
    if (account && account.accountType === 'crypto') {
      const sel = $('wInstr');
      const cur = keepVal || sel.value || 'BTCUSDT';
      const list = account.cryptoPlatform === 'coinbase' ? CRYPTO_INSTRS_COINBASE : CRYPTO_INSTRS_BINANCE;
      sel.innerHTML = list.map(i => `<option value="${i}">${i}</option>`).join('');
      sel.value = list.includes(cur) ? cur : list[0];
      return;
    }

    const sp     = Store.getSpreadsByFirm(fk || 'apex');
    const instrs = Object.keys(sp).filter(i => VALID_INSTRS.has(i));
    const sel    = $('wInstr');
    const cur    = keepVal || sel.value || 'MES1';

    const groups = {};
    instrs.forEach(i => {
      const cat = INSTR_CAT[i] || 'Autres';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(i);
    });

    const cats = Object.keys(groups);
    sel.innerHTML = cats.map(cat =>
      cats.length > 1
        ? `<optgroup label="${cat}">${groups[cat].map(i => `<option value="${i}">${i}</option>`).join('')}</optgroup>`
        : groups[cat].map(i => `<option value="${i}">${i}</option>`).join('')
    ).join('');

    sel.value = [...sel.options].some(o => o.value === cur) ? cur : (sel.options[0]?.value || 'MES1');
  }

  function populateApexSelect(currentVal) {
    const accounts = Store.getMyAccounts();
    const grps     = Store.getGroups();
    const sel      = $('wApex');

    let html = `<option value="">${i18n.t('modal.account.ph')}</option>`;
    if (accounts.length) {
      html += accounts.map(a => {
        const badge = STATUS_LABEL[a.status] || '?';
        return `<option value="${esc(a.name)}"${a.name === currentVal ? ' selected' : ''}>[${badge}] ${esc(a.name)}</option>`;
      }).join('');
    }
    if (grps.length) {
      html += '<optgroup label="── Groupes (multi-comptes) ──">';
      html += grps.map(g => {
        const val = 'grp:' + g.id;
        // U27 : afficher le nombre de comptes du groupe pour clarifier l'impact
        const n = Array.isArray(g.accountIds) ? g.accountIds.length : 0;
        const suffix = n > 0 ? ` (${n} compte${n > 1 ? 's' : ''})` : '';
        return `<option value="${esc(val)}"${val === currentVal ? ' selected' : ''}>⬡ ${esc(g.name)}${suffix}</option>`;
      }).join('');
      html += '</optgroup>';
    }
    if (!accounts.length && !grps.length)
      html += `<option value="" disabled>${i18n.t('modal.configure.settings')}</option>`;
    sel.innerHTML = html;
    sel.value = currentVal || '';
  }

  function fillStep3FromParsed() {
    if (!parsedTrade) return;
    const instr = parsedTrade.instrument;
    if (instr && VALID_INSTRS.has(instr)) $('wInstr').value = instr;
    if (parsedTrade.contracts > 0) $('wContracts').value = parseFloat(parsedTrade.contracts);
    $('wEntry').value = parsedTrade.entry || '';
    $('wSL').value    = parsedTrade.sl    || '';
    $('wTP1').value   = parsedTrade.tp1   || '';
    $('wTP2').value   = parsedTrade.tp2   || '';
    $('wTP3').value   = parsedTrade.tp3   || '';
    spreadCost = getSpreadForInstrument(firmKey, $('wInstr').value);
    wRecalc();
  }

  function updateSpreadDisplay() {
    const el = document.getElementById('wSpreadInfo');
    if (!el) return;
    const unit = Calc.isCFD($('wInstr').value) ? 'lot' : 'contrat';
    el.textContent = spreadCost > 0 ? '$' + spreadCost.toFixed(2) + ' / ' + unit : '—';
  }

  function updateLotsInput(instr) {
    const inp = $('wContracts');
    if (Calc.isCFD(instr)) {
      inp.step = '0.01';
      inp.min  = '0.01';
    } else {
      inp.step = '1';
      inp.min  = '1';
      const v = parseFloat(inp.value) || 1;
      inp.value = Math.max(1, Math.round(v));
    }
  }

  function wRecalc() {
    const entry      = parseFloat($('wEntry').value);
    const sl         = parseFloat($('wSL').value);
    const tp1        = parseFloat($('wTP1').value);
    const contracts  = parseFloat($('wContracts').value) || 0.01;
    const instrument = $('wInstr').value;
    const lc         = $('wLiveCalc');

    // Prix de sortie : parseFloat retourne NaN si vide, on garde null si absent
    const rawExit = $('wExit').value.trim();
    const exitPrice = rawExit !== '' && !isNaN(parseFloat(rawExit)) ? parseFloat(rawExit) : null;
    // P&L manuel : prend le dessus sur tout calcul si rempli
    const rawManual = $('wManualPnl').value.trim();
    const manualPnl = rawManual !== '' && !isNaN(parseFloat(rawManual)) ? parseFloat(rawManual) : null;
    const hasExit = exitPrice !== null || manualPnl !== null;

    updateSpreadDisplay();
    if (!entry || !sl || !tp1) { lc.style.display = 'none'; return; }
    lc.style.display = 'flex';

    // Partial close — lu seulement si toggle activé ET 2 champs remplis
    const partialEnabled = $('wPartialEnable').checked;
    const rawPPct  = $('wPartialPercent').value.trim();
    const rawPPrice = $('wPartialPrice').value.trim();
    const partialPercent = partialEnabled && rawPPct  !== '' && !isNaN(parseFloat(rawPPct))  ? parseFloat(rawPPct)  : null;
    const partialPrice   = partialEnabled && rawPPrice !== '' && !isNaN(parseFloat(rawPPrice)) ? parseFloat(rawPPrice) : null;

    const c = Calc.trade({
      direction, entry, sl, tp1,
      instrument, contracts, capital,
      feePerSide, feeTakerPct, spreadCost,
      exitPrice, manualPnl,
      partialPercent, partialPrice,
    });

    // R:R théorique si pas de sortie, R réel si sortie
    const rrEl = $('lcRR');
    if (hasExit) {
      const actualR = c.riskUSD > 0 ? c.pnl / c.riskUSD : 0;
      rrEl.textContent = actualR.toFixed(2) + 'R réel';
      rrEl.style.color = c.pnl >= 0 ? 'var(--green)' : 'var(--red)';
    } else {
      rrEl.textContent = c.rr.toFixed(2) + 'R';
      rrEl.style.color = Calc.rrColor(c.rr);
    }

    $('lcRisk').textContent = '-$' + c.riskUSD.toFixed(0);

    // Reward ou P&L brut selon présence du prix de sortie
    const rewardEl    = $('lcReward');
    const rewardLabel = $('lcRewardLabel');
    if (hasExit) {
      rewardLabel.textContent = i18n.t('wiz.pnl.gross');
      rewardEl.textContent    = (c.pnl >= 0 ? '+' : '−') + '$' + Math.abs(c.pnl).toFixed(2);
      rewardEl.style.color    = c.pnl >= 0 ? 'var(--green)' : 'var(--red)';
    } else {
      rewardLabel.textContent = i18n.t('wiz.reward');
      rewardEl.textContent    = '+$' + c.rewardUSD.toFixed(0);
      rewardEl.style.color    = 'var(--green)';
    }

    const rpcEl = $('lcRiskPct');
    rpcEl.textContent = c.riskPct.toFixed(2) + '%';
    rpcEl.style.color = Calc.riskColor(c.riskPct);

    // v0.9.176 (M7 fix) : masquer la ligne "Frais A/R" si total = 0 (pas de spread sur cet instrument)
    const feesRow = $('lcFeesRow');
    if (c.totalFees > 0) {
      $('lcFees').textContent = '−$' + c.totalFees.toFixed(2);
      if (feesRow) feesRow.style.display = '';
    } else {
      if (feesRow) feesRow.style.display = 'none';
    }

    // Net reward ou P&L net selon présence du prix de sortie
    const netEl    = $('lcNet');
    const netLabel = $('lcNetLabel');
    if (hasExit) {
      netLabel.textContent = i18n.t('wiz.pnl.net');
      netEl.textContent    = (c.netPnl >= 0 ? '+' : '−') + '$' + Math.abs(c.netPnl).toFixed(2);
      netEl.style.color    = c.netPnl >= 0 ? 'var(--green)' : 'var(--red)';
    } else {
      netLabel.textContent = i18n.t('wiz.net.reward');
      netEl.textContent    = (c.netRewardUSD >= 0 ? '+' : '−') + '$' + Math.abs(c.netRewardUSD).toFixed(0);
      netEl.style.color    = c.netRewardUSD >= 0 ? 'var(--green)' : 'var(--red)';
    }

    const warnEl  = $('lcApexWarn');
    const account = Store.getMyAccountByName($('wApex').value);
    if (account) {
      warnEl.textContent   = i18n.t('modal.warn.daily', { name: account.name });
      warnEl.style.display = c.riskUSD > account.dailyLossLimit ? 'inline' : 'none';
    } else {
      warnEl.textContent   = i18n.t('modal.warn.apex');
      warnEl.style.display = c.riskPct > 2 ? 'inline' : 'none';
    }
  }

  // ── Screenshot persistant (Firebase Storage) ────────────────────────────────
  // Compresse une image en JPEG (max dimension + quality) pour rester sous 2 MB.
  // Retourne un Blob JPEG prêt à upload.
  async function compressImage(blobOrFile, maxDim = 1920, quality = 0.85) {
    const img = await new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blobOrFile);
      const i = new Image();
      i.onload  = () => { URL.revokeObjectURL(url); resolve(i); };
      i.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image illisible')); };
      i.src = url;
    });
    let w = img.naturalWidth, h = img.naturalHeight;
    if (w > maxDim || h > maxDim) {
      const r = Math.min(maxDim / w, maxDim / h);
      w = Math.round(w * r); h = Math.round(h * r);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    let q = quality;
    let blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', q));
    // Si toujours > 2 MB, on baisse la qualité jusqu'à passer (ou min 0.4)
    while (blob && blob.size > 2 * 1024 * 1024 && q > 0.4) {
      q -= 0.1;
      blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', q));
    }
    if (!blob) throw new Error('Compression échouée');
    if (blob.size > 2 * 1024 * 1024) throw new Error('Image trop lourde même après compression');
    return blob;
  }

  function setShotPreview(srcUrl) {
    $('wShotPlaceholder').style.display = 'none';
    $('wShotPreview').style.display     = '';
    $('wShotImg').src                   = srcUrl;
  }
  function clearShotPreview() {
    $('wShotPlaceholder').style.display = '';
    $('wShotPreview').style.display     = 'none';
    $('wShotImg').src                   = '';
    $('wShotStatus').textContent        = '';
  }

  // Reset complet du state screenshot
  function resetShotState() {
    shotBlob          = null;
    shotExistingPath  = null;
    shotPendingDelete = false;
    clearShotPreview();
  }

  // Tracking de l'objectURL courant pour le révoquer avant remplacement
  let _shotPreviewUrl = null;
  // Q49 : token incrémental pour cancel les compressions concurrentes.
  // Si le user paste rapidement, seul le DERNIER paste doit gagner — les
  // précédents sont jetés silencieusement (et leur status n'écrase plus l'UI).
  let _shotCompressionToken = 0;

  async function handleShotFromBlob(rawBlob) {
    const myToken = ++_shotCompressionToken;
    const status = $('wShotStatus');
    // Garde-fou taille avant tout (anti-DoS décodage d'un fichier énorme)
    if (rawBlob.size > 10 * 1024 * 1024) {
      if (myToken !== _shotCompressionToken) return;
      status.style.color = 'var(--red)';
      status.textContent = 'Fichier trop lourd (max 10 MB avant compression)';
      return;
    }
    // Validation magic bytes (anti MIME-spoofing — un PDF ne passera pas)
    try {
      const head = new Uint8Array(await rawBlob.slice(0, 12).arrayBuffer());
      if (myToken !== _shotCompressionToken) return;  // abandonné par paste plus récent
      if (!isValidImageMagicBytes(head)) {
        status.style.color = 'var(--red)';
        status.textContent = 'Fichier invalide — utilise un PNG/JPG/WEBP/GIF';
        return;
      }
    } catch {
      if (myToken !== _shotCompressionToken) return;
      status.style.color = 'var(--red)';
      status.textContent = 'Image illisible';
      return;
    }
    status.style.color = 'var(--muted)';
    status.textContent = 'Compression en cours…';
    try {
      const compressed = await compressImage(rawBlob);
      if (myToken !== _shotCompressionToken) {
        // Un paste plus récent a démarré — on jette ce résultat
        return;
      }
      shotBlob = compressed;
      shotPendingDelete = false;
      // Révoque l'ancien objectURL (anti memory leak si paste/replace en boucle)
      if (_shotPreviewUrl) { try { URL.revokeObjectURL(_shotPreviewUrl); } catch {} }
      _shotPreviewUrl = URL.createObjectURL(compressed);
      setShotPreview(_shotPreviewUrl);
      const kb = Math.round(compressed.size / 1024);
      // v0.9.176 (M6 fix) : checkmark + couleur appuyée pour feedback fort.
      status.style.color    = 'var(--green)';
      status.style.fontWeight = '600';
      status.textContent    = `✓ Screenshot prêt (${kb} KB) — sera enregistré au save`;
    } catch (e) {
      if (myToken !== _shotCompressionToken) return;
      status.style.color = 'var(--red)';
      status.textContent = e.message || 'Erreur lors du traitement de l\'image';
      shotBlob = null;
    }
  }

  // Charge l'image existante d'un trade depuis Firebase Storage (mode édition).
  async function loadExistingShot(path) {
    if (!path) return;
    shotExistingPath = path;
    $('wShotStatus').textContent = 'Chargement du screenshot…';
    try {
      const url = await Store.getTradeScreenshotUrl(path);
      if (url) {
        setShotPreview(url);
        $('wShotStatus').textContent = '';
      } else {
        $('wShotStatus').style.color = 'var(--red)';
        $('wShotStatus').textContent = 'Screenshot introuvable (peut-être supprimé).';
      }
    } catch (e) {
      $('wShotStatus').style.color = 'var(--red)';
      $('wShotStatus').textContent = 'Impossible de charger le screenshot.';
    }
  }

  // ── Open / Close ────────────────────────────────────────────────────────────
  function open(id = null, savedCallback = null) {
    editingId = id;
    onSaved   = savedCallback;

    // Reset
    capturedImage = null;
    parsedTrade   = null;
    capital       = Store.getSettings().capital || 50000;
    feePerSide    = 2.14;
    spreadCost    = 0;
    firmKey       = 'apex';

    // Reset state screenshot + pré-génère un ID trade en mode création
    resetShotState();
    pendingTradeId = id ? null : Store.newTradeId();

    // Reset partial close
    $('wPartialEnable').checked   = false;
    $('wPartialFields').style.display = 'none';
    $('wPartialPercent').value    = '';
    $('wPartialPrice').value      = '';

    clearImage();
    $('wOptFields').style.display  = '';
    $('wOptToggle').textContent    = i18n.t('wiz.setup.close');
    $('wExitField').style.display  = 'none';
    $('wOutcome').value            = 'open';
    $('wSetup').value              = '';
    $('wNotes').value              = '';
    $('wExit').value               = '';
    $('wManualPnl').value          = '';
    $('wContracts').value          = Store.getSettings().contracts || 1;
    // Date + heure par défaut = maintenant (heure locale)
    const nowLocal = new Date();
    $('wTradeDate').value = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth()+1).padStart(2,'0')}-${String(nowLocal.getDate()).padStart(2,'0')}`;
    $('wTradeTime').value = `${String(nowLocal.getHours()).padStart(2,'0')}:${String(nowLocal.getMinutes()).padStart(2,'0')}`;

    if (id) {
      // Mode édition : remplir depuis le trade existant et aller à l'étape 3
      const t = Store.getTradeById(id);
      if (!t) { close(); return; }
      direction    = t.direction;
      parsedTrade  = { entry: t.entry, sl: t.sl, tp1: t.tp1, tp2: t.tp2, tp3: t.tp3, instrument: t.instrument };
      capital      = t.capital || capital;
      feePerSide   = (t.feePerSide != null) ? t.feePerSide : 2.14;
      spreadCost   = t.spreadCost != null ? t.spreadCost : (Store.getSpreads()[t.instrument] || 0);

      $('wContracts').value  = t.contracts;
      $('wSetup').value      = t.setup  || '';
      $('wNotes').value      = t.notes  || '';
      $('wOutcome').value    = t.outcome;
      $('wExit').value       = t.exitPrice || '';
      $('wManualPnl').value  = t.manualPnl != null ? t.manualPnl : '';
      // Partial close
      if (t.partialPercent != null && t.partialPrice != null) {
        $('wPartialEnable').checked        = true;
        $('wPartialFields').style.display  = '';
        $('wPartialPercent').value         = t.partialPercent;
        $('wPartialPrice').value           = t.partialPrice;
      }
      // Pré-remplir la date + heure depuis le trade existant
      const td = t.date ? t.date.slice(0, 10) : $('wTradeDate').value;
      const tt = t.date && t.date.length > 10 ? t.date.slice(11, 16) : '';
      $('wTradeDate').value  = td;
      $('wTradeTime').value  = tt;
      $('wExitField').style.display = t.outcome !== 'open' ? '' : 'none';

      // Badge direction
      const badge = $('wDirBadge');
      badge.textContent      = direction === 'long' ? 'LONG' : 'SHORT';
      badge.style.color      = direction === 'long' ? 'var(--green)' : 'var(--red)';
      badge.style.background = direction === 'long' ? 'var(--green-dim)' : 'var(--red-dim)';

      populateApexSelect(t.apex || '');
      const acc = Store.getMyAccountByName(t.apex || '');
      if (acc) {
        capital = acc.capital + (acc.pnlOffset || 0);
        firmKey = acc.firmKey || 'apex';
        // Préserver feePerSide HISTORIQUE du trade : ne pas écraser avec la
        // valeur actuelle du compte (sinon les anciens trades changent de P&L
        // si l'utilisateur modifie les fees). Fallback sur compte si pas stocké.
        feePerSide = (t.feePerSide != null) ? t.feePerSide : ((acc.feePerSide != null ? acc.feePerSide : 2.14));
      }
      populateInstrumentSelect(firmKey, t.instrument);
      updateLotsInput(t.instrument);
      fillStep3FromParsed();
      // Charge le screenshot existant (async, non bloquant)
      if (t.screenshotPath) loadExistingShot(t.screenshotPath);
      goToStep(3);
    } else {
      // Mode création : étape 1
      $('wBtnLong').className  = 'dir-btn';
      $('wBtnShort').className = 'dir-btn';
      const accounts = Store.getMyAccounts();
      // U31 : essaie de pré-sélectionner le dernier compte utilisé (validé strict
      // dans Store.getLastWizardPrefs : compte/groupe doit toujours exister)
      const prefs = Store.getLastWizardPrefs ? Store.getLastWizardPrefs() : null;
      let preferredAcc = null;
      if (prefs && prefs.apex && !prefs.apex.startsWith('grp:')) {
        preferredAcc = accounts.find(a => a.name === prefs.apex) || null;
      }
      const defaultAcc = preferredAcc || accounts[0] || null;
      // Pour les groupes, on respecte la pref si elle est valide (validation déjà
      // faite dans Store.getLastWizardPrefs contre la liste des groupes actuels)
      const preferredApexValue = prefs && prefs.apex && prefs.apex.startsWith('grp:')
        ? prefs.apex
        : (defaultAcc ? defaultAcc.name : '');
      populateApexSelect(preferredApexValue);
      if (defaultAcc) {
        capital     = defaultAcc.capital;
        feePerSide  = (defaultAcc.feePerSide != null) ? defaultAcc.feePerSide : 2.14;
        firmKey     = defaultAcc.firmKey || 'apex';
        // v0.9.190 : si compte crypto, charger feeTakerPct pour le calc
        feeTakerPct = defaultAcc.accountType === 'crypto'
          ? (defaultAcc.feeTakerPct != null ? defaultAcc.feeTakerPct : 0.05)
          : null;
      }
      // Mémorise aussi l'instrument préféré pour pré-sélection plus tard
      // (au moment où populateInstrumentSelect sera appelé après step 2)
      if (prefs && prefs.instrument) {
        // On stocke temporairement dans parsedTrade pour que fillStep3FromParsed
        // pré-sélectionne ce instrument si l'IA n'en renvoie pas un
        parsedTrade = parsedTrade || {};
        if (!parsedTrade.instrument) parsedTrade.instrument = prefs.instrument;
      }
      goToStep(1);
    }

    $('modalOverlay').classList.add('open');
  }

  function close() {
    $('modalOverlay').classList.remove('open');
    editingId     = null;
    capturedImage = null;
    parsedTrade   = null;
    // Révoque l'objectURL du preview screenshot (anti-leak mémoire)
    if (_shotPreviewUrl) { try { URL.revokeObjectURL(_shotPreviewUrl); } catch {} _shotPreviewUrl = null; }
  }

  // ── Save ────────────────────────────────────────────────────────────────────
  const VALID_OUTCOMES  = new Set(['win', 'loss', 'be', 'open']);
  const VALID_INSTRS    = new Set(['MES1','ES1','MNQ1','NQ1','MYM1','YM1','M2K1','RTY1','MGC1','GC1','QO1','MCL1','CL1','ZN1',
                                    'US500','US100','US30','GER40','UK100','XAUUSD','EURUSD','GBPUSD','USDJPY','USOIL',
                                    // Crypto (v0.9.190)
                                    'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','AVAXUSDT','DOGEUSDT','LINKUSDT','DOTUSDT',
                                    'BTC-USD','ETH-USD','SOL-USD','XRP-USD','AVAX-USD']);

  let _saveInFlight = false;
  async function save() {
    if (_saveInFlight) return;
    const entry = parseFloat($('wEntry').value);
    const sl    = parseFloat($('wSL').value);
    const tp1   = parseFloat($('wTP1').value);
    if (!entry || !sl || !tp1) { UI.toast(i18n.t('modal.required'), true); return; }
    const apexValueRaw = $('wApex').value;
    if (!apexValueRaw)         { UI.toast(i18n.t('err.no.account.sel'), true); return; }
    // v0.9.179 (M8 fix) : bloquer save si l'user a sélectionné un groupe VIDE
    // (groupe sans aucun compte associé → la boucle save crash silencieusement)
    if (apexValueRaw.startsWith('grp:')) {
      const grpId = apexValueRaw.slice(4);
      const grp   = Store.getGroups().find(g => g.id === grpId);
      if (!grp || !Array.isArray(grp.accountIds) || grp.accountIds.length === 0) {
        UI.toast('Le groupe sélectionné est vide. Ajoute au moins un compte dans Réglages → Groupes.', true);
        return;
      }
    }
    _saveInFlight = true;
    const saveBtn = $('wBtnSave');
    const saveBtnOriginalText = saveBtn ? saveBtn.textContent : '';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = i18n.t('wiz.saving') || 'Enregistrement…';
    }

    const rawInstr   = $('wInstr').value;
    const rawOutcome = $('wOutcome').value;
    const safeDir    = direction === 'long' ? 'long' : 'short';
    const safeOutcome = VALID_OUTCOMES.has(rawOutcome) ? rawOutcome : 'open';
    const safeInstr   = VALID_INSTRS.has(rawInstr) ? rawInstr : 'MES1';

    const dateVal = $('wTradeDate').value;
    const timeVal = $('wTradeTime').value;
    const dateStr = dateVal ? (timeVal ? `${dateVal}T${timeVal}:00` : dateVal) : undefined;

    const data = {
      instrument: safeInstr,
      direction:  safeDir,
      date:       dateStr,
      contracts:  Math.max(0.01, Math.min(999, parseFloat($('wContracts').value) || 0.01)),
      capital,
      apex:       $('wApex').value,
      feePerSide,
      feeTakerPct,  // v0.9.190 : pour crypto, sinon null
      spreadCost,
      entry, sl, tp1,
      tp2:        parseFloat($('wTP2').value)  || null,
      tp3:        parseFloat($('wTP3').value)  || null,
      setup:      $('wSetup').value.trim().slice(0, 500),
      notes:      $('wNotes').value.trim().slice(0, 2000),
      outcome:    safeOutcome,
      exitPrice:  parseFloat($('wExit').value) || null,
      manualPnl:  $('wManualPnl').value.trim() !== '' && !isNaN(parseFloat($('wManualPnl').value))
                    ? parseFloat($('wManualPnl').value)
                    : null,
      // Partial close : seulement si checkbox cochée ET valeurs strictement valides
      // (1 < % < 100, sinon ça n'a aucun sens — 100% = sortie complète = utiliser exitPrice)
      partialPercent: (() => {
        if (!$('wPartialEnable').checked) return null;
        const p = parseFloat($('wPartialPercent').value);
        const v = parseFloat($('wPartialPrice').value);
        if (isNaN(p) || isNaN(v) || p <= 0 || p >= 100) return null;
        return p;
      })(),
      partialPrice: (() => {
        if (!$('wPartialEnable').checked) return null;
        const p = parseFloat($('wPartialPercent').value);
        const v = parseFloat($('wPartialPrice').value);
        if (isNaN(p) || isNaN(v) || p <= 0 || p >= 100) return null;
        return v;
      })(),
    };

    try {
      let saved;
      if (editingId) {
        // Gestion screenshot mode édition
        const finalData = { ...data };
        if (shotPendingDelete && shotExistingPath) {
          // User a explicitement supprimé → on retire screenshotPath et on delete le fichier
          finalData.screenshotPath = null;
          Store.deleteTradeScreenshot(shotExistingPath).catch(() => null);
        } else if (shotBlob) {
          // Nouveau screenshot (paste/replace) → upload puis attache le path
          try {
            const path = await Store.uploadTradeScreenshot(editingId, shotBlob);
            finalData.screenshotPath = path;
            // Si on remplace un screenshot existant à un path différent, on supprime l'ancien
            if (shotExistingPath && shotExistingPath !== path) {
              Store.deleteTradeScreenshot(shotExistingPath).catch(() => null);
            }
          } catch (e) {
            UI.toast('Upload screenshot échoué : ' + (e.message || 'erreur'), true);
            return;  // ne pas sauver le trade si l'upload a échoué
          }
        } else if (shotExistingPath) {
          // Aucun changement : conserver le path existant
          finalData.screenshotPath = shotExistingPath;
        }
        saved = Store.updateTrade(editingId, finalData);
        UI.toast(i18n.t('modal.trade.updated'));
      } else if (data.apex && data.apex.startsWith('grp:')) {
        // Sauvegarde sur tous les comptes du groupe (pas de screenshot en mode groupe)
        // BATCH : 1 seul write Firestore au lieu de N (perf + coût)
        const groupId = data.apex.slice(4);
        const grp     = Store.getGroupById(groupId);
        if (grp && grp.accountIds && grp.accountIds.length) {
          const tradesToCreate = grp.accountIds.map(accId => {
            const acc = Store.getMyAccountById(accId);
            if (!acc) return null;
            return {
              ...data,
              apex:       acc.name,
              capital:    acc.capital,
              feePerSide: (acc.feePerSide != null ? acc.feePerSide : 2.14),
              spreadCost: Store.getSpreadsByFirm(acc.firmKey || 'apex')[data.instrument] || 0,
              groupId,
            };
          }).filter(Boolean);
          const trades = Store.addTradesBatch(tradesToCreate);
          saved = trades[0];
          UI.toast(i18n.t('modal.trade.group', { n: trades.length, name: grp.name }));
        } else {
          UI.toast(i18n.t('modal.group.empty'), true);
          return;
        }
      } else {
        // Mode création : utilise pendingTradeId pour upload AVANT addTrade
        let screenshotPath = null;
        if (shotBlob && pendingTradeId) {
          try {
            screenshotPath = await Store.uploadTradeScreenshot(pendingTradeId, shotBlob);
          } catch (e) {
            UI.toast('Upload screenshot échoué : ' + (e.message || 'erreur'), true);
            return;
          }
        }
        const dataWithId = { ...data, id: pendingTradeId };
        if (screenshotPath) dataWithId.screenshotPath = screenshotPath;
        saved = Store.addTrade(dataWithId);
        UI.toast(i18n.t('modal.trade.saved'));
      }
      // U31 : mémorise le dernier compte/groupe + instrument pour pré-sélection
      // au prochain wizard (mode création uniquement, pas en édition)
      if (!editingId && Store.setLastWizardPrefs) {
        Store.setLastWizardPrefs({
          apex:       data.apex,
          instrument: data.instrument,
        });
      }
      close();
      if (onSaved) onSaved(saved);
    } finally {
      _saveInFlight = false;
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = saveBtnOriginalText;
      }
    }
  }

  // ── Init ────────────────────────────────────────────────────────────────────
  function init() {
    // Step 1
    $('wBtnLong').addEventListener('click',  () => setDirection('long'));
    $('wBtnShort').addEventListener('click', () => setDirection('short'));

    // Step 2 — v0.9.179 (H2 fix) : confirmer si analyse IA déjà effectuée
    // ou image chargée (sinon retour silencieux qui détruit l'image)
    // v0.9.221 (bug fix) : si l'user confirme, on RESET réellement tout (image,
    // analyse, pills affichées, hint texte). Avant, parsedTrade restait en mémoire
    // et ré-apparaissait après changement de direction LONG ↔ SHORT.
    $('wBtnBack1').addEventListener('click', () => {
      const hasWork = !!parsedTrade || !!capturedImage;
      if (hasWork) {
        if (!confirm('Revenir à l\'étape précédente va effacer ton screenshot et l\'analyse IA. Continuer ?')) {
          return;
        }
        clearImage();
        const hint = $('wTextHint');
        if (hint) hint.value = '';
        if (_shotPreviewUrl) { try { URL.revokeObjectURL(_shotPreviewUrl); } catch {} _shotPreviewUrl = null; }
        shotBlob = null;
      }
      goToStep(1);
    });
    // v0.9.223 — "Réanalyser" force Claude direct (skip Groq) si tier le permet.
    // Trader → relance Groq (pas accès Claude). Funded/Elite/Beta → Claude direct.
    $('wBtnRetry').addEventListener('click', () => {
      if (_canUseClaudeFallback()) _forceClaude = true;
      analyzeImage();
    });
    $('wTextHint').addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); analyzeImage(); }
    });
    $('wBtnNext2').addEventListener('click', () => {
      if (!parsedTrade) {
        const hint = ($('wTextHint').value || '').trim();
        if (hint) parsedTrade = parseTextHint(hint);
      }
      if (parsedTrade) fillStep3FromParsed();
      populateInstrumentSelect(firmKey, parsedTrade?.instrument);
      // v0.9.176 (H3 fix) : préserver le compte déjà pré-sélectionné au step 1
      // (lecture du select courant avant re-render). Évite de re-demander à l'user
      // de choisir son compte 50x par jour quand il est déjà sélectionné par défaut.
      populateApexSelect($('wApex').value || '');
      goToStep(3);
      $('wContracts').focus();
    });

    $('wDropZone').addEventListener('click', e => {
      if (e.target === $('wBtnClearImg') || $('wBtnClearImg').contains(e.target)) return;
      $('wImageFile').click();
    });
    $('wBtnClearImg').addEventListener('click', e => { e.stopPropagation(); clearImage(); });
    $('wImageFile').addEventListener('change', e => {
      const file = e.target.files && e.target.files[0];
      if (file) { loadImageFile(file); e.target.value = ''; }
    });

    // Drag-and-drop
    $('wDropZone').addEventListener('dragover', e => {
      e.preventDefault();
      $('wDropZone').classList.add('dz-dragover');
    });
    $('wDropZone').addEventListener('dragleave', e => {
      if (!$('wDropZone').contains(e.relatedTarget))
        $('wDropZone').classList.remove('dz-dragover');
    });
    $('wDropZone').addEventListener('drop', e => {
      e.preventDefault();
      $('wDropZone').classList.remove('dz-dragover');
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) loadImageFile(file);
    });

    // Q44 : UN SEUL handler paste global qui route selon le step actif.
    // (Avant : 2 handlers document distincts → double déclenchement potentiel.)
    document.addEventListener('paste', e => {
      if (!$('modalOverlay').classList.contains('open')) return;
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;

      const onStep2 = $('wp2') && $('wp2').style.display !== 'none';
      const onStep3 = $('wp3') && $('wp3').style.display !== 'none';
      if (!onStep2 && !onStep3) return;

      // Trouve la première image dans le clipboard
      let imgFile = null;
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          imgFile = item.getAsFile();
          break;
        }
      }
      if (!imgFile) return;

      // Step 2 : analyse IA (loadImageFile)
      if (onStep2) {
        e.preventDefault();
        loadImageFile(imgFile);
        return;
      }

      // Step 3 : screenshot persistant (handleShotFromBlob)
      // Mais si l'user paste dans un input/textarea texte, on laisse passer
      // SAUF si la clipboard ne contient QUE de l'image (alors on capture)
      if (onStep3) {
        const active = document.activeElement;
        const inText = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
        // Si focus dans un text input ET clipboard a aussi du texte → laisser passer
        if (inText) {
          const hasText = Array.from(items).some(it => it.kind === 'string');
          if (hasText) return;
        }
        e.preventDefault();
        handleShotFromBlob(imgFile);
      }
    });

    // Step 3
    $('wBtnBack2').addEventListener('click', () => goToStep(2));
    $('wBtnSave').addEventListener('click',  save);

    // Toggle sortie partielle
    $('wPartialEnable').addEventListener('change', e => {
      $('wPartialFields').style.display = e.target.checked ? '' : 'none';
      if (!e.target.checked) {
        $('wPartialPercent').value = '';
        $('wPartialPrice').value   = '';
      }
      wRecalc();
    });
    $('wPartialPercent').addEventListener('input', () => wRecalc());
    $('wPartialPrice').addEventListener('input',   () => wRecalc());

    // Zone screenshot persistant (drag&drop, click pour file picker)
    // Note : le paste Ctrl+V est géré par le handler unifié plus haut (Q44).
    const shotZone = $('wShotZone');
    if (shotZone) {
      // Click sur la zone (placeholder visible) → ouvre file picker
      $('wShotFileLink').addEventListener('click', e => {
        e.preventDefault();
        $('wShotFile').click();
      });
      $('wShotFile').addEventListener('change', e => {
        const file = e.target.files && e.target.files[0];
        if (file) handleShotFromBlob(file);
        e.target.value = ''; // reset pour permettre re-sélection même fichier
      });
      // Drag & drop
      shotZone.addEventListener('dragover', e => {
        e.preventDefault();
        shotZone.style.borderColor = 'var(--purple-l)';
        shotZone.style.background  = 'rgba(124,58,237,0.05)';
      });
      shotZone.addEventListener('dragleave', () => {
        shotZone.style.borderColor = '';
        shotZone.style.background  = '';
      });
      shotZone.addEventListener('drop', e => {
        e.preventDefault();
        shotZone.style.borderColor = '';
        shotZone.style.background  = '';
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) handleShotFromBlob(file);
      });
      // Replace / Delete
      $('wShotReplace').addEventListener('click', e => {
        e.stopPropagation();
        $('wShotFile').click();
      });
      $('wShotDelete').addEventListener('click', e => {
        e.stopPropagation();
        // Si on édite un trade qui a déjà un screenshot, on marque pending delete
        if (shotExistingPath && !shotBlob) shotPendingDelete = true;
        shotBlob = null;
        clearShotPreview();
        $('wShotStatus').style.color = 'var(--muted)';
        $('wShotStatus').textContent = shotPendingDelete ? 'Sera supprimé au save' : '';
      });
    }

    $('wInstr').addEventListener('change', () => {
      spreadCost = getSpreadForInstrument(firmKey, $('wInstr').value);
      updateLotsInput($('wInstr').value);
      updateSpreadDisplay();
      wRecalc();
    });

    $('wApex').addEventListener('change', () => {
      const val = $('wApex').value;
      // U27 : afficher un hint visible quand un groupe est sélectionné
      // (rappel à l'user que ça va créer N trades, pas 1)
      updateGroupHint(val);
      if (val.startsWith('grp:')) {
        // Groupe : on prend le premier compte du groupe pour le calcul
        const grp     = Store.getGroupById(val.slice(4));
        const firstAcc = grp && grp.accountIds && grp.accountIds.length
          ? Store.getMyAccountById(grp.accountIds[0]) : null;
        capital     = firstAcc ? firstAcc.capital + (firstAcc.pnlOffset || 0) : (Store.getSettings().capital || 50000);
        feePerSide  = (firstAcc && firstAcc.feePerSide != null) ? firstAcc.feePerSide : 2.14;
        firmKey     = firstAcc?.firmKey || 'apex';
        feeTakerPct = firstAcc && firstAcc.accountType === 'crypto'
          ? (firstAcc.feeTakerPct != null ? firstAcc.feeTakerPct : 0.05)
          : null;
        if (firstAcc) $('wContracts').max = firstAcc.maxContracts;
      } else {
        const acc = Store.getMyAccountByName(val);
        if (acc) {
          capital              = acc.capital + (acc.pnlOffset || 0);
          feePerSide           = (acc.feePerSide != null ? acc.feePerSide : 2.14);
          firmKey              = acc.firmKey || 'apex';
          feeTakerPct          = acc.accountType === 'crypto'
            ? (acc.feeTakerPct != null ? acc.feeTakerPct : 0.05)
            : null;
          $('wContracts').max  = acc.maxContracts;
          // v0.9.190 : refresh instruments select pour montrer paires crypto si compte crypto
          if (acc.accountType === 'crypto') {
            populateInstrumentSelect(firmKey, $('wInstr').value);
          }
        } else {
          capital     = Store.getSettings().capital || 50000;
          feePerSide  = 2.14;
          firmKey     = 'apex';
          feeTakerPct = null;
        }
      }
      populateInstrumentSelect(firmKey);
      spreadCost = getSpreadForInstrument(firmKey, $('wInstr').value);
      updateLotsInput($('wInstr').value);
      wRecalc();
    });

    // U27 : hint qui affiche "→ Crée N trades (1 par compte du groupe)" si groupe sélectionné
    function updateGroupHint(apexValue) {
      let hint = $('wGroupHint');
      // Crée l'élément hint s'il n'existe pas (injection lazy)
      if (!hint) {
        const apexSelect = $('wApex');
        if (!apexSelect || !apexSelect.parentElement) return;
        hint = document.createElement('div');
        hint.id = 'wGroupHint';
        hint.className = 'wiz-group-hint';
        hint.style.cssText = 'display:none;font-size:11px;color:var(--accent);margin-top:4px;line-height:1.4';
        apexSelect.parentElement.appendChild(hint);
      }
      if (apexValue && apexValue.startsWith('grp:')) {
        const grp = Store.getGroupById(apexValue.slice(4));
        const n = grp && Array.isArray(grp.accountIds) ? grp.accountIds.length : 0;
        if (n > 0) {
          // Texte safe : esc le nom du groupe (peut venir de user-controlled)
          const gName = grp && grp.name ? String(grp.name).replace(/[<>"'&]/g, c => ({
            '<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','&':'&amp;'
          })[c]) : '';
          hint.innerHTML = `⬡ Ce groupe va créer <strong>${n} trade${n>1?'s':''}</strong> (1 par compte de « ${gName} »)`;
          hint.style.display = '';
        } else {
          hint.innerHTML = '⚠ Ce groupe est vide — aucun trade ne sera créé';
          hint.style.color = 'var(--red)';
          hint.style.display = '';
        }
      } else {
        hint.style.display = 'none';
      }
    }
    // Init hint à l'open si un groupe est déjà pré-sélectionné (mode édition ou U31 pref)
    const initialApex = $('wApex').value;
    if (initialApex && initialApex.startsWith('grp:')) updateGroupHint(initialApex);

    // v0.9.179 (M4 fix) : debounce 80ms sur input pour éviter recalc à chaque keystroke.
    // `change` (blur) reste immédiat pour feedback synchrone.
    let _wRecalcTimer = null;
    const wRecalcDebounced = () => {
      if (_wRecalcTimer) clearTimeout(_wRecalcTimer);
      _wRecalcTimer = setTimeout(() => { _wRecalcTimer = null; wRecalc(); }, 80);
    };
    ['wContracts', 'wEntry', 'wSL', 'wTP1', 'wExit', 'wManualPnl'].forEach(id => {
      $(id).addEventListener('input',  wRecalcDebounced);
      $(id).addEventListener('change', wRecalc);
    });

    $('wOutcome').addEventListener('change', () => {
      const outcome = $('wOutcome').value;
      $('wExitField').style.display = outcome === 'open' ? 'none' : '';
      if (outcome === 'open') {
        $('wExit').value = '';
      } else if (outcome === 'win') {
        $('wExit').value = $('wTP1').value || '';
      } else if (outcome === 'loss') {
        $('wExit').value = $('wSL').value || '';
      } else if (outcome === 'be') {
        $('wExit').value = '';
      }
      wRecalc();
    });

    $('wOptToggle').addEventListener('click', () => {
      const open = $('wOptFields').style.display !== 'none';
      $('wOptFields').style.display = open ? 'none' : '';
      $('wOptToggle').textContent   = open ? i18n.t('wiz.setup') : i18n.t('wiz.setup.close');
    });

    // Fermeture
    $('btnWizClose').addEventListener('click', close);
    $('modalOverlay').addEventListener('click', e => {
      if (e.target === $('modalOverlay')) close();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') close();
    });
  }

  return { init, open, close };
})();
