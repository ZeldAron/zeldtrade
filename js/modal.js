// ─── MODAL / WIZARD ───────────────────────────────────────────────────────────
// Wizard 3 étapes : Direction → Screenshot (IA) → Détails + calcul

const Modal = (() => {
  let editingId     = null;
  let onSaved       = null;
  let direction     = null;    // 'long' | 'short'
  let capturedImage = null;    // base64
  let _analysisFile = null;    // v0.9.290 : blob original de l'image d'analyse → seed slot 0 du trade
  let parsedTrade   = null;    // { entry, sl, tp1, tp2, tp3, instrument }
  let _forceClaude  = false;   // v0.9.223 — set par "Réanalyser" pour forcer Claude direct
  let capital       = 50000;
  let feePerSide    = 2.14;
  let feeTakerPct   = null;  // v0.9.190 : null = trade non-crypto, sinon % (ex: 0.05)
  let spreadCost    = 0;
  let firmKey       = 'apex';
  // v0.9.395 : filtre d'affichage de la liste d'instruments. true (défaut) →
  // « Mes instruments » (favInstruments) ; false → TOUS les instruments.
  let _instrFavOnly = true;

  // Screenshot du trade (persistant — Firebase Storage)
  // shotBlob : Blob compressé en mémoire au paste, uploadé au save (slot 0)
  // shotExistingPath : path Storage si on édite un trade qui a déjà un screenshot (slot 0)
  // shotPendingDelete : true si user a cliqué Supprimer sur un screenshot existant (slot 0)
  let shotBlob          = null;
  let shotExistingPath  = null;
  let shotPendingDelete = false;
  // v0.9.246 : slots additionnels 1 et 2 (Pro only). Même API que slot 0
  // mais sans paste handler (le slot 0 reste le slot "Ctrl+V" primaire).
  // Chaque entrée : { blob: Blob|null, existingPath: string|null, pendingDelete: bool, previewUrl: string|null }
  let shotsExtra = [
    { blob: null, existingPath: null, pendingDelete: false, previewUrl: null },
    { blob: null, existingPath: null, pendingDelete: false, previewUrl: null },
  ];
  // Pré-génère un ID trade pour le mode création (utile pour upload Storage avant save)
  let pendingTradeId    = null;

  function getSpreadForInstrument(fk, instr) {
    const sp = Store.getSpreadsByFirm(fk || 'apex');
    return sp[instr] != null ? sp[instr] : 0;
  }

  // v0.9.358 (fix B-12) : grise le bouton « Analyser cette capture » quand le quota
  // du jour est épuisé (sinon l'user clique un CTA violet plein pour rien).
  function _refreshAnalyzeBtnState() {
    const ab = document.getElementById('wBtnAnalyze');
    if (!ab) return;
    const exhausted = typeof Store !== 'undefined' && Store.canAnalyzeToday && !Store.canAnalyzeToday();
    ab.disabled        = !!exhausted;
    ab.style.opacity   = exhausted ? '0.45' : '';
    ab.style.cursor    = exhausted ? 'not-allowed' : '';
    ab.title           = exhausted ? (i18n.t('err.limit.ai') || 'Quota du jour épuisé — réessaie demain.') : '';
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
    const aiBadge = $('aiStatusBadge');
    if (aiBadge) {
      // v0.9.357 : la pastille reflète le quota du jour (vert = dispo, rouge = épuisé).
      if (typeof Store !== 'undefined' && Store.canAnalyzeToday && !Store.canAnalyzeToday()) {
        aiBadge.textContent = i18n.t('modal.ai.exhausted');
        aiBadge.style.color = 'var(--red)';
      } else {
        aiBadge.textContent = i18n.t('modal.ai.active');
        aiBadge.style.color = 'var(--green)';
      }
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
        UI.toast('Format non reconnu — utilise PNG, JPG, GIF, WEBP ou BMP.', true);
        return;
      }
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const b64 = ev.target.result.split(',')[1];
          capturedImage = b64;
          _analysisFile = file;  // v0.9.290 : conservé pour seed le slot 0 du trade
          $('wPreviewImg').src             = 'data:image/png;base64,' + b64;
          $('wDropPrompt').style.display   = 'none';
          $('wImagePreview').style.display = '';
          $('wDropZone').classList.add('has-image');
          // v0.9.353 : on n'analyse PLUS automatiquement → on affiche le bouton de
          // confirmation (évite de cramer le quota IA sur un drop accidentel/mauvais fichier).
          { const ab = $('wBtnAnalyze'); if (ab) ab.style.display = ''; }
          _refreshAnalyzeBtnState();   // v0.9.358 : grise le bouton si quota épuisé
        } catch (e) {
          console.error('[wizard] onload handler crashed', e);
          UI.toast('Erreur après lecture du fichier — réessaie.', true);
        }
      };
      // v0.9.236 (B-NEW-01) : onerror manquait → échec silencieux possible
      reader.onerror = (e) => {
        console.error('[wizard] FileReader error', e);
        UI.toast('Lecture du fichier échouée — réessaie ou utilise une autre image.', true);
      };
      try {
        reader.readAsDataURL(file);
      } catch (e) {
        console.error('[wizard] readAsDataURL threw', e);
        UI.toast('Lecture du fichier échouée — réessaie.', true);
      }
    }).catch((e) => {
      console.error('[wizard] arrayBuffer rejected', e);
      UI.toast('Erreur de lecture du fichier.', true);
    });
  }

  function clearImage() {
    capturedImage = null;
    _analysisFile = null;
    parsedTrade   = null;
    $('wDropZone').classList.remove('has-image');
    $('wDropPrompt').style.display   = '';
    $('wImagePreview').style.display = 'none';
    $('wPreviewImg').src             = '';
    $('wAnalysisStatus').style.display = 'none';
    $('wAnalysisResult').style.display = 'none';
    { const ab = $('wBtnAnalyze'); if (ab) ab.style.display = 'none'; }  // v0.9.353
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
      // v0.9.237 : si un widget existe déjà, reset() + execute() au lieu de
      // re-render (Cloudflare a déprécié `size: 'invisible'` au profit de
      // `execution: 'execute'` qui exige un re-trigger explicite).
      if (_turnstileWidgetId !== null) {
        try { turnstile.reset(_turnstileWidgetId); } catch {}
        try { turnstile.execute(_turnstileWidgetId); } catch (e) {
          console.warn('[Turnstile] re-execute failed:', e && e.message);
          return resolve('');
        }
        setTimeout(() => resolve(''), 8000);
        return;
      }
      try {
        // v0.9.237 : nouvelle API Cloudflare → `execution: 'execute'` pour widget
        // invisible (l'ancien `size: 'invisible'` est déprécié, console error).
        // Le widget se rend mais ne challenge l'user que sur appel `execute()`.
        _turnstileWidgetId = turnstile.render(container, {
          sitekey:     _TURNSTILE_SITE_KEY,
          execution:   'execute',
          appearance:  'interaction-only',
          callback:    (token) => resolve(token || ''),
          'error-callback':   () => { console.warn('[Turnstile] error-callback'); resolve(''); },
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

  // ── IA Vision API (via Cloud Function — clé API jamais exposée au client) ──
  async function analyzeWithAI(imageB64, _unusedApiKey, direction) {
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
      `- The core trade is 3 levels WITH order labels (entry, sl, tp1). Lines WITHOUT an order label are indicators — ignore them.\n` +
      `- European format may use "," or " " (28 944,25 = 28944.25)\n` +
      `- Never invent numbers. Copy EXACTLY from the chart.\n` +
      `- Constraint: ${isLong ? 'sl < entry < tp1' : 'tp1 < entry < sl'}\n` +
      `- Read the EXACT price from the right axis (the price label aligned with the order line).\n\n` +

      // v0.9.293 (F9) — détection des TP partiels (scale-out). Reste OPTIONNEL et
      // secondaire : le coeur entry/sl/tp1 est inchangé ; on n'ajoute tp2/tp3 que
      // pour des lignes EXPLICITEMENT labellisées TP/LMT au-delà de tp1.
      `OPTIONAL — extra take-profit targets (scale-out / partial exits): if, BEYOND tp1, there are MORE horizontal lines WITH a valid "TP"/"LMT" order label, ${isLong ? 'at even HIGHER prices than tp1' : 'at even LOWER prices than tp1'}, add them as tp2 then tp3 (nearest to entry first). ONLY count clearly labeled order lines — NEVER an indicator. Most trades have only tp1: if there is no extra labeled TP line, set tp2 and tp3 to null.\n\n` +

      `Respond with ONLY this JSON on one line:\n` +
      `{"entry":NUMBER,"sl":NUMBER,"tp1":NUMBER,"tp2":NUMBER_or_null,"tp3":NUMBER_or_null}`;

    // v0.9.217 — Retiré llama-3.2-vision-preview (deprecated par IA, retourne 404).
    // Llama 4 Scout/Maverick sont les modèles vision officiels en GA.
    const AI_MODELS = [
      'meta-llama/llama-4-scout-17b-16e-instruct',
      'meta-llama/llama-4-maverick-17b-128e-instruct',
    ];

    // Appel via Cloud Function (clé IA côté serveur, quota enforce côté serveur)
    if (!_fbFunctions) throw new Error('Service IA indisponible — recharge la page.');

    // v0.9.160 : hybride Turnstile + rate-limit IP.
    // Si Turnstile fonctionne (la majorité des browsers) → token valide → CF passe.
    // Sinon (Safari ITP, content blocker Firefox, etc.) → token vide → CF applique
    // rate-limit IP strict (1 analyse / 5 min / IP) comme fallback.
    const turnstileToken = await _getTurnstileToken();

    if (window.Analytics) Analytics.track('ai_analysis');
    const callable = _fbFunctions.httpsCallable('analyzeChart');
    let lastError = null;
    // v0.9.216 — Garde le meilleur résultat partiel (1 ou 2 valeurs) pour fallback
    // si AUCUN modèle IA n'arrive à détecter les 3 niveaux complets.
    let bestPartial = null;
    const _partialScore = r => (r ? (r.entry ? 1 : 0) + (r.sl ? 1 : 0) + (r.tp1 ? 1 : 0) : 0);

    for (const model of AI_MODELS) {
      let data;
      try {
        const result = await callable({ model, prompt, imageB64, turnstileToken });
        data = result.data;
      } catch (e) {
        lastError = e;
        const code = e.code || '';
        const msg  = e.message || '';
        console.warn('[IA via CF] error:', code, msg);   // v0.9.354 : ne pas exposer le nom du modèle LLM côté client
        if (code === 'functions/unauthenticated' || code === 'unauthenticated')
          throw new Error('Tu dois être connecté pour analyser un screenshot.');
        if (code === 'functions/resource-exhausted' || code === 'resource-exhausted')
          throw new Error(msg || 'Limite quotidienne atteinte. Passe à un plan payant pour plus d\'analyses.');
        if (code === 'functions/failed-precondition' || code === 'failed-precondition')
          // v0.9.141 : afficher le vrai message serveur (email non vérifié,
          // captcha invalide, etc.) au lieu du mapping erroné "Clé IA invalide"
          // qui datait de l'époque où la clé IA était côté client.
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
        for (const key of ['entry', 'sl', 'tp1', 'tp2', 'tp3']) {
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
          // v0.9.293 (F9) : ne garde tp2/tp3 que s'ils sont au-delà de tp1 dans le
          // sens du profit (sinon = erreur de l'IA, on les jette plutôt que polluer).
          for (const k of ['tp2', 'tp3']) {
            if (result[k] != null) {
              const ok = isLong ? result[k] > result.tp1 : result[k] < result.tp1;
              if (!ok) delete result[k];
            }
          }
          return result;
        }
        // v0.9.216 — Si seulement 1-2 valeurs détectées, on garde comme fallback
        // et on essaye le modèle suivant (peut-être qu'un autre modèle IA lit les 3).
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
    throw new Error(i18n.t('modal.ai.nomodel'));
  }

  // ── Claude Vision via Cloud Function (fallback pour screenshots complexes) ──
  // v0.9.222 — Gated server-side aux tiers Funded/Elite/Beta (Trader = IA only).
  async function analyzeWithClaude(imageB64, direction) {
    const isLong = direction !== 'short';
    // Même prompt que IA (déjà optimisé v0.9.220)
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
      `Find the 3 core horizontal levels with order labels and assign by position:\n` +
      `${isLong
        ? `- TOP (highest price)    → tp1\n- MIDDLE                 → entry\n- BOTTOM (lowest price)  → sl`
        : `- TOP (highest price)    → sl\n- MIDDLE                 → entry\n- BOTTOM (lowest price)  → tp1`}\n\n` +
      `European format may use "," or " " (28 944,25 = 28944.25). Constraint: ${isLong ? 'sl < entry < tp1' : 'tp1 < entry < sl'}.\n` +
      `Read EXACT prices from the right axis. Prefer giving an approximate number from the visible axis over null. Return null ONLY if no horizontal line/box with a price label is visible at all.\n` +
      // v0.9.293 (F9) — TP partiels optionnels (cf. prompt principal).
      `OPTIONAL: extra TP targets beyond tp1 (more lines labeled "TP"/"LMT", ${isLong ? 'higher' : 'lower'} than tp1) → tp2, tp3 (else null). Only labeled order lines, never indicators.\n\n` +
      `Respond with ONLY this JSON on one line:\n{"entry":NUMBER,"sl":NUMBER,"tp1":NUMBER,"tp2":NUMBER_or_null,"tp3":NUMBER_or_null}`;

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
      // Réseau ou autre → on retourne null, le client gardera le résultat IA partiel
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
    // Tri direction-aware (même logique que IA)
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
    statusEl.innerHTML      = `<span style="color:var(--muted)">${i18n.t('modal.ai.analyzing')}</span>`;
    $('wBtnNext2').disabled = true;
    $('wAnalysisResult').style.display = 'none';
    retryBtn.style.display  = 'none';
    { const ab = $('wBtnAnalyze'); if (ab) ab.style.display = 'none'; }  // v0.9.353 : cache le bouton « Analyser » pendant l'analyse

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
      // Sinon route normale : IA d'abord + fallback Claude auto si IA raté.
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
        // Réanalyse forcée → Claude direct sans passer par IA
        statusEl.innerHTML = `<span style="color:var(--accent-l);display:inline-flex;align-items:center;gap:6px">${Icons.svg('cpu',13)} Analyse approfondie via Claude…</span>`;
        try {
          result = await analyzeWithClaude(capturedImage, direction);
        } catch (e) {
          console.warn('[Claude direct] failed:', e && e.message);
          result = null;
        }
        Store.refreshAiUsage();
        _forceClaude = false; // reset pour la prochaine analyse
      } else {
        // Route normale : IA d'abord
        result = await analyzeWithAI(capturedImage, null, direction);
        Store.refreshAiUsage();

        // Fallback Claude si IA insuffisant OU résultat aberrant (R:R cassé)
        const aiScore   = _scoreResult(result);
        const aiAberrant = _isAberrantTrade(result);
        const aiBad     = aiScore < 3 || aiAberrant;
        if (aiBad && _canUseClaudeFallback()) {
          statusEl.innerHTML = `<span style="color:var(--accent-l);display:inline-flex;align-items:center;gap:6px">${Icons.svg('cpu',13)} Analyse approfondie via Claude…</span>`;
          try {
            const claudeResult = await analyzeWithClaude(capturedImage, direction);
            // On garde Claude SI il fait mieux (score plus haut OU non-aberrant)
            const claudeScore = _scoreResult(claudeResult);
            const claudeAberrant = _isAberrantTrade(claudeResult);
            if (claudeResult && (claudeScore > aiScore || (claudeScore === aiScore && !claudeAberrant && aiAberrant))) {
              result = claudeResult;
            }
          } catch (e) {
            console.warn('[Claude fallback] failed:', e && e.message);
            // Continue silencieusement avec le résultat IA partiel
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
          throw new Error(i18n.t('modal.ai.notfound'));
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

        // v0.9.222 — Upsell Claude pour les Trader si IA a raté (missing values).
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
      // v0.9.354 : quota IA épuisé → NE PAS ré-afficher « Réanalyser » (sinon re-bombarde
      // l'API, rejetée serveur) + pastille « IA active » passe en rouge « quota épuisé ».
      const _exhausted = e && (e.code === 'functions/resource-exhausted' || e.code === 'resource-exhausted'
        || /limite.*(analyse|quotidienn)|quota|exhausted/i.test(e.message || ''));
      retryBtn.style.display = _exhausted ? 'none' : 'inline-flex';
      if (_exhausted) {
        const ab = $('aiStatusBadge');
        if (ab) { ab.textContent = i18n.t('modal.ai.exhausted'); ab.style.color = 'var(--red)'; }
      }
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
    const sel = $('wInstr');
    if (!sel) return;
    const prevVal = sel.value;
    // v0.9.310 (FIX) : getMyAccountByName (MES comptes), pas getAccountByName (presets prop firm).
    const apexValue = $('wApex') ? $('wApex').value : '';
    const account = apexValue && Store.getMyAccountByName ? Store.getMyAccountByName(apexValue) : null;

    // Instruments disponibles selon le type de compte :
    //  - crypto   → paires de la plateforme
    //  - personal → futures + crypto (v0.9.311 : « on a tout » avec ton propre capital)
    //  - prop/autre → futures
    const available = [];   // [{ value, cat }]
    if (account && account.accountType === 'crypto') {
      const list = account.cryptoPlatform === 'coinbase' ? CRYPTO_INSTRS_COINBASE : CRYPTO_INSTRS_BINANCE;
      list.forEach(i => available.push({ value: i, cat: 'Crypto' }));
    } else {
      const sp = Store.getSpreadsByFirm(fk || 'apex');
      Object.keys(sp).filter(i => VALID_INSTRS.has(i)).forEach(i => available.push({ value: i, cat: INSTR_CAT[i] || 'Autres' }));
      if (account && account.accountType === 'personal') {
        [...CRYPTO_INSTRS_BINANCE, ...CRYPTO_INSTRS_COINBASE].forEach(i => available.push({ value: i, cat: 'Crypto' }));
      }
    }

    // v0.9.395 : l'étoile ★ est un FILTRE d'affichage (pas un favori par instrument).
    //  - _instrFavOnly = true (défaut) → « Mes instruments » : on n'affiche que les
    //    favInstruments (sélectionnés au setup / dans Réglages) valides pour ce compte.
    //  - _instrFavOnly = false → on affiche TOUS les instruments dispo pour ce compte.
    // Si le filtre est actif mais qu'aucun favori n'est valide pour ce compte → fallback
    // sur tous les dispo (jamais de dropdown vide qui bloquerait le trade).
    const favs = (Store.getSettings && Store.getSettings().favInstruments) || [];
    const favSet = new Set(Array.isArray(favs) ? favs : []);
    const selectedAvail = available.filter(a => favSet.has(a.value));
    const shown = (_instrFavOnly && selectedAvail.length) ? selectedAvail : available;

    let html = '';
    const groups = {};
    shown.forEach(a => { (groups[a.cat] = groups[a.cat] || []).push(a.value); });
    Object.keys(groups).forEach(cat => {
      html += `<optgroup label="${cat}">${groups[cat].map(i => `<option value="${i}">${i}</option>`).join('')}</optgroup>`;
    });

    sel.innerHTML = html;
    const fallback = (account && account.accountType === 'crypto') ? 'BTCUSDT' : 'MES1';
    const cur = keepVal || prevVal || fallback;
    sel.value = [...sel.options].some(o => o.value === cur) ? cur : (sel.options[0]?.value || fallback);
    _updateFavStar();
  }

  // v0.9.395 : l'étoile reflète l'état du FILTRE (mes instruments vs tout)
  function _updateFavStar() {
    const star = $('wFavStar');
    if (!star) return;
    star.textContent = _instrFavOnly ? '★' : '☆';
    star.style.color = _instrFavOnly ? 'var(--accent)' : 'var(--muted)';
    star.setAttribute('aria-pressed', _instrFavOnly ? 'true' : 'false');
    star.title = _instrFavOnly ? 'Mes instruments (cliquer pour tout voir)' : 'Tous les instruments (cliquer pour mes instruments)';
  }

  // v0.9.395 : bascule le filtre — « Mes instruments » ⇄ « Tous », puis re-rend la liste
  function _toggleInstrFilter() {
    _instrFavOnly = !_instrFavOnly;
    const sel = $('wInstr');
    populateInstrumentSelect(firmKey, sel ? sel.value : null);   // garde la sélection si possible
    if (window.UI && UI.toast) {
      const en = (window.i18n && i18n.getLang && i18n.getLang() === 'en');
      UI.toast(_instrFavOnly
        ? (en ? 'My instruments ⭐' : 'Mes instruments ⭐')
        : (en ? 'All instruments' : 'Tous les instruments'));
    }
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
    // v0.9.231 (FNC-01 fix) : CFD ET crypto autorisent les lots fractionnaires
    // (0.01 step). Les futures classiques (NQ, ES, GC, CL, etc.) restent en
    // contrats entiers. Avant ce fix, ouvrir un trade crypto lot 0.2 en
    // édition arrondissait à 1 (Math.round(0.2) puis Math.max(1, …)).
    if (Calc.isCFD(instr) || Calc.isCrypto(instr)) {
      inp.step = '0.01';
      inp.min  = '0.01';
    } else {
      inp.step = '1';
      inp.min  = '1';
      const v = parseFloat(inp.value) || 1;
      inp.value = Math.max(1, Math.round(v));
    }
  }

  // ── v0.9.250 : Sorties partielles multiples ────────────────────────────────
  // State : array de rows { lots, price }. Rendu dynamiquement dans #wPartialsList.
  let _partials = [];

  function _renderPartialRows() {
    const list = $('wPartialsList');
    if (!list) return;
    list.innerHTML = '';
    _partials.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'partial-row';
      row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 32px;gap:8px;align-items:center';
      row.innerHTML = `
        <input class="form-input mono partial-lots"  type="number" step="any" min="0" lang="en" inputmode="decimal" placeholder="ex: 2">
        <input class="form-input mono partial-price" type="number" step="any"        lang="en" inputmode="decimal" placeholder="ex: 7194">
        <button type="button" class="btn-ghost partial-remove" style="padding:6px;font-size:14px;color:var(--red)" aria-label="Supprimer cette sortie">✕</button>
      `;
      list.appendChild(row);
      const lotsInp  = row.querySelector('.partial-lots');
      const priceInp = row.querySelector('.partial-price');
      // v0.9.291 (audit) : valeurs posées via .value (propriété DOM) et non par
      // interpolation HTML d'attribut → aucun risque de breakout d'attribut.
      lotsInp.value  = (p.lots  != null ? p.lots  : '');
      priceInp.value = (p.price != null ? p.price : '');
      const removeBtn= row.querySelector('.partial-remove');
      const onInput = () => {
        _partials[i].lots  = lotsInp.value.trim()  !== '' ? parseFloat(lotsInp.value)  : null;
        _partials[i].price = priceInp.value.trim() !== '' ? parseFloat(priceInp.value) : null;
        _updatePartialsSummary();
        wRecalc();
      };
      lotsInp.addEventListener('input', onInput);
      priceInp.addEventListener('input', onInput);
      removeBtn.addEventListener('click', () => {
        _partials.splice(i, 1);
        _renderPartialRows();
        _updatePartialsSummary();
        wRecalc();
      });
    });
  }

  // v0.9.251 : gating UI des sorties partielles selon le tier.
  // Trader → banner upsell + checkbox/section masquées. Pro → UI normale.
  function _refreshPartialsGate() {
    const banner = $('wPartialLockedBanner');
    const label  = $('wPartialEnableLabel');
    const fields = $('wPartialFields');
    if (!banner || !label) return;
    if (_canUsePartials()) {
      banner.style.display = 'none';
      label.style.display  = 'flex';
    } else {
      banner.style.display = 'block';
      label.style.display  = 'none';
      if (fields) fields.style.display = 'none';
      const cb = $('wPartialEnable');
      if (cb) cb.checked = false;
    }
  }

  function _addPartialRow(lots, price) {
    if (_partials.length >= 10) return;
    _partials.push({ lots: lots != null ? lots : null, price: price != null ? price : null });
    _renderPartialRows();
    _updatePartialsSummary();
  }

  // v0.9.251 : sorties partielles = feature Pro. Helper de gating.
  function _canUsePartials() {
    return !!(Store && Store.canUseFeature && Store.canUseFeature('partials'));
  }

  // Lit les partials valides (lots>0 et price renseigné). Pour le save + calc.
  // Retourne [] si l'user n'est pas Pro (gating au save même en cas de bypass UI).
  function _collectPartials() {
    if (!_canUsePartials()) return [];
    if (!$('wPartialEnable').checked) return [];
    return _partials
      .filter(p => p && p.lots != null && p.lots > 0 && p.price != null && isFinite(p.price))
      .map(p => ({ lots: p.lots, price: p.price }));
  }

  function _updatePartialsSummary() {
    const el = $('wPartialsSummary');
    if (!el) return;
    const contracts = parseFloat($('wContracts').value) || 0;
    const valid = _collectPartials();
    const sold  = valid.reduce((s, p) => s + p.lots, 0);
    const runner = +(contracts - sold).toFixed(6);
    if (!valid.length) { el.textContent = ''; return; }
    if (sold > contracts + 1e-9) {
      el.style.color = 'var(--red)';
      el.textContent = `⚠ ${sold} lots sortis > ${contracts} lots au total. Réduis les quantités.`;
    } else if (runner > 0) {
      el.style.color = 'var(--muted)';
      el.textContent = `${sold} lot(s) sortis en ${valid.length} fois · runner restant : ${runner} lot(s) → sort au prix d'Exit (ou TP1 si Open).`;
    } else {
      el.style.color = 'var(--muted)';
      el.textContent = `Position entièrement sortie en ${valid.length} tranche(s) (${sold} lots).`;
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

    // v0.9.250 : sorties partielles multiples (lus depuis les rows si toggle activé)
    const partials = _collectPartials();

    const c = Calc.trade({
      direction, entry, sl, tp1,
      instrument, contracts, capital,
      feePerSide, feeTakerPct, spreadCost,
      exitPrice, manualPnl,
      partials,
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

  // Reset complet du state screenshot (tous les slots)
  function resetShotState() {
    shotBlob          = null;
    shotExistingPath  = null;
    shotPendingDelete = false;
    clearShotPreview();
    // v0.9.246 : reset slots additionnels
    shotsExtra.forEach((s, i) => {
      s.blob = null;
      s.existingPath = null;
      s.pendingDelete = false;
      if (s.previewUrl) { try { URL.revokeObjectURL(s.previewUrl); } catch {} }
      s.previewUrl = null;
    });
    _renderExtraSlots();
    _refreshShotsGate();
  }

  // v0.9.248 : un slot est "vide" s'il n'a ni blob en attente ni path existant
  // actif (un existingPath flaggé pendingDelete compte comme vide).
  function _isSlot0Empty() {
    if (shotBlob) return false;
    if (shotExistingPath && !shotPendingDelete) return false;
    return true;
  }
  function _isExtraEmpty(i) {
    const s = shotsExtra[i];
    if (!s) return true;
    if (s.blob) return false;
    if (s.existingPath && !s.pendingDelete) return false;
    return true;
  }

  // v0.9.248 : route un blob vers le premier slot libre (0 → 1 → 2), dans la
  // limite du tier. Utilisé par le paste Ctrl+V répété pour empiler les captures.
  function _pasteIntoNextFreeSlot(rawBlob) {
    const max = (Store && Store.getMaxScreenshots) ? Store.getMaxScreenshots() : 0;
    if (max <= 0) {
      // Trader : pas de capture conservée. handleShotFromBlob garde le comportement
      // legacy (preview only, non sauvée au commit côté _uploadAllSlots).
      handleShotFromBlob(rawBlob);
      return;
    }
    // Slot 0
    if (_isSlot0Empty()) { handleShotFromBlob(rawBlob); return; }
    // Slots extras (1, 2) dans la limite du tier
    const extraCount = Math.min(max - 1, shotsExtra.length);
    for (let i = 0; i < extraCount; i++) {
      if (_isExtraEmpty(i)) { _handleExtraBlob(rawBlob, i); return; }
    }
    // Tous pleins → on remplace le DERNIER slot dispo (comportement "le plus récent gagne")
    const status = $('wShotStatus');
    if (status) {
      status.style.color = 'var(--amber)';
      status.textContent = `Limite de ${max} captures atteinte — supprime-en une pour en ajouter.`;
    }
  }

  // v0.9.290 : seed le slot 0 du trade avec l'image utilisée pour l'analyse IA,
  // pour qu'elle soit conservée automatiquement (visible en bas, étape 3) sans que
  // l'user ait à la re-déposer. Il reste alors 2 slots → 3 captures au total.
  // Conditions : tier Pro (max>=1), slot 0 vide, et une image d'analyse existe.
  async function _seedSlot0FromAnalysis() {
    try {
      const max = (Store && Store.getMaxScreenshots) ? Store.getMaxScreenshots() : 0;
      if (max < 1 || !_analysisFile || !_isSlot0Empty()) return;
      await handleShotFromBlob(_analysisFile);
      _refreshShotsGate();
    } catch (e) { console.warn('[wizard] seed slot0 from analysis', e && e.message); }
  }

  // v0.9.246 : applique le gating tier sur la section screenshots du wizard.
  // - Trader : affiche la banner upsell, cache tout slot.
  // - Pro    : affiche les slots (slot 0 + extras dans la limite getMaxScreenshots).
  function _refreshShotsGate() {
    const banner    = $('wShotsLockedBanner');
    const container = $('wShotsContainer');
    const countEl   = $('wShotsCount');
    if (!banner || !container) return;
    const max = (Store && Store.getMaxScreenshots) ? Store.getMaxScreenshots() : 0;
    if (max <= 0) {
      banner.style.display    = 'block';
      container.style.display = 'none';
      if (countEl) countEl.textContent = '';
    } else {
      banner.style.display    = 'none';
      container.style.display = 'flex';
      const filled = (shotBlob || shotExistingPath ? 1 : 0)
                   + shotsExtra.slice(0, max - 1).filter(s => s.blob || s.existingPath).length;
      if (countEl) countEl.textContent = `— ${filled}/${max}`;
    }
  }

  // v0.9.246 : rend dynamiquement les slots 1 et 2 (si tier le permet).
  function _renderExtraSlots() {
    const wrap = $('wShotsExtra');
    if (!wrap) return;
    const max = (Store && Store.getMaxScreenshots) ? Store.getMaxScreenshots() : 0;
    const extraCount = Math.max(0, Math.min(max - 1, shotsExtra.length));
    wrap.innerHTML = '';
    for (let i = 0; i < extraCount; i++) {
      const slot = shotsExtra[i];
      const idx  = i + 1; // slot index global (1, 2)
      const hasContent = !!(slot.blob || (slot.existingPath && !slot.pendingDelete));
      const previewSrc = slot.previewUrl || slot.existingPreviewUrl || '';

      const el = document.createElement('div');
      el.className = 'shot-slot-extra';
      el.dataset.slot = String(idx);
      el.style.cssText = 'border:1px dashed var(--border);border-radius:8px;padding:14px;text-align:center;cursor:pointer;outline:none;transition:border-color 0.15s,background 0.15s';
      el.tabIndex = 0;
      el.innerHTML = hasContent
        ? `<img alt="Capture ${idx + 1}" src="${previewSrc}" style="max-width:100%;max-height:180px;border-radius:6px;display:block;margin:0 auto 8px">
           <div style="display:flex;gap:8px;justify-content:center;font-size:12px">
             <button type="button" class="btn-ghost shot-slot-replace" style="padding:4px 12px;font-size:12px">${i18n.t('wiz.shots.replace') || 'Remplacer'}</button>
             <button type="button" class="btn-ghost shot-slot-delete"  style="padding:4px 12px;font-size:12px;color:var(--red)">${i18n.t('wiz.shots.delete') || 'Supprimer'}</button>
           </div>`
        : `<div style="color:var(--muted);font-size:13px">
             <div style="margin-bottom:6px;color:var(--muted)">${Icons.svg('paperclip',22)}</div>
             ${i18n.t('wiz.shots.extra.hint') || 'Ajoute une capture (ex : exit, gestion)'}<br>
             <span style="font-size:11px">${i18n.t('wiz.shots.extra.cta') || 'Clique ou glisse une image'}</span>
           </div>`;
      wrap.appendChild(el);

      // Bind handlers spécifiques à ce slot
      _bindExtraSlot(el, i);
    }
  }

  // v0.9.289 : extrait une image d'un drop, qu'elle arrive via dataTransfer.files
  // (fichier du bureau) OU dataTransfer.items (certains navigateurs / drags depuis
  // une autre app). Avant on ne lisait que .files → des drags valides ne faisaient
  // rien (« drag & drop pas tout à fait »).
  function _imageFileFromDT(dt) {
    if (!dt) return null;
    if (dt.files && dt.files[0] && dt.files[0].type && dt.files[0].type.startsWith('image/')) {
      return dt.files[0];
    }
    if (dt.items) {
      for (const it of dt.items) {
        if (it.kind === 'file') {
          const f = it.getAsFile();
          if (f && f.type && f.type.startsWith('image/')) return f;
        }
      }
    }
    return null;
  }

  // v0.9.246 : handlers drag/drop/click pour un slot extra (1 ou 2).
  function _bindExtraSlot(el, extraIdx) {
    const replaceBtn = el.querySelector('.shot-slot-replace');
    const deleteBtn  = el.querySelector('.shot-slot-delete');

    // Click sur le slot (hors boutons) → ouvre file picker
    el.addEventListener('click', (e) => {
      if (replaceBtn && (e.target === replaceBtn || replaceBtn.contains(e.target))) return;
      if (deleteBtn  && (e.target === deleteBtn  || deleteBtn.contains(e.target)))  return;
      _pickExtraFile(extraIdx);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); _pickExtraFile(extraIdx); }
    });

    // Drag & drop
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.style.borderColor = 'var(--accent)'; el.style.background = 'rgba(0, 255, 136,0.05)'; });
    el.addEventListener('dragleave', () => { el.style.borderColor = ''; el.style.background = ''; });
    el.addEventListener('dragenter', (e) => e.preventDefault());
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.style.borderColor = ''; el.style.background = '';
      const file = _imageFileFromDT(e.dataTransfer);
      if (file) _handleExtraBlob(file, extraIdx);
    });

    if (replaceBtn) {
      replaceBtn.addEventListener('click', (e) => { e.stopPropagation(); _pickExtraFile(extraIdx); });
    }
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const s = shotsExtra[extraIdx];
        if (s.existingPath) s.pendingDelete = true;
        if (s.previewUrl) { try { URL.revokeObjectURL(s.previewUrl); } catch {} }
        s.blob = null;
        s.previewUrl = null;
        _renderExtraSlots();
        _refreshShotsGate();
      });
    }
  }

  function _pickExtraFile(extraIdx) {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      if (f) _handleExtraBlob(f, extraIdx);
      try { document.body.removeChild(input); } catch {}
    });
    input.click();
  }

  async function _handleExtraBlob(rawBlob, extraIdx) {
    const status = $('wShotStatus');
    if (rawBlob.size > 10 * 1024 * 1024) {
      status.style.color = 'var(--red)';
      status.textContent = 'Fichier trop lourd (max 10 MB avant compression)';
      return;
    }
    try {
      const head = new Uint8Array(await rawBlob.slice(0, 12).arrayBuffer());
      if (!isValidImageMagicBytes(head)) {
        status.style.color = 'var(--red)';
        status.textContent = 'Fichier invalide — utilise un PNG/JPG/WEBP/GIF';
        return;
      }
    } catch {
      status.style.color = 'var(--red)';
      status.textContent = 'Image illisible';
      return;
    }
    status.style.color = 'var(--muted)';
    status.textContent = `Compression capture #${extraIdx + 2}…`;
    try {
      const compressed = await compressImage(rawBlob);
      const s = shotsExtra[extraIdx];
      if (s.previewUrl) { try { URL.revokeObjectURL(s.previewUrl); } catch {} }
      s.blob          = compressed;
      s.previewUrl    = URL.createObjectURL(compressed);
      s.pendingDelete = false;
      _renderExtraSlots();
      _refreshShotsGate();
      status.style.color    = 'var(--green)';
      status.style.fontWeight = '600';
      const kb = Math.round(compressed.size / 1024);
      status.textContent    = `✓ Capture #${extraIdx + 2} prête (${kb} KB)`;
    } catch (e) {
      status.style.color = 'var(--red)';
      status.textContent = e.message || 'Erreur lors du traitement de l\'image';
    }
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

  // v0.9.246 : charge tous les screenshots (slot 0 + extras 1-2) à l'édition.
  // Lit en priorité `trade.screenshotPaths` (array), sinon fallback sur le
  // legacy `trade.screenshotPath` (string).
  async function _loadExistingShots(t) {
    const paths = Array.isArray(t.screenshotPaths) && t.screenshotPaths.length
      ? t.screenshotPaths
      : (t.screenshotPath ? [t.screenshotPath] : []);
    if (paths[0]) await loadExistingShot(paths[0]);
    // Slots extras (index 1 et 2 dans paths → shotsExtra[0] et shotsExtra[1])
    for (let i = 1; i < paths.length && i - 1 < shotsExtra.length; i++) {
      const slot = shotsExtra[i - 1];
      slot.existingPath = paths[i];
      slot.pendingDelete = false;
      try {
        const url = await Store.getTradeScreenshotUrl(paths[i]);
        if (url) {
          slot.existingPreviewUrl = url;
          _renderExtraSlots();
          _refreshShotsGate();
        }
      } catch (e) {
        console.warn('[wizard] load extra slot ' + i + ' failed', e && e.message);
      }
    }
    _refreshShotsGate();
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
    _analysisFile = null;
    parsedTrade   = null;
    capital       = Store.getSettings().capital || 50000;
    feePerSide    = 2.14;
    spreadCost    = 0;
    firmKey       = 'apex';
    _instrFavOnly = true;   // v0.9.395 : toujours « Mes instruments » au démarrage

    // Reset state screenshot + pré-génère un ID trade en mode création
    resetShotState();
    pendingTradeId = id ? null : Store.newTradeId();

    // Reset sorties partielles (v0.9.250)
    $('wPartialEnable').checked   = false;
    $('wPartialFields').style.display = 'none';
    $('wPartialPercent').value    = '';
    $('wPartialPrice').value      = '';
    _partials = [];
    _renderPartialRows();
    _updatePartialsSummary();
    _refreshPartialsGate();

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
      // Sorties partielles (v0.9.250) — nouveau format `partials[]` prioritaire,
      // sinon migration depuis le legacy partialPercent/partialPrice.
      if (Array.isArray(t.partials) && t.partials.length) {
        _partials = t.partials.map(p => ({ lots: p.lots, price: p.price }));
        $('wPartialEnable').checked       = true;
        $('wPartialFields').style.display = '';
        _renderPartialRows();
        _updatePartialsSummary();
      } else if (t.partialPercent != null && t.partialPrice != null) {
        // Legacy : convertit le % en lots (% × contracts)
        const lots = +((t.partialPercent / 100) * (t.contracts || 0)).toFixed(4);
        _partials = [{ lots: lots > 0 ? lots : null, price: t.partialPrice }];
        $('wPartialEnable').checked       = true;
        $('wPartialFields').style.display = '';
        _renderPartialRows();
        _updatePartialsSummary();
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
      // v0.9.246 : charge screenshots (slot 0 + extras 1-2)
      _loadExistingShots(t);
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
    _analysisFile = null;
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

  // v0.9.246 : upload de tous les slots screenshot (0 + extras). Trader → rien
  // n'est uploadé, et tout legacy screenshotPath éventuel est supprimé.
  // Retourne { screenshotPath: <slot 0 ou null>, screenshotPaths: [<paths non-null>] }.
  async function _uploadAllSlots(tradeId) {
    const max = (Store && Store.getMaxScreenshots) ? Store.getMaxScreenshots() : 0;
    if (max <= 0) {
      // Trader : aucune image conservée. Nettoie l'éventuel legacy.
      if (shotExistingPath) Store.deleteTradeScreenshot(shotExistingPath).catch(() => null);
      shotsExtra.forEach(s => {
        if (s.existingPath) Store.deleteTradeScreenshot(s.existingPath).catch(() => null);
      });
      return { screenshotPath: null, screenshotPaths: [] };
    }

    const paths = [];

    // ── Slot 0 ────────────────────────────────────────────────────────────────
    if (shotPendingDelete && shotExistingPath) {
      Store.deleteTradeScreenshot(shotExistingPath).catch(() => null);
      paths[0] = null;
    } else if (shotBlob) {
      try {
        const p = await Store.uploadTradeScreenshot(tradeId, shotBlob, 0);
        if (shotExistingPath && shotExistingPath !== p) {
          Store.deleteTradeScreenshot(shotExistingPath).catch(() => null);
        }
        paths[0] = p;
      } catch (e) {
        UI.toast('Upload capture #1 échoué : ' + (e.message || 'erreur'), true);
        paths[0] = shotExistingPath || null;
      }
    } else if (shotExistingPath) {
      paths[0] = shotExistingPath;
    } else {
      paths[0] = null;
    }

    // ── Slots extras (1, 2) ───────────────────────────────────────────────────
    const extraCount = Math.min(max - 1, shotsExtra.length);
    for (let i = 0; i < extraCount; i++) {
      const s        = shotsExtra[i];
      const slotIdx  = i + 1;
      if (s.pendingDelete && s.existingPath) {
        Store.deleteTradeScreenshot(s.existingPath).catch(() => null);
        paths[slotIdx] = null;
      } else if (s.blob) {
        try {
          const p = await Store.uploadTradeScreenshot(tradeId, s.blob, slotIdx);
          if (s.existingPath && s.existingPath !== p) {
            Store.deleteTradeScreenshot(s.existingPath).catch(() => null);
          }
          paths[slotIdx] = p;
        } catch (e) {
          UI.toast(`Upload capture #${slotIdx + 1} échoué : ` + (e.message || 'erreur'), true);
          paths[slotIdx] = s.existingPath || null;
        }
      } else if (s.existingPath) {
        paths[slotIdx] = s.existingPath;
      } else {
        paths[slotIdx] = null;
      }
    }

    return {
      screenshotPath:  paths[0] || null,
      screenshotPaths: paths.filter(p => p),
    };
  }

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
      // v0.9.358 (fix B-06) : en CRÉATION, on recalcule toujours le spread depuis
      // l'instrument+firm sélectionnés — sinon un trade saisi sans changer l'instrument
      // par défaut gardait spreadCost=0 (le spread n'était subi que par hasard, ex.
      // après un change event). En ÉDITION, on préserve la valeur historique du trade.
      spreadCost: editingId ? spreadCost : getSpreadForInstrument(firmKey, safeInstr),
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
      // v0.9.250 : sorties partielles multiples [{ lots, price }].
      // Legacy partialPercent/partialPrice forcés à null (on n'écrit plus l'ancien format).
      partials:       _collectPartials().length ? _collectPartials() : null,
      partialPercent: null,
      partialPrice:   null,
    };

    try {
      let saved;
      if (editingId) {
        // v0.9.246 : upload tous les slots (max 3, Pro only). Trader → null.
        const finalData = { ...data };
        const { screenshotPath, screenshotPaths } = await _uploadAllSlots(editingId);
        finalData.screenshotPath  = screenshotPath;
        finalData.screenshotPaths = screenshotPaths.length ? screenshotPaths : null;
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
        // v0.9.246 : mode création, upload tous les slots via helper unifié
        const { screenshotPath, screenshotPaths } = await _uploadAllSlots(pendingTradeId);
        const dataWithId = { ...data, id: pendingTradeId };
        if (screenshotPath)         dataWithId.screenshotPath  = screenshotPath;
        if (screenshotPaths.length) dataWithId.screenshotPaths = screenshotPaths;
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
    // v0.9.223 — "Réanalyser" force Claude direct (skip IA) si tier le permet.
    // Trader → relance IA (pas accès Claude). Funded/Elite/Beta → Claude direct.
    $('wBtnRetry').addEventListener('click', () => {
      if (_canUseClaudeFallback()) _forceClaude = true;
      analyzeImage();
    });
    // v0.9.353 — l'analyse ne part qu'au clic explicite (1ʳᵉ analyse) → protège le quota IA.
    $('wBtnAnalyze').addEventListener('click', () => {
      if (typeof Store !== 'undefined' && Store.canAnalyzeToday && !Store.canAnalyzeToday()) {
        _refreshAnalyzeBtnState();
        return;   // garde-fou : quota épuisé → ne lance pas l'analyse
      }
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
      // v0.9.358 (fix B-06) : en saisie MANUELLE (pas d'IA), fillStep3FromParsed n'est
      // pas appelé → spreadCost resterait à 0. On l'initialise ici depuis l'instrument
      // par défaut pour que le preview live ET le P&L sauvegardé incluent le spread.
      if (!editingId && !parsedTrade) {
        spreadCost = getSpreadForInstrument(firmKey, $('wInstr').value);
        updateSpreadDisplay();
      }
      // v0.9.176 (H3 fix) : préserver le compte déjà pré-sélectionné au step 1
      // (lecture du select courant avant re-render). Évite de re-demander à l'user
      // de choisir son compte 50x par jour quand il est déjà sélectionné par défaut.
      populateApexSelect($('wApex').value || '');
      goToStep(3);
      _seedSlot0FromAnalysis();   // v0.9.290 : l'image d'analyse devient la capture #1
      $('wContracts').focus();
    });

    $('wDropZone').addEventListener('click', e => {
      if (e.target === $('wBtnClearImg') || $('wBtnClearImg').contains(e.target)) return;
      $('wImageFile').click();
    });
    $('wBtnClearImg').addEventListener('click', e => { e.stopPropagation(); clearImage(); });
    $('wImageFile').addEventListener('change', e => {
      const input = e.target;
      const file  = input.files && input.files[0];
      if (file) {
        loadImageFile(file);
        // v0.9.236 (B-NEW-01) : reset différé pour ne pas interférer avec la
        // promise async loadImageFile(). Permet aussi de re-sélectionner le
        // même fichier après clearImage().
        setTimeout(() => { try { input.value = ''; } catch {} }, 0);
      }
    });

    // Drag-and-drop
    $('wDropZone').addEventListener('dragenter', e => e.preventDefault());
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
      const file = _imageFileFromDT(e.dataTransfer);
      if (file) loadImageFile(file);
    });

    // v0.9.289 : garde anti-navigation. Si on rate une zone de drop pendant que
    // le wizard est ouvert, le navigateur OUVRIRAIT le fichier déposé (et on
    // perdrait tout le wizard). On bloque le comportement par défaut au niveau
    // document quand la modale est ouverte ; les zones gardent leur propre handler.
    ['dragover', 'drop'].forEach(evt => {
      document.addEventListener(evt, e => {
        if ($('modalOverlay') && $('modalOverlay').classList.contains('open')) e.preventDefault();
      });
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
        // v0.9.248 : route le paste vers le PREMIER slot vide (0 → 1 → 2)
        // au lieu d'écraser systématiquement le slot 0. Permet de coller
        // plusieurs captures à la suite avec Ctrl+V répétés.
        _pasteIntoNextFreeSlot(imgFile);
      }
    });

    // Step 3
    $('wBtnBack2').addEventListener('click', () => goToStep(2));
    $('wBtnSave').addEventListener('click',  save);

    // Toggle sorties partielles (v0.9.250)
    $('wPartialEnable').addEventListener('change', e => {
      $('wPartialFields').style.display = e.target.checked ? '' : 'none';
      if (e.target.checked) {
        // Si on active et aucune row → en créer une vide par défaut
        if (!_partials.length) _addPartialRow();
      } else {
        _partials = [];
        _renderPartialRows();
      }
      _updatePartialsSummary();
      wRecalc();
    });
    // Bouton "+ Ajouter une sortie"
    const partialAddBtn = $('wPartialAdd');
    if (partialAddBtn) {
      partialAddBtn.addEventListener('click', () => { _addPartialRow(); });
    }

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
      shotZone.addEventListener('dragenter', e => e.preventDefault());
      shotZone.addEventListener('dragover', e => {
        e.preventDefault();
        shotZone.style.borderColor = 'var(--purple-l)';
        shotZone.style.background  = 'rgba(0, 255, 136,0.05)';
      });
      shotZone.addEventListener('dragleave', e => {
        // Ne réinitialise que si on quitte vraiment la zone (pas un enfant) → anti-flicker
        if (!shotZone.contains(e.relatedTarget)) {
          shotZone.style.borderColor = '';
          shotZone.style.background  = '';
        }
      });
      shotZone.addEventListener('drop', e => {
        e.preventDefault();
        shotZone.style.borderColor = '';
        shotZone.style.background  = '';
        const file = _imageFileFromDT(e.dataTransfer);
        if (file) handleShotFromBlob(file);
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
      _updateFavStar();   // v0.9.312 : refléter l'état favori du nouvel instrument
      wRecalc();
    });
    // v0.9.312 : étoile favoris (à droite du label Instrument)
    if ($('wFavStar')) $('wFavStar').addEventListener('click', _toggleInstrFilter);

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
    // v0.9.250 : changer le nb de lots total met aussi à jour le résumé partials
    $('wContracts').addEventListener('input', _updatePartialsSummary);

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

    // v0.9.231 (VIS-04 fix) — focus trap RETIRÉ en v0.9.236 :
    // Soupçonné de casser l'upload image via file picker (bug B-NEW-01).
    // Le revert est défensif. À ré-instaurer après tests si on confirme
    // que ce n'est pas la cause (changement orthogonal à priori, mais
    // bénéfice a11y < risque de regression upload).
  }

  return { init, open, close };
})();
