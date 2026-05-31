// ─── SETTINGS ─────────────────────────────────────────────────────────────────
(function () {
  const $ = id => document.getElementById(id);
  const t = k => i18n.t(k);

  const INSTRUMENTS = [
    'MES1','ES1','MNQ1','NQ1',
    'MYM1','YM1','M2K1','RTY1',
    'MGC1','GC1','QO1','MCL1','CL1','ZN1',
  ];

  // Groupes d'instruments par catégorie (pour la sidebar du modal & le label)
  const INSTR_CATEGORY = {
    MES1:'Indices Micro', ES1:'Indices Full', MNQ1:'Indices Micro', NQ1:'Indices Full',
    MYM1:'Indices Micro', YM1:'Indices Full', M2K1:'Indices Micro', RTY1:'Indices Full',
    MGC1:'Métaux', GC1:'Métaux', QO1:'Métaux', MCL1:'Énergie', CL1:'Énergie', ZN1:'Taux',
    'US500':'Indices CFD','US100':'Indices CFD','US30':'Indices CFD','GER40':'Indices CFD','UK100':'Indices CFD',
    'XAUUSD':'Métaux CFD','EURUSD':'Forex','GBPUSD':'Forex','USDJPY':'Forex','USOIL':'Énergie CFD',
  };
  const STATUS_LABEL = { evaluation: 'EVAL', funded: 'PA' };
  const STATUS_BADGE = { evaluation: 'ma-eval', funded: 'ma-funded' };

  // v0.9.370 — Traduction EN des données de référence (onglets « Règles & marchés » +
  // « Fonds propres »). Ces chaînes vivent dans des objets de données (DEFAULT_PROP_FIRMS,
  // BROKERS, crypto) → map FR→EN appliquée au rendu via tR(). En FR, renvoie la chaîne telle quelle.
  const DATA_EN = {
    // drawdownType
    'Statique (2-Step)': 'Static (2-Step)',
    'Trailing (1-Step)': 'Trailing (1-Step)',
    'Trailing (se fige à PT)': 'Trailing (locks at PT)',
    'Trailing EOD (se fige à PT)': 'Trailing EOD (locks at PT)',
    'Trailing EOD': 'Trailing EOD',
    // consistency
    'Aucune': 'None',
    'Best day ≤50% des profits totaux': 'Best day ≤50% of total profits',
    'Best day ≤50% profits totaux': 'Best day ≤50% of total profits',
    '≤20% best day par cycle': '≤20% best day per cycle',
    '≤40% best day (funded)': '≤40% best day (funded)',
    '≤50% best day (éval only, none funded)': '≤50% best day (eval only, none funded)',
    '≤50% meilleure journée (PA)': '≤50% best day (PA)',
    // payoutConditions
    '80% split (90% après scaling) — fee remboursé au 1er payout': '80% split (90% after scaling) — fee refunded on 1st payout',
    '80% split — délai 14j': '80% split — 14-day delay',
    '90% split dès le départ — fee remboursé au 1er payout': '90% split from the start — fee refunded on 1st payout',
    '90/10 split — instant funded, min $500/cycle, pas de 8j wait': '90/10 split — instant funded, min $500/cycle, no 8-day wait',
    '90/10 split — min 5 profitable days/cycle, min $500 payout, processing 2j': '90/10 split — min 5 profitable days/cycle, min $500 payout, 2-day processing',
    '90/10 split — payout tous les 3 jours possible, one-day pass potential': '90/10 split — payout every 3 days possible, one-day pass potential',
    "Combine $49/mois — Live Funded DLL $2K — 50% premiers profits jusqu'à 30j, puis 100% (max $5K), 5j gagnants min": 'Combine $49/mo — Live Funded DLL $2K — 50% of first profits up to 30 days, then 100% (max $5K), 5 winning days min',
    "Combine $99/mois — Live Funded DLL $3K — 50% premiers profits jusqu'à 30j, puis 100% (max $10K), 5j gagnants min": 'Combine $99/mo — Live Funded DLL $3K — 50% of first profits up to 30 days, then 100% (max $10K), 5 winning days min',
    "Combine $149/mois — Live Funded DLL $4.5K — 50% premiers profits jusqu'à 30j, puis 100% (max $15K), 5j gagnants min": 'Combine $149/mo — Live Funded DLL $4.5K — 50% of first profits up to 30 days, then 100% (max $15K), 5 winning days min',
    'PA $119 — 5 trading days, max 20 comptes': 'PA $119 — 5 trading days, max 20 accounts',
    'PA $129 — 5 trading days, max 20 comptes': 'PA $129 — 5 trading days, max 20 accounts',
    'PA $149 — 5 trading days, max 20 comptes': 'PA $149 — 5 trading days, max 20 accounts',
    'PA $169 — 5 trading days, max 20 comptes': 'PA $169 — 5 trading days, max 20 accounts',
    // brokers — speciality / pros / cons / bestFor
    'Futures + Actions + Options': 'Futures + Stocks + Options',
    'Le plus complet, accès direct CME/CBOE, marges institutionnelles': 'The most complete, direct CME/CBOE access, institutional margins',
    'Interface complexe au début, frais data $10/mois': 'Complex interface at first, $10/mo data fees',
    'Traders sérieux multi-actifs': 'Serious multi-asset traders',
    'CFD + Actions fractionnées': 'CFD + Fractional shares',
    'Commissions 0€, interface mobile-first, ISA/CTO': '0€ commissions, mobile-first interface, ISA/CTO',
    'Pas de futures CME, CFD only (réglementation ESMA)': 'No CME futures, CFD only (ESMA regulation)',
    'Débutants, swing trading, investissement long terme': 'Beginners, swing trading, long-term investing',
    'Multi-actifs (Futures, FX, Actions)': 'Multi-asset (Futures, FX, Stocks)',
    'Réglementation FR/EU stricte, plateforme SaxoTraderGO solide': 'Strict FR/EU regulation, solid SaxoTraderGO platform',
    'Frais data + commissions plus élevés que IB': 'Higher data fees + commissions than IB',
    'Traders EU qui veulent un broker régulé localement': 'EU traders wanting a locally-regulated broker',
    'Actions + ETF (pas de futures CME)': 'Stocks + ETF (no CME futures)',
    'Frais très bas, populaire en France, FR/NL régulé': 'Very low fees, popular in France, FR/NL regulated',
    'Pas de futures américains, pas idéal pour day trading': 'No US futures, not ideal for day trading',
    'Investisseurs long terme en actions/ETF': 'Long-term stock/ETF investors',
    // crypto
    '1× à 125× selon la paire': '1× to 125× depending on pair',
    'Auto à -100% margin maintenance': 'Auto at -100% maintenance margin',
    'Withdrawal direct, frais réseau selon coin': 'Direct withdrawal, network fees per coin',
    'Tarif Regular (sans BNB discount, sans niveau VIP)': 'Regular tier (no BNB discount, no VIP level)',
    'Tarif Coinbase Advanced (Coinbase One = 0%/0.6%)': 'Coinbase Advanced tier (Coinbase One = 0%/0.6%)',
    '1× (spot uniquement — pas de leverage)': '1× (spot only — no leverage)',
    'N/A (spot)': 'N/A (spot)',
    'Withdrawal SEPA (gratuit) ou wire ($25), 1-3j': 'SEPA withdrawal (free) or wire ($25), 1-3 days',
    'KYC niveau 1 minimum (passport + selfie)': 'KYC level 1 minimum (passport + selfie)',
    'KYC complet obligatoire (ID + adresse + selfie)': 'Full KYC required (ID + address + selfie)',
  };
  function tR(s) { return (i18n.getLang() === 'en' && DATA_EN[s]) ? DATA_EN[s] : s; }

  function renderMyAccountsSettings() {
    const el = $('settingsMyAccounts');

    function render() {
      const myAccs = Store.getMyAccounts();
      const types  = Store.getAccountTypes();

      const listHtml = myAccs.length
        ? myAccs.map(a => {
            const tp = types.find(tp => tp.id === a.typeId) || {};
            const balance = a.capital + (a.pnlOffset || 0);
            const balColor = (a.pnlOffset || 0) < 0 ? 'color:var(--red)' : (a.pnlOffset || 0) > 0 ? 'color:var(--green)' : '';
            return `
              <div class="ma-row">
                <span class="ma-badge ${STATUS_BADGE[a.status] || 'ma-eval'}">${STATUS_LABEL[a.status] || '?'}</span>
                <span class="ma-name">${UI.escHtml(a.name)}</span>
                <span class="ma-preset">${UI.escHtml(tp.name || '—')}</span>
                <span class="ma-stat" style="${balColor}" title="Capital : $${Number(a.capital).toLocaleString('fr-FR')}">$${Number(balance).toLocaleString('fr-FR')}</span>
                <span class="ma-stat" style="color:var(--green)">TP +$${Number(a.profitTarget) || 0}</span>
                <span class="ma-stat" style="color:var(--red)">DD -$${Number(a.maxDrawdown) || 0}</span>
                <div class="ma-actions">
                  <button class="btn-ghost" style="padding:3px 10px;font-size:11px" data-ma-edit="${UI.escHtml(a.id)}">${t('btn.edit')}</button>
                  <button class="btn-ghost btn-danger" style="padding:3px 10px;font-size:11px" data-ma-del="${UI.escHtml(a.id)}">${t('btn.delete')}</button>
                </div>
              </div>`;
          }).join('')
        : `<p style="color:var(--muted);font-size:12px;padding:8px 0" data-i18n-html="set.acc.empty">
             ${t('set.acc.empty')}
           </p>`;

      const FIRM_LABELS = { apex: 'Apex Trader Funding', topstep: 'Topstep', ftmo: 'FTMO (2-Step)', ftmo1step: 'FTMO 1-Step', lucid: 'Lucid Trading', fpips: 'Funding Pips' };
      const byFirm = {};
      types.forEach(tp => {
        const fk = tp.firmKey || tp.id.split('-')[0] || 'other';
        if (!byFirm[fk]) byFirm[fk] = [];
        byFirm[fk].push(tp);
      });
      const typeOptions = Object.entries(byFirm).map(([fk, tps]) =>
        `<optgroup label="${FIRM_LABELS[fk] || fk}">${tps.map(tp =>
          `<option value="${tp.id}">${UI.escHtml(tp.name)}</option>`
        ).join('')}</optgroup>`
      ).join('');

      // v0.9.307 : options « Type de compte » générées ICI depuis le profil de trading
      // (Store.getTradingTypes) → le sélecteur reflète le profil dès le rendu, pas
      // seulement au clic « + Ajouter ». Profil vide → tous les types (défaut).
      const _accTypeAll = [
        { value: 'prop',     tt: 'propFirm', label: 'Prop firm — Apex, Topstep, FTMO, Lucid, Funding Pips' },
        { value: 'personal', tt: 'fundsOwn', label: 'Fonds propres — mon capital, sans règles prop firm' },
        { value: 'crypto',   tt: 'crypto',   label: 'Crypto — Binance / Coinbase' },
      ];
      const _ttNow = (Store.getTradingTypes && Store.getTradingTypes()) || [];
      const _accTypeShown = _accTypeAll.filter(o => !_ttNow.length || _ttNow.includes(o.tt));
      const _accTypeOptionsHtml = _accTypeShown
        .map(o => `<option value="${o.value}">${o.label}</option>`).join('');
      // v0.9.308 : « Strict + raccourci » — si des types sont masqués par le profil,
      // on affiche un lien vers l'éditeur de profil (onglet Général) pour en activer
      // un autre → plus de blocage (ex. impossible de créer un compte crypto).
      const _someTypesHidden = _accTypeShown.length < _accTypeAll.length;
      const _hintNeed = i18n.getLang() === 'en' ? 'Need another account type?' : 'Besoin d\'un autre type de compte ?';
      const _hintLink = i18n.getLang() === 'en' ? 'Enable it in your profile →' : 'Active-le dans ton profil →';
      const _accTypeHintHtml = _someTypesHidden
        ? `<div style="font-size:11px;color:var(--muted);margin:-4px 0 12px 0">${_hintNeed} <button type="button" id="btnEditProfileTypes" style="background:none;border:none;color:var(--accent);cursor:pointer;font:inherit;padding:0;text-decoration:underline">${_hintLink}</button></div>`
        : '';

      el.innerHTML = `
        <div class="settings-section settings-section--wide">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div style="display:flex;align-items:center;gap:8px">
              <h3 style="margin:0">${t('set.accounts')}</h3>
              ${!Store.isPro()
                ? `<span class="plan-badge plan-basic" style="font-size:9px">Trader · 1 max</span>`
                : `<span style="font-size:11px;color:var(--muted);font-weight:500" title="${t('set.accounts')}">${myAccs.length}/${Store.getLimits().maxAccounts === Infinity ? '∞' : Store.getLimits().maxAccounts}</span>`}
            </div>
            <button class="btn-ghost" id="btnAddMyAccount">${t('set.acc.add')}</button>
          </div>

          <div id="maList">${listHtml}</div>

          <div id="maForm" style="display:none;margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted2);margin-bottom:14px" id="maFormTitle">${t('set.acc.new')}</div>
            <input type="hidden" id="maEditId">

            <!-- v0.9.189 (Phase 1) + v0.9.190 (Phase 3 : crypto activé) -->
            <div class="form-field" style="margin-bottom:12px">
              <label class="form-label">${t('set.acc.typefield')}</label>
              <select class="form-input" id="maAccountType">
                ${_accTypeOptionsHtml}
              </select>
            </div>
            ${_accTypeHintHtml}

            <!-- v0.9.190 : champs crypto spécifiques (visible uniquement si accountType === 'crypto') -->
            <div class="maCryptoOnly" style="display:none;background:rgba(140,140,150,0.05);border:1px solid rgba(140,140,150,0.2);border-radius:8px;padding:12px 14px;margin-bottom:14px">
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--accent-l);margin-bottom:10px;font-weight:600">Paramètres crypto</div>
              <div class="form-grid" style="grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px">
                <div class="form-field">
                  <label class="form-label">${t('set.acc.platform')}</label>
                  <select class="form-input" id="maCryptoPlatform">
                    <option value="binance">Binance</option>
                    <option value="coinbase">Coinbase</option>
                  </select>
                </div>
                <div class="form-field">
                  <label class="form-label">${t('set.acc.mode')}</label>
                  <select class="form-input" id="maCryptoMode">
                    <option value="spot">Spot</option>
                    <option value="perpetual">Perpetual (futures)</option>
                  </select>
                </div>
                <div class="form-field">
                  <label class="form-label">Leverage</label>
                  <input class="form-input mono" type="number" id="maLeverage" placeholder="1" min="1" max="125">
                </div>
              </div>
              <div class="form-grid form-grid-2" style="gap:10px">
                <div class="form-field">
                  <label class="form-label">Fee maker (%)</label>
                  <input class="form-input mono" type="number" step="0.001" id="maFeeMakerPct" placeholder="0.02">
                </div>
                <div class="form-field">
                  <label class="form-label">Fee taker (%)</label>
                  <input class="form-input mono" type="number" step="0.001" id="maFeeTakerPct" placeholder="0.05">
                </div>
              </div>
              <p style="font-size:11px;color:var(--muted);margin-top:8px;line-height:1.4">Defaults : Binance Futures 0.02/0.05%, Coinbase 0.40/0.60%. Saisis tes vraies fees selon ton niveau VIP / abonnement.</p>
            </div>

            <div class="form-grid form-grid-2" style="margin-bottom:10px">
              <div class="form-field">
                <label class="form-label">${t('set.acc.name')}</label>
                <input class="form-input" type="text" id="maName" placeholder="ex: APEX-001 ou Mon compte perso">
              </div>
              <div class="form-field" id="maStatusWrap">
                <label class="form-label">${t('set.acc.status')}</label>
                <select class="form-input" id="maStatus">
                  <option value="evaluation">${t('set.acc.eval')}</option>
                  <option value="funded">${t('set.acc.funded')}</option>
                </select>
              </div>
            </div>

            ${Store.isPro()
              ? `<div class="form-field" id="maTypeIdWrap" style="margin-bottom:12px">
                  <label class="form-label">${t('set.acc.type')}</label>
                  <select class="form-input" id="maTypeId">
                    <option value="">${t('set.acc.type.ph')}</option>
                    ${typeOptions}
                  </select>
                </div>`
              : `<div class="form-field" style="margin-bottom:12px">
                  <label class="form-label" style="display:flex;align-items:center;gap:6px">
                    ${t('set.acc.type')}
                    <span class="plan-badge plan-pro">FUNDED</span>
                  </label>
                  <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--bg3);border:1.5px solid rgba(140,140,150,0.2);border-radius:8px;cursor:pointer" id="btnUnlockPreset">
                    <span style="display:inline-flex;color:var(--accent-l)">${Icons.svg('lock',15)}</span>
                    <span style="font-size:12px;color:var(--muted);flex:1">${i18n.getLang()==='en'
                      ? 'Apex, Topstep, FTMO, Lucid presets — Funded / Elite only. Fill manually below.'
                      : 'Presets Apex, Topstep, FTMO, Lucid — réservés aux plans Funded / Elite. Remplissez manuellement ci-dessous.'
                    }</span>
                    <span style="font-size:10px;font-weight:700;color:var(--accent-l);white-space:nowrap">${i18n.getLang()==='en' ? 'See plans →' : 'Voir les offres →'}</span>
                  </div>
                  <input type="hidden" id="maTypeId" value="">
                </div>`
            }

            <div class="form-grid" style="grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
              <div class="form-field">
                <label class="form-label">${t('set.acc.capital')}</label>
                <input class="form-input mono" type="number" id="maCapital" placeholder="50000">
              </div>
              <!-- v0.9.189 : champs prop firm wrapped, hidden si Personnel/Crypto -->
              <div class="form-field maPropOnly">
                <label class="form-label">${t('set.acc.target')}</label>
                <input class="form-input mono" type="number" id="maProfitTarget">
              </div>
              <div class="form-field maPropOnly">
                <label class="form-label">${t('set.acc.drawdown')}</label>
                <input class="form-input mono" type="number" id="maMaxDrawdown">
              </div>
              <div class="form-field maPropOnly">
                <label class="form-label">${t('set.acc.daily')}</label>
                <input class="form-input mono" type="number" id="maDailyLoss">
              </div>
              <div class="form-field maPropOnly">
                <label class="form-label">${t('set.acc.contracts')}</label>
                <input class="form-input mono" type="number" id="maMaxContracts">
              </div>
              <div class="form-field">
                <label class="form-label">${t('set.acc.fee')}</label>
                <input class="form-input mono" type="number" step="0.01" id="maFeePerSide">
              </div>
            </div>

            <div style="background:rgba(99,102,241,0.07);border:1px solid rgba(99,102,241,0.2);border-radius:8px;padding:12px 14px;margin-bottom:14px">
              <div class="form-field">
                <label class="form-label" style="color:var(--indigo,#6366f1)">${t('set.acc.pnloffset')} <span style="font-weight:400;color:var(--muted);font-size:10px">${t('set.acc.optional')}</span></label>
                <input class="form-input mono" type="number" step="1" id="maPnlOffset" placeholder="0" style="max-width:160px">
                <p style="font-size:11px;color:var(--muted);margin-top:5px">${t('set.acc.pnloffset.desc')}</p>
              </div>
            </div>

            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button class="btn-ghost" id="maBtnCancel">${t('set.acc.cancel')}</button>
              <button class="btn-primary" id="maBtnSave">${t('set.acc.save')}</button>
            </div>
          </div>
        </div>`;

      // v0.9.366 — section « Comptes passés » (évals validées, archivées, lecture seule).
      // Leurs trades restent dans l'historique ; le P&L final est recalculé depuis ces trades.
      const _archived = (Store.getArchivedAccounts && Store.getArchivedAccounts()) || [];
      if (_archived.length) {
        const _allTrades = Store.getTrades();
        const _rows = _archived
          .sort((a, b) => (b.archivedAt || 0) - (a.archivedAt || 0))
          .map(a => {
            const accTrades = _allTrades.filter(tr => tr.apex === a.name);
            const st  = UI.statsForTrades ? UI.statsForTrades(accTrades) : { totalPnl: 0 };
            const pnl = (st.totalPnl || 0) + (a.pnlOffset || 0);
            const dt  = a.archivedAt ? new Date(a.archivedAt).toLocaleDateString('fr-FR') : '';
            return `<div class="ma-row" style="opacity:.9">
              <span class="ma-badge" style="background:var(--green-dim);color:var(--green)">✓ ${t('set.acc.passed.badge') || 'PASSÉ'}</span>
              <span class="ma-name">${UI.escHtml(a.name)}</span>
              <span class="ma-stat" style="color:var(--muted)">${dt}</span>
              <span class="ma-stat" title="${t('set.acc.passed.pnl') || 'P&L final'}" style="color:${pnl >= 0 ? 'var(--green)' : 'var(--red)'}">${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toLocaleString('fr-FR', { maximumFractionDigits: 0 })}</span>
            </div>`;
          }).join('');
        el.insertAdjacentHTML('beforeend', `
          <div class="settings-section settings-section--wide" style="margin-top:16px">
            <h3 style="margin:0 0 4px">${t('set.acc.passed') || 'Comptes passés'}</h3>
            <p style="font-size:11px;color:var(--muted);margin:0 0 12px">${t('set.acc.passed.hint') || 'Comptes d\'évaluation validés et archivés. Leurs trades restent dans ton historique.'}</p>
            ${_rows}
          </div>`);
      }

      $('btnAddMyAccount').addEventListener('click', () => {
        if (!Store.canAddAccount()) {
          const isEn = i18n.getLang() === 'en';
          const tier = Store.getTier();
          const limit = Store.getLimits().maxAccounts;
          const tierLabel = tier === 'trader' ? 'Trader' : tier === 'funded' ? 'Funded' : 'Elite';
          const nextTier = tier === 'trader' ? 'Funded (3 comptes)' : 'Elite (comptes illimités)';
          // v0.9.296 (#audit) : feedback CLAIR au clic quand la limite est atteinte.
          // Avant : un 2e clic SUPPRIMAIT le bandeau → impression de « rien ne se passe ».
          // Maintenant : on affiche (ou réutilise) le bandeau, on scrolle dessus + toast.
          let banner = document.getElementById('accLimitBanner');
          if (!banner) {
            banner = document.createElement('div');
            banner.id = 'accLimitBanner';
            banner.className = 'upgrade-inline';
            banner.style.marginTop = '12px';
            banner.innerHTML = `
              <div class="upgrade-inline-icon">${Icons.svg('lock',20)}</div>
              <div class="upgrade-inline-body">
                <div class="upgrade-inline-title">${isEn
                  ? `Account limit reached (${limit} on ${tierLabel})`
                  : `Limite atteinte (${limit} compte${limit > 1 ? 's' : ''} sur ${tierLabel})`}</div>
                <div class="upgrade-inline-sub">${isEn
                  ? `Upgrade to ${nextTier} to manage more challenges at once.`
                  : `Passe au plan ${nextTier} pour gérer plus de comptes simultanément.`}</div>
              </div>
              <button class="upgrade-inline-btn" id="btnUpgradeAccounts">${isEn ? 'Upgrade →' : 'Voir les offres →'}</button>`;
            document.getElementById('maList').after(banner);
            document.getElementById('btnUpgradeAccounts').addEventListener('click', () => {
              document.querySelector('[data-page="offers"]').click();
            });
          }
          banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
          UI.toast(isEn
            ? `Account limit reached (${limit} on ${tierLabel}) — see Offers to upgrade.`
            : `Limite atteinte (${limit} compte${limit > 1 ? 's' : ''} sur ${tierLabel}) — passe à ${nextTier}.`, true);
          return;
        }
        $('maFormTitle').textContent = t('set.acc.new');
        $('maEditId').value = '';
        $('maName').value = ''; $('maStatus').value = 'evaluation';
        $('maTypeId').value = '';
        $('maCapital').value = ''; $('maProfitTarget').value = '';
        $('maMaxDrawdown').value = ''; $('maDailyLoss').value = '';
        $('maMaxContracts').value = ''; $('maFeePerSide').value = '2.14';
        $('maPnlOffset').value = '';
        if ($('maAccountType')) {
          // v0.9.305 : ne propose QUE les types du profil ; v0.9.275 : défaut intelligent
          _buildAccountTypeOptions(null);
          const _tt = (Store.getTradingTypes && Store.getTradingTypes()) || [];
          $('maAccountType').value = (!_tt.length || _tt.includes('propFirm')) ? 'prop'
                                   : _tt.includes('fundsOwn') ? 'personal' : 'crypto';
        }
        _applyAccountTypeVisibility();
        $('maForm').style.display = 'block';
        $('maName').focus();
      });

      // v0.9.305/307 : restreint les types de compte au PROFIL de trading choisi
      // (réutilise _accTypeAll défini plus haut). Profil vide → tous. En édition, on
      // garde TOUJOURS le type du compte édité (sinon on casserait un compte dont le
      // type a été retiré du profil après coup).
      function _buildAccountTypeOptions(currentValue) {
        const sel = $('maAccountType'); if (!sel) return;
        const tt = (Store.getTradingTypes && Store.getTradingTypes()) || [];
        const allowAll = !tt.length;
        const opts = _accTypeAll.filter(o => allowAll || tt.includes(o.tt) || o.value === currentValue);
        sel.innerHTML = (opts.length ? opts : _accTypeAll)
          .map(o => `<option value="${o.value}">${o.label}</option>`).join('');
      }

      // v0.9.189 (Phase 1) + v0.9.190 (Phase 3) : show/hide des champs selon accountType
      function _applyAccountTypeVisibility() {
        const at = $('maAccountType') ? $('maAccountType').value : 'prop';
        const isProp   = at === 'prop';
        const isCrypto = at === 'crypto';
        // Champs prop-only : hide si Personnel/Crypto
        document.querySelectorAll('.maPropOnly').forEach(el => {
          el.style.display = isProp ? '' : 'none';
        });
        // Champs crypto-only : visible uniquement si crypto
        document.querySelectorAll('.maCryptoOnly').forEach(el => {
          el.style.display = isCrypto ? '' : 'none';
        });
        // Preset selector + status (eval/funded) : prop only
        const typeIdWrap = $('maTypeIdWrap');
        if (typeIdWrap) typeIdWrap.style.display = isProp ? '' : 'none';
        const statusWrap = $('maStatusWrap');
        if (statusWrap) statusWrap.style.display = isProp ? '' : 'none';
        // Crypto : pré-remplir defaults si vides
        if (isCrypto) {
          const platform = $('maCryptoPlatform') ? $('maCryptoPlatform').value : 'binance';
          if ($('maFeeMakerPct') && !$('maFeeMakerPct').value) {
            $('maFeeMakerPct').value = platform === 'coinbase' ? '0.40' : '0.02';
          }
          if ($('maFeeTakerPct') && !$('maFeeTakerPct').value) {
            $('maFeeTakerPct').value = platform === 'coinbase' ? '0.60' : '0.05';
          }
          if ($('maLeverage') && !$('maLeverage').value) {
            $('maLeverage').value = '1';
          }
        }
      }
      // Sync defaults fees quand l'user change de plateforme
      if ($('maCryptoPlatform')) {
        $('maCryptoPlatform').addEventListener('change', () => {
          const platform = $('maCryptoPlatform').value;
          $('maFeeMakerPct').value = platform === 'coinbase' ? '0.40' : '0.02';
          $('maFeeTakerPct').value = platform === 'coinbase' ? '0.60' : '0.05';
        });
      }
      if ($('maAccountType')) {
        $('maAccountType').addEventListener('change', _applyAccountTypeVisibility);
      }
      // v0.9.308 : raccourci « Active-le dans ton profil » → onglet Général + scroll
      if ($('btnEditProfileTypes')) {
        $('btnEditProfileTypes').addEventListener('click', () => {
          const genTab = document.querySelector('[data-settings-tab="general"]');
          if (genTab) genTab.click();
          setTimeout(() => {
            const target = document.querySelector('.set-tp-choice') || $('btnSaveProfile');
            const box = target ? (target.closest('.settings-section') || target) : null;
            if (box && box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 120);
        });
      }

      // Preset auto-fill — Pro only (Basic has a hidden input, not a select)
      if (Store.isPro()) {
        $('maTypeId').addEventListener('change', () => {
          const tp = types.find(tp => tp.id === $('maTypeId').value);
          if (!tp) return;
          $('maCapital').value      = tp.capital;
          $('maProfitTarget').value = tp.profitTarget;
          $('maMaxDrawdown').value  = tp.maxDrawdown;
          $('maDailyLoss').value    = tp.dailyLossLimit;
          $('maMaxContracts').value = tp.maxContracts;
          $('maFeePerSide').value   = (tp.feePerSide || 2.14).toFixed(2);
        });
      } else {
        const lockPreset = $('btnUnlockPreset');
        if (lockPreset) lockPreset.addEventListener('click', () => {
          document.querySelector('[data-page="offers"]').click();
        });
      }

      $('maBtnCancel').addEventListener('click', () => {
        $('maForm').style.display = 'none';
      });

      $('maBtnSave').addEventListener('click', () => {
        const name = $('maName').value.trim();
        if (!name) { UI.toast(t('err.name.required'), true); return; }
        if (name.length > 50) { UI.toast(t('err.name.invalid'), true); return; }

        const accountType = $('maAccountType') ? $('maAccountType').value : 'prop';
        const isProp   = accountType === 'prop';
        const isCrypto = accountType === 'crypto';
        const selType = isProp ? types.find(tp => tp.id === $('maTypeId').value) : null;
        const pnlOffsetRaw = $('maPnlOffset').value.trim();
        const data = {
          name,
          accountType,
          status:         isProp ? $('maStatus').value : 'funded',
          typeId:         isProp ? $('maTypeId').value : '',
          firmKey:        isProp ? (selType?.firmKey || ($('maTypeId').value.split('-')[0] || '')) : '',
          capital:        parseFloat($('maCapital').value)      || 50000,
          profitTarget:   isProp ? (parseFloat($('maProfitTarget').value) || 0) : 0,
          maxDrawdown:    isProp ? (parseFloat($('maMaxDrawdown').value)  || 0) : 0,
          dailyLossLimit: isProp ? (parseFloat($('maDailyLoss').value)    || 0) : 0,
          maxContracts:   isProp ? (parseInt($('maMaxContracts').value)   || 1) : 999,
          feePerSide:     parseFloat($('maFeePerSide').value)   || 2.14,
          pnlOffset:      pnlOffsetRaw !== '' ? (parseFloat(pnlOffsetRaw) || 0) : 0,
        };
        // v0.9.190 : champs crypto (Phase 3)
        if (isCrypto) {
          data.cryptoPlatform = $('maCryptoPlatform') ? $('maCryptoPlatform').value : 'binance';
          data.cryptoMode     = $('maCryptoMode')     ? $('maCryptoMode').value     : 'spot';
          data.leverage       = parseFloat($('maLeverage').value)     || 1;
          data.feeMakerPct    = parseFloat($('maFeeMakerPct').value)  || 0.02;
          data.feeTakerPct    = parseFloat($('maFeeTakerPct').value)  || 0.05;
        }

        const editId = $('maEditId').value;
        try {
          if (editId) {
            Store.updateMyAccount(editId, data);
            UI.toast(t('set.acc.updated'));
          } else {
            Store.addMyAccount(data);
            UI.toast(t('set.acc.added'));
          }
          render();
        } catch (e) {
          UI.toast(e.message || 'Erreur lors de la sauvegarde.', true);
        }
      });

      el.querySelectorAll('[data-ma-edit]').forEach(btn => {
        btn.addEventListener('click', () => {
          const acc = Store.getMyAccountById(btn.dataset.maEdit);
          if (!acc) return;
          $('maFormTitle').textContent = t('set.acc.edit');
          $('maEditId').value       = acc.id;
          $('maName').value         = acc.name;
          $('maStatus').value       = acc.status;
          $('maTypeId').value       = acc.typeId || '';
          $('maCapital').value      = acc.capital;
          $('maProfitTarget').value = acc.profitTarget;
          $('maMaxDrawdown').value  = acc.maxDrawdown;
          $('maDailyLoss').value    = acc.dailyLossLimit;
          $('maMaxContracts').value = acc.maxContracts;
          $('maFeePerSide').value   = (acc.feePerSide || 2.14).toFixed(2);
          $('maPnlOffset').value    = acc.pnlOffset || 0;
          // v0.9.189 : charger accountType (default 'prop' pour compatibilité comptes existants)
          if ($('maAccountType')) {
            _buildAccountTypeOptions(acc.accountType || 'prop');   // v0.9.305 : garde le type du compte édité
            $('maAccountType').value = acc.accountType || 'prop';
          }
          // v0.9.190 : charger les champs crypto si compte crypto
          if (acc.accountType === 'crypto') {
            if ($('maCryptoPlatform')) $('maCryptoPlatform').value = acc.cryptoPlatform || 'binance';
            if ($('maCryptoMode'))     $('maCryptoMode').value     = acc.cryptoMode || 'spot';
            if ($('maLeverage'))       $('maLeverage').value       = acc.leverage || 1;
            if ($('maFeeMakerPct'))    $('maFeeMakerPct').value    = acc.feeMakerPct != null ? acc.feeMakerPct : '';
            if ($('maFeeTakerPct'))    $('maFeeTakerPct').value    = acc.feeTakerPct != null ? acc.feeTakerPct : '';
          }
          _applyAccountTypeVisibility();
          $('maForm').style.display = 'block';
          $('maName').focus();
        });
      });

      el.querySelectorAll('[data-ma-del]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const acc = Store.getMyAccountById(btn.dataset.maDel);
          if (!acc) return;
          const ok = await UI.confirmModal({
            title:       t('confirm.acc.title') || 'Supprimer le compte',
            message:     t('confirm.acc.delete'),
            confirmText: t('btn.delete') || 'Supprimer',
            cancelText:  t('btn.cancel') || 'Annuler',
            danger:      true,
          });
          if (!ok) return;
          Store.deleteMyAccount(btn.dataset.maDel);
          render();
          UI.toast(t('set.acc.deleted'));
        });
      });
    }

    render();
  }

  function renderPropFirmsSettings() {
    const el = $('settingsPropFirms');
    if (!el) return;

    const firms      = Store.getPropFirms();
    const FIRM_ORDER = ['apex', 'topstep', 'ftmo', 'ftmo1step', 'lucid', 'fpips'];

    function ddBadge(type) {
      if (!type) return '';
      const lc = type.toLowerCase();
      if (lc.includes('statique') || lc.includes('static'))
        return `<span class="ac-badge" style="background:var(--border);color:var(--muted)">STATIC</span>`;
      if (lc.includes('trailing'))
        return `<span class="ac-badge" style="background:rgba(99,102,241,0.15);color:var(--accent)">TRAIL</span>`;
      if (lc.includes('intraday'))
        return `<span class="ac-badge" style="background:rgba(255,160,50,0.15);color:#f0a030">INTRA</span>`;
      return `<span class="ac-badge">EOD</span>`;
    }

    function mono(val, color) {
      return `<span style="font-family:'Geist Mono',monospace;font-size:12px;${color ? 'color:' + color : ''}">${val}</span>`;
    }

    function renderCards(key) {
      const firm = firms[key];
      if (!firm) return `<p style="color:var(--muted);font-size:12px">—</p>`;

      // v0.9.184 : si les comptes ont un `subType` (ex: Lucid Flex/Pro/Direct),
      // on les groupe par sous-type avec un header de section pour lisibilité.
      const hasSubTypes = firm.accounts.some(a => a.subType);
      const renderCard = a => `
        <div class="account-card">
          <div class="ac-header">
            <div style="display:flex;flex-direction:column;gap:2px;min-width:0;flex:1">
              <span class="ac-name" style="font-weight:700;font-size:13px">${UI.escHtml(a.size)}</span>
              ${a.subType ? `<span style="font-size:9px;color:var(--accent-l);font-weight:700;letter-spacing:0.7px;text-transform:uppercase">${UI.escHtml(a.subType)}</span>` : ''}
            </div>
            ${ddBadge(a.drawdownType)}
          </div>
          <div class="ac-field">
            <span class="ac-label">${t('set.pf.capital')}</span>
            ${mono('$' + Number(a.capital).toLocaleString('fr-FR'))}
          </div>
          <div class="ac-field">
            <span class="ac-label">${t('set.pf.target')}</span>
            ${mono('+$' + Number(a.profitTarget).toLocaleString('fr-FR'), 'var(--green)')}
          </div>
          <div class="ac-field">
            <span class="ac-label">${t('set.pf.drawdown')}</span>
            ${mono('-$' + Number(a.maxDrawdown).toLocaleString('fr-FR'), 'var(--red)')}
          </div>
          <div class="ac-field">
            <span class="ac-label">${t('set.pf.daily')}</span>
            ${a.dailyLossLimit
              ? mono('-$' + Number(a.dailyLossLimit).toLocaleString('fr-FR'), 'var(--red)')
              : `<span style="font-size:11px;color:var(--muted);font-style:italic">${i18n.getLang() === 'en' ? 'None' : 'Aucune'}</span>`}
          </div>
          <div class="ac-field">
            <span class="ac-label">${t('set.pf.dd.type')}</span>
            <span style="font-size:10px;color:var(--muted2);text-align:right;max-width:55%;line-height:1.3">${UI.escHtml(tR(a.drawdownType))}</span>
          </div>
          <div class="ac-field">
            <span class="ac-label">${t('set.pf.min.days')}</span>
            ${mono(a.minTradingDays || '0')}
          </div>
          <div class="ac-field">
            <span class="ac-label">${t('set.pf.consistency')}</span>
            <span style="font-size:10px;color:var(--muted2);text-align:right;max-width:55%;line-height:1.3">${UI.escHtml(tR(a.consistency))}</span>
          </div>
          <div class="ac-field" style="align-items:flex-start">
            <span class="ac-label" style="padding-top:2px">${t('set.pf.payout')}</span>
            <span style="font-size:10px;color:var(--muted2);text-align:right;max-width:58%;line-height:1.4">${UI.escHtml(tR(a.payoutConditions))}</span>
          </div>
        </div>
      `;

      // Mode groupé (Lucid avec sub-types : Flex / Pro / Direct)
      if (hasSubTypes) {
        const groups = {};
        const order  = [];
        firm.accounts.forEach(a => {
          const k = a.subType || 'Standard';
          if (!groups[k]) { groups[k] = []; order.push(k); }
          groups[k].push(a);
        });
        return order.map(sub => `
          <div class="pf-subgroup" style="margin-bottom:18px">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">
              <h4 style="margin:0;font-size:14px;font-weight:600;color:var(--text)">${UI.escHtml(firm.name)} ${UI.escHtml(sub)}</h4>
              <span style="font-size:10px;color:var(--muted2);text-transform:uppercase;letter-spacing:0.5px">${groups[sub].length} taille${groups[sub].length > 1 ? 's' : ''}</span>
            </div>
            <div class="accounts-grid">${groups[sub].map(renderCard).join('')}</div>
          </div>`).join('');
      }

      // Mode standard (1 grille pour toutes les tailles)
      return `<div class="accounts-grid">${firm.accounts.map(renderCard).join('')}</div>`;
    }

    function render(activeKey) {
      const en  = i18n.getLang() === 'en';
      const sel = new Set((Store.getSelectedFirms && Store.getSelectedFirms()) || []);
      const tabs = FIRM_ORDER
        .filter(k => firms[k])
        .map(k => `<button class="chip${activeKey === k ? ' active' : ''}" data-pf-tab="${k}">${UI.escHtml(firms[k].name)}</button>`)
        .join('');

      // v0.9.396 — « Mes prop firms » : sélection de l'user (selectedFirms). Alimente
      // ses comptes (presets pré-filtrés) + le filtre Focus app-wide. Toggle = save immédiat.
      const firmPills = FIRM_ORDER
        .filter(k => firms[k])
        .map(k => `<button type="button" class="instr-pill${sel.has(k) ? ' on' : ''}" data-myfirm="${k}">${UI.escHtml(firms[k].name)}</button>`)
        .join('');

      el.innerHTML = `
        <div class="settings-section">
          <h3 style="margin:0 0 4px">${en ? 'My prop firms' : 'Mes prop firms'}</h3>
          <p style="font-size:12px;color:var(--muted);margin:0 0 14px;line-height:1.5">
            ${en ? 'The prop firms you use. Powers your accounts and the Focus filter.' : 'Les prop firms que tu utilises. Alimente tes comptes et le filtre Focus.'}
            &nbsp;<strong style="color:var(--accent-l)">${sel.size}</strong> ${en ? 'selected' : 'sélectionnée(s)'}
          </p>
          <div class="instr-pills" id="myFirmPills">${firmPills}</div>
        </div>
        <div class="settings-section settings-section--wide">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
            <h3 style="margin:0">${t('set.pf.title')}</h3>
            <span style="font-size:10px;background:var(--border);color:var(--muted);padding:2px 8px;border-radius:99px;letter-spacing:0.06em">${t('set.apex.locked')}</span>
          </div>
          <div style="display:flex;gap:6px;margin:14px 0;flex-wrap:wrap">${tabs}</div>
          ${renderCards(activeKey)}
        </div>`;

      el.querySelectorAll('[data-myfirm]').forEach(btn => btn.addEventListener('click', () => {
        const k = btn.dataset.myfirm;
        const cur = new Set((Store.getSelectedFirms && Store.getSelectedFirms()) || []);
        if (cur.has(k)) cur.delete(k); else cur.add(k);
        Store.updateSettings({ selectedFirms: [...cur] });
        try { if (UI.refreshFocusScope) UI.refreshFocusScope(); } catch(e) {}
        render(activeKey);
      }));

      el.querySelectorAll('[data-pf-tab]').forEach(btn => {
        btn.addEventListener('click', () => render(btn.dataset.pfTab));
      });
    }

    render(FIRM_ORDER.find(k => firms[k]) || 'apex');
  }

  // v0.9.192 — Onglet Fonds propres : présentation du mode + courtiers + fiscalité
  function renderPersonalSettings() {
    const el = $('settingsPersonal');
    if (!el) return;

    const BROKERS = [
      {
        name:    'Interactive Brokers',
        url:     'https://www.interactivebrokers.com/',
        color:   '#d92228',
        speciality: 'Futures + Actions + Options',
        pros:    'Le plus complet, accès direct CME/CBOE, marges institutionnelles',
        cons:    'Interface complexe au début, frais data $10/mois',
        bestFor: 'Traders sérieux multi-actifs',
      },
      {
        name:    'Trading 212',
        url:     'https://www.trading212.com/',
        color:   '#00b14f',
        speciality: 'CFD + Actions fractionnées',
        pros:    'Commissions 0€, interface mobile-first, ISA/CTO',
        cons:    'Pas de futures CME, CFD only (réglementation ESMA)',
        bestFor: 'Débutants, swing trading, investissement long terme',
      },
      {
        name:    'Saxo Bank',
        url:     'https://www.home.saxo/',
        color:   '#003867',
        speciality: 'Multi-actifs (Futures, FX, Actions)',
        pros:    'Réglementation FR/EU stricte, plateforme SaxoTraderGO solide',
        cons:    'Frais data + commissions plus élevés que IB',
        bestFor: 'Traders EU qui veulent un broker régulé localement',
      },
      {
        name:    'DEGIRO',
        url:     'https://www.degiro.com/',
        color:   '#003663',
        speciality: 'Actions + ETF (pas de futures CME)',
        pros:    'Frais très bas, populaire en France, FR/NL régulé',
        cons:    'Pas de futures américains, pas idéal pour day trading',
        bestFor: 'Investisseurs long terme en actions/ETF',
      },
    ];

    function renderBrokerCard(b) {
      return `
        <div class="account-card" style="margin-bottom:14px">
          <div class="ac-header" style="margin-bottom:12px">
            <div>
              <div class="ac-name" style="font-weight:700;font-size:14px;color:${b.color}">${UI.escHtml(b.name)}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">${UI.escHtml(tR(b.speciality))}</div>
            </div>
            <a href="${b.url}" target="_blank" rel="noopener" class="ac-badge" style="background:${b.color}1f;color:${b.color};text-decoration:none">${t('set.cx.official')}</a>
          </div>
          <div class="ac-field" style="align-items:flex-start">
            <span class="ac-label" style="padding-top:2px;color:var(--green)">${t('set.br.pros')}</span>
            <span style="font-size:11px;color:var(--text2);text-align:right;max-width:65%;line-height:1.4">${UI.escHtml(tR(b.pros))}</span>
          </div>
          <div class="ac-field" style="align-items:flex-start">
            <span class="ac-label" style="padding-top:2px;color:var(--red)">${t('set.br.cons')}</span>
            <span style="font-size:11px;color:var(--text2);text-align:right;max-width:65%;line-height:1.4">${UI.escHtml(tR(b.cons))}</span>
          </div>
          <div class="ac-field" style="align-items:flex-start">
            <span class="ac-label" style="padding-top:2px">${t('set.br.bestfor')}</span>
            <span style="font-size:11px;color:var(--accent-l);text-align:right;max-width:65%;line-height:1.4">${UI.escHtml(tR(b.bestFor))}</span>
          </div>
        </div>`;
    }

    el.innerHTML = `
      <div class="settings-section settings-section--wide">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <h3 style="margin:0">${t('set.pf.ownfunds.title')}</h3>
          <span style="font-size:10px;background:var(--bg3);padding:3px 10px;border-radius:6px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px">${t('set.pf.freemode')}</span>
        </div>
        <p style="font-size:12.5px;color:var(--muted);line-height:1.55;margin-bottom:18px">${t('set.pf.ownfunds.desc')}</p>

        <!-- Bloc avantages/inconvénients -->
        <div class="form-grid form-grid-2" style="margin-bottom:18px">
          <div style="background:rgba(140,140,150,0.08);border:1px solid rgba(140,140,150,0.25);border-radius:8px;padding:14px 16px">
            <div style="font-size:11px;color:var(--green);font-weight:700;letter-spacing:0.4px;margin-bottom:8px">${t('set.pf.pros')}</div>
            <ul style="margin:0;padding-left:18px;font-size:12px;color:var(--text2);line-height:1.6">
              <li>${t('set.pf.pro.1')}</li>
              <li>${t('set.pf.pro.2')}</li>
              <li>${t('set.pf.pro.3')}</li>
              <li>${t('set.pf.pro.4')}</li>
              <li>${t('set.pf.pro.5')}</li>
            </ul>
          </div>
          <div style="background:rgba(248,81,73,0.08);border:1px solid rgba(248,81,73,0.25);border-radius:8px;padding:14px 16px">
            <div style="font-size:11px;color:var(--red);font-weight:700;letter-spacing:0.4px;margin-bottom:8px">${t('set.pf.cons')}</div>
            <ul style="margin:0;padding-left:18px;font-size:12px;color:var(--text2);line-height:1.6">
              <li>${t('set.pf.con.1')}</li>
              <li>${t('set.pf.con.2')}</li>
              <li>${t('set.pf.con.3')}</li>
              <li>${t('set.pf.con.4')}</li>
              <li>${t('set.pf.con.5')}</li>
            </ul>
          </div>
        </div>

        <!-- Courtiers recommandés -->
        <h4 style="margin:0 0 10px;font-size:13px;font-weight:600;color:var(--text)">${t('set.pf.brokers.title')}</h4>
        <p style="font-size:11px;color:var(--muted);margin-bottom:14px;line-height:1.5">${t('set.pf.brokers.desc')}</p>
        ${BROKERS.map(renderBrokerCard).join('')}

        <!-- Mention fiscale -->
        <div style="background:rgba(255,159,10,0.08);border:1px solid rgba(255,159,10,0.25);border-radius:8px;padding:14px 16px;margin-top:6px">
          <div style="font-size:11px;color:var(--amber);font-weight:700;letter-spacing:0.4px;margin-bottom:8px">${t('set.pf.tax.title')}</div>
          <div style="font-size:12px;color:var(--text2);line-height:1.6">
            ${t('set.pf.tax.1')}
            <br><br>
            ${t('set.pf.tax.2')}
            <br><br>
            <em style="color:var(--muted);font-size:11px">${t('set.pf.tax.note')}</em>
          </div>
        </div>

        <!-- Roadmap -->
        <div style="background:rgba(140,140,150,0.05);border:1px solid rgba(140,140,150,0.2);border-radius:8px;padding:14px 16px;margin-top:14px">
          <div style="font-size:11px;color:var(--accent-l);font-weight:600;letter-spacing:0.4px;margin-bottom:6px">ROADMAP</div>
          <div style="font-size:12px;color:var(--muted);line-height:1.55">
            ${t('set.pf.roadmap.desc')}
          </div>
        </div>
      </div>`;
  }

  // v0.9.191 — Onglet Crypto : référentiel des 2 plateformes supportées + paires + frais types
  function renderCryptoSettings() {
    const el = $('settingsCrypto');
    if (!el) return;

    const PLATFORMS = {
      binance: {
        name:    'Binance Futures',
        url:     'https://www.binance.com/en/futures/',
        color:   '#f0b90b',
        bgGlow:  'rgba(240,185,11,0.08)',
        mode:    'Perpetuals USDT-M',
        feeMaker: 0.02,
        feeTaker: 0.05,
        feeNote: 'Tarif Regular (sans BNB discount, sans niveau VIP)',
        leverage: '1× à 125× selon la paire',
        liquidation: 'Auto à -100% margin maintenance',
        pairs:    ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','AVAXUSDT','DOGEUSDT','LINKUSDT','DOTUSDT'],
        payouts:  'Withdrawal direct, frais réseau selon coin',
        kyc:      'KYC niveau 1 minimum (passport + selfie)',
      },
      coinbase: {
        name:    'Coinbase',
        url:     'https://www.coinbase.com/',
        color:   '#0052ff',
        bgGlow:  'rgba(0,82,255,0.08)',
        mode:    'Spot USD (Advanced Trade)',
        feeMaker: 0.40,
        feeTaker: 0.60,
        feeNote: 'Tarif Coinbase Advanced (Coinbase One = 0%/0.6%)',
        leverage: '1× (spot uniquement — pas de leverage)',
        liquidation: 'N/A (spot)',
        pairs:    ['BTC-USD','ETH-USD','SOL-USD','XRP-USD','AVAX-USD'],
        payouts:  'Withdrawal SEPA (gratuit) ou wire ($25), 1-3j',
        kyc:      'KYC complet obligatoire (ID + adresse + selfie)',
      },
    };

    function renderPlatformCard(key, p) {
      return `
        <div class="account-card" style="background:${p.bgGlow};border-color:${p.color}40;margin-bottom:18px">
          <div class="ac-header" style="margin-bottom:14px">
            <div>
              <div class="ac-name" style="font-weight:700;font-size:15px;color:${p.color}">${p.name}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">${p.mode}</div>
            </div>
            <a href="${p.url}" target="_blank" rel="noopener" class="ac-badge" style="background:${p.color}1f;color:${p.color};text-decoration:none">${t('set.cx.official')}</a>
          </div>
          <div class="ac-field">
            <span class="ac-label">Fee maker</span>
            <span style="font-family:'Geist Mono',monospace;font-size:12px;color:var(--green)">${p.feeMaker.toFixed(3)}%</span>
          </div>
          <div class="ac-field">
            <span class="ac-label">Fee taker</span>
            <span style="font-family:'Geist Mono',monospace;font-size:12px;color:var(--amber)">${p.feeTaker.toFixed(3)}%</span>
          </div>
          <div class="ac-field" style="align-items:flex-start">
            <span class="ac-label" style="padding-top:2px">${t('set.cx.pricing')}</span>
            <span style="font-size:10px;color:var(--muted2);text-align:right;max-width:60%;line-height:1.4">${UI.escHtml(tR(p.feeNote))}</span>
          </div>
          <div class="ac-field">
            <span class="ac-label">Leverage</span>
            <span style="font-size:11px;color:var(--text)">${UI.escHtml(tR(p.leverage))}</span>
          </div>
          <div class="ac-field">
            <span class="ac-label">Liquidation</span>
            <span style="font-size:11px;color:var(--text)">${UI.escHtml(tR(p.liquidation))}</span>
          </div>
          <div class="ac-field" style="align-items:flex-start">
            <span class="ac-label" style="padding-top:2px">Payouts</span>
            <span style="font-size:10px;color:var(--muted2);text-align:right;max-width:60%;line-height:1.4">${UI.escHtml(tR(p.payouts))}</span>
          </div>
          <div class="ac-field" style="align-items:flex-start">
            <span class="ac-label" style="padding-top:2px">KYC</span>
            <span style="font-size:10px;color:var(--muted2);text-align:right;max-width:60%;line-height:1.4">${UI.escHtml(tR(p.kyc))}</span>
          </div>
          <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.6px;color:var(--muted);font-weight:600;margin-bottom:8px">${t('set.cx.pairs')} (${p.pairs.length})</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${p.pairs.map(pair => `<span style="font-family:'Geist Mono',monospace;font-size:10.5px;padding:3px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text)">${pair}</span>`).join('')}
            </div>
          </div>
        </div>`;
    }

    el.innerHTML = `
      <div class="settings-section settings-section--wide">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <h3 style="margin:0">${t('set.cx.title')}</h3>
          <span style="font-size:10px;background:var(--bg3);padding:3px 10px;border-radius:6px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px">${t('set.cx.locked')}</span>
        </div>
        <p style="font-size:12.5px;color:var(--muted);line-height:1.5;margin-bottom:18px">${t('set.cx.desc')}</p>
        ${Object.entries(PLATFORMS).map(([k, p]) => renderPlatformCard(k, p)).join('')}
        <div style="background:rgba(140,140,150,0.05);border:1px solid rgba(140,140,150,0.2);border-radius:8px;padding:14px 16px;margin-top:6px">
          <div style="font-size:11px;color:var(--accent-l);font-weight:600;letter-spacing:0.4px;margin-bottom:6px">ROADMAP</div>
          <div style="font-size:12px;color:var(--muted);line-height:1.55">
            ${t('set.cx.roadmap')}
          </div>
        </div>
      </div>`;
  }

  function renderSpreadsSettings() {
    const el         = $('settingsSpreads');
    if (!el) return;
    const firms      = Store.getPropFirms();
    const FIRM_ORDER = ['apex', 'topstep', 'ftmo', 'ftmo1step', 'lucid', 'fpips'];

    function renderRows(firmKey) {
      const sp       = Store.getSpreadsByFirm(firmKey);
      const instrs   = Object.keys(sp);

      // Grouper par catégorie
      const groups = {};
      instrs.forEach(instr => {
        const cat = INSTR_CATEGORY[instr] || 'Autres';
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(instr);
      });

      return Object.entries(groups).map(([cat, list]) => `
        <div style="margin-bottom:4px">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.1em;color:var(--muted2);padding:10px 0 6px;font-weight:600">${UI.escHtml(cat)}</div>
          ${list.map(instr => {
            const safeInstr = UI.escHtml(instr);
            const val = (sp[instr] != null ? sp[instr] : 0).toFixed(2);
            return `
              <div class="settings-row" style="padding:5px 0">
                <label style="font-weight:600;font-family:'Geist Mono',monospace;font-size:12px">${safeInstr}</label>
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:11px;color:var(--muted)">$</span>
                  <input class="form-input" type="number" min="0" step="0.01"
                    data-sp-instr="${safeInstr}" value="${val}"
                    style="width:80px;text-align:right;font-family:'Geist Mono',monospace">
                  <span style="font-size:11px;color:var(--muted)">/side</span>
                </div>
              </div>`;
          }).join('')}
        </div>`
      ).join('');
    }

    function render(activeKey) {
      const tabs = FIRM_ORDER
        .filter(k => firms[k])
        .map(k => `<button class="chip${activeKey === k ? ' active' : ''}" data-sp-tab="${k}">${firms[k].name}</button>`)
        .join('');

      el.innerHTML = `
        <div class="settings-section" style="max-width:560px">
          <h3>${t('set.spreads.title')}</h3>
          <p style="font-size:11px;color:var(--muted);margin-bottom:12px">${t('set.spreads.hint')}</p>
          <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">${tabs}</div>
          <div id="spRows">${renderRows(activeKey)}</div>
          <div class="settings-row" style="margin-top:12px;border-top:none">
            <span></span>
            <button class="btn-primary" id="btnSaveSpreads">${t('btn.save')}</button>
          </div>
        </div>`;

      el.querySelectorAll('[data-sp-tab]').forEach(btn => {
        btn.addEventListener('click', () => render(btn.dataset.spTab));
      });

      $('btnSaveSpreads').addEventListener('click', () => {
        const data = Object.create(null);
        const validInstrs = new Set(Object.keys(Store.getSpreadsByFirm(activeKey)));
        el.querySelectorAll('[data-sp-instr]').forEach(input => {
          const k = input.dataset.spInstr;
          if (validInstrs.has(k)) data[k] = Math.max(0, parseFloat(input.value) || 0);
        });
        Store.updateSpreadsByFirm(activeKey, data);
        UI.toast(t('set.sp.saved'));
      });
    }

    render(FIRM_ORDER.find(k => firms[k]) || 'apex');
  }

  function renderGroupsSettings() {
    const el = $('settingsGroups');
    if (!el) return;

    // Gate: Groups are a Funded / Elite feature
    if (!Store.isPro()) {
      const isEn = i18n.getLang() === 'en';
      el.innerHTML = `
        <div class="settings-section settings-section--wide">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
            <h3 style="margin:0">${t('set.groups')}</h3>
            <span class="plan-badge plan-pro">FUNDED</span>
          </div>
          <div class="upgrade-inline">
            <div class="upgrade-inline-icon">⬡</div>
            <div class="upgrade-inline-body">
              <div class="upgrade-inline-title">${isEn ? 'Account groups — Funded / Elite feature' : 'Groupes de comptes — fonctionnalité Funded / Elite'}</div>
              <div class="upgrade-inline-sub">${isEn
                ? 'Group multiple accounts to analyze their combined performance on the Dashboard.'
                : 'Regroupez plusieurs comptes pour analyser leurs performances combinées sur le Dashboard.'}</div>
            </div>
            <button class="upgrade-inline-btn" id="btnUpgradeGroups">${isEn ? 'See plans →' : 'Voir les offres →'}</button>
          </div>
        </div>`;
      $('btnUpgradeGroups').addEventListener('click', () => {
        document.querySelector('[data-page="offers"]').click();
      });
      return;
    }

    function render() {
      const grps = Store.getGroups();
      const accs = Store.getMyAccounts();

      const listHtml = grps.length
        ? grps.map(g => {
            const names = (g.accountIds || [])
              .map(id => accs.find(a => a.id === id))
              .filter(Boolean)
              .map(a => UI.escHtml(a.name))
              .join(', ');
            return `<div class="grp-row">
              <span class="grp-name">⬡ ${UI.escHtml(g.name)}</span>
              <span class="grp-accounts">${names || '—'}</span>
              <div class="grp-actions">
                <button class="btn-ghost" style="padding:3px 10px;font-size:11px" data-grp-edit="${UI.escHtml(g.id)}">${t('btn.edit')}</button>
                <button class="btn-ghost btn-danger" style="padding:3px 10px;font-size:11px" data-grp-del="${UI.escHtml(g.id)}">${t('btn.delete')}</button>
              </div>
            </div>`;
          }).join('')
        : `<p style="color:var(--muted);font-size:12px;padding:8px 0">${t('set.grp.empty.hint')}</p>`;

      const checkboxes = accs.map(a =>
        `<label class="grp-check-row">
          <input type="checkbox" class="grp-acc-check" value="${a.id}">
          ${UI.escHtml(a.name)}
        </label>`
      ).join('');

      el.innerHTML = `
        <div class="settings-section settings-section--wide">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <h3 style="margin:0">${t('set.groups')}</h3>
            <button class="btn-ghost" id="btnAddGroup">${t('set.grp.add')}</button>
          </div>

          <div id="grpList">${listHtml}</div>

          <div id="grpForm" style="display:none;margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted2);margin-bottom:14px" id="grpFormTitle">${t('set.grp.new')}</div>
            <input type="hidden" id="grpEditId">
            <div class="form-field" style="margin-bottom:12px">
              <label class="form-label">${t('set.grp.name')}</label>
              <input class="form-input" type="text" id="grpName" placeholder="ex: Apex Principal">
            </div>
            <div class="form-field" style="margin-bottom:14px">
              <label class="form-label" style="margin-bottom:8px">${t('set.grp.accounts')}</label>
              <div class="grp-checkboxes">${checkboxes || `<span style="color:var(--muted);font-size:12px">${t('set.grp.no.accounts')}</span>`}</div>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button class="btn-ghost" id="grpBtnCancel">${t('set.grp.cancel')}</button>
              <button class="btn-primary" id="grpBtnSave">${t('set.grp.save')}</button>
            </div>
          </div>
        </div>`;

      $('btnAddGroup').addEventListener('click', () => {
        $('grpFormTitle').textContent = t('set.grp.new');
        $('grpEditId').value = '';
        $('grpName').value = '';
        el.querySelectorAll('.grp-acc-check').forEach(cb => cb.checked = false);
        $('grpForm').style.display = 'block';
        $('grpName').focus();
      });

      $('grpBtnCancel').addEventListener('click', () => {
        $('grpForm').style.display = 'none';
      });

      $('grpBtnSave').addEventListener('click', () => {
        const name = $('grpName').value.trim();
        if (!name) { UI.toast(t('err.grp.name'), true); return; }
        if (name.length > 50) { UI.toast(t('err.name.invalid'), true); return; }
        const accountIds = Array.from(el.querySelectorAll('.grp-acc-check:checked')).map(cb => cb.value);
        const editId = $('grpEditId').value;
        if (editId) {
          Store.updateGroup(editId, { name, accountIds });
          UI.toast(t('set.grp.updated'));
        } else {
          Store.addGroup({ name, accountIds });
          UI.toast(t('set.grp.added'));
        }
        render();
      });

      el.querySelectorAll('[data-grp-edit]').forEach(btn => {
        btn.addEventListener('click', () => {
          const g = Store.getGroupById(btn.dataset.grpEdit);
          if (!g) return;
          $('grpFormTitle').textContent = t('set.grp.edit');
          $('grpEditId').value = g.id;
          $('grpName').value   = g.name;
          el.querySelectorAll('.grp-acc-check').forEach(cb => {
            cb.checked = (g.accountIds || []).includes(cb.value);
          });
          $('grpForm').style.display = 'block';
          $('grpName').focus();
        });
      });

      el.querySelectorAll('[data-grp-del]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const g = Store.getGroupById(btn.dataset.grpDel);
          if (!g) return;
          const ok = await UI.confirmModal({
            title:       t('confirm.grp.title') || 'Supprimer le groupe',
            message:     t('confirm.grp.delete'),
            confirmText: t('btn.delete') || 'Supprimer',
            cancelText:  t('btn.cancel') || 'Annuler',
            danger:      true,
          });
          if (!ok) return;
          Store.deleteGroup(btn.dataset.grpDel);
          render();
          UI.toast(t('set.grp.deleted'));
        });
      });
    }

    render();
  }

  function _openExportPdfModal() {
    // Crée le modal dynamiquement (pas de pollution permanente du DOM)
    const existing = document.getElementById('exportPdfOverlay');
    if (existing) existing.remove();

    const today = new Date();
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fmtInput = (d) => d.toISOString().split('T')[0];

    const accounts = (Store.getMyAccounts && Store.getMyAccounts()) || [];
    const accountOptions = accounts
      .map(a => `<option value="${UI.escHtml(a.id)}">${UI.escHtml(a.name)}</option>`)
      .join('');

    const overlay = document.createElement('div');
    overlay.id = 'exportPdfOverlay';
    // v0.9.165 fix : ajout classe .open immédiate (CSS attend opacity:1 + pointer-events:all)
    overlay.className = 'modal-overlay open';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:1000;opacity:1;pointer-events:all';
    overlay.innerHTML = `
      <div class="modal-card" style="max-width:440px;width:90vw;padding:24px;background:var(--bg2);border-radius:12px;border:1px solid var(--border)">
        <h3 style="margin:0 0 6px;font-size:18px;color:var(--text)">${UI.escHtml(t('set.export.pdf.title') || 'Exporter les trades en PDF')}</h3>
        <p style="margin:0 0 18px;font-size:13px;color:var(--muted)">${UI.escHtml(t('set.export.pdf.subtitle') || 'Sélectionne la période et le compte (optionnel).')}</p>

        <div style="display:flex;gap:10px;margin-bottom:14px">
          <div style="flex:1">
            <label style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px">${UI.escHtml(t('set.export.pdf.start') || 'Du')}</label>
            <input type="date" id="expPdfStart" value="${fmtInput(monthAgo)}" style="width:100%;margin-top:4px;padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px">
          </div>
          <div style="flex:1">
            <label style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px">${UI.escHtml(t('set.export.pdf.end') || 'Au')}</label>
            <input type="date" id="expPdfEnd" value="${fmtInput(today)}" style="width:100%;margin-top:4px;padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px">
          </div>
        </div>

        <label style="display:block;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">${UI.escHtml(t('set.export.pdf.account') || 'Compte')}</label>
        <select id="expPdfAccount" style="width:100%;padding:8px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px">
          <option value="">${UI.escHtml(t('set.export.pdf.all') || 'Tous les comptes')}</option>
          ${accountOptions}
        </select>

        <div id="expPdfError" style="display:none;margin-top:12px;padding:8px 12px;background:rgba(248,81,73,0.1);border:1px solid rgba(248,81,73,0.3);border-radius:6px;color:var(--red);font-size:12px"></div>

        <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end">
          <button class="btn-ghost" id="btnExpPdfCancel">${UI.escHtml(t('btn.cancel') || 'Annuler')}</button>
          <button class="btn-primary" id="btnExpPdfGenerate">${UI.escHtml(t('set.export.pdf.btn') || 'Générer PDF')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    function close() { overlay.remove(); }
    $('btnExpPdfCancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); }
    });

    $('btnExpPdfGenerate').addEventListener('click', async () => {
      const startStr = $('expPdfStart').value;
      const endStr   = $('expPdfEnd').value;
      const acc      = $('expPdfAccount').value || null;
      const errEl    = $('expPdfError');
      errEl.style.display = 'none';

      if (!startStr || !endStr) {
        errEl.textContent = t('set.export.pdf.err.dates') || 'Sélectionne les deux dates.';
        errEl.style.display = '';
        return;
      }
      const startMs = new Date(startStr + 'T00:00:00').getTime();
      const endMs   = new Date(endStr   + 'T23:59:59').getTime();
      if (startMs > endMs) {
        errEl.textContent = t('set.export.pdf.err.order') || 'La date de début doit être avant la date de fin.';
        errEl.style.display = '';
        return;
      }

      const btn = $('btnExpPdfGenerate');
      const cancelBtn = $('btnExpPdfCancel');
      const originalLabel = btn.textContent;
      btn.disabled = true;
      cancelBtn.disabled = true;
      btn.textContent = t('set.export.pdf.loading') || 'Génération…';

      // v0.9.166 : crée un container de progression pour les screenshots
      let progressEl = document.getElementById('expPdfProgress');
      if (!progressEl) {
        progressEl = document.createElement('div');
        progressEl.id = 'expPdfProgress';
        progressEl.style.cssText = 'margin-top:14px;padding:12px 14px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.3);border-radius:8px;font-size:13px;color:var(--text)';
        errEl.parentNode.insertBefore(progressEl, errEl);
      }
      progressEl.style.display = '';
      progressEl.innerHTML = '<div style="display:flex;align-items:center;gap:10px"><span class="spinner" style="display:inline-block;width:14px;height:14px;border:2px solid rgba(140,140,150,0.3);border-top-color:var(--accent-l);border-radius:50%;animation:spin 0.8s linear infinite"></span><span id="expPdfProgressText">Préparation…</span></div><div style="margin-top:8px;background:rgba(255,255,255,0.05);height:4px;border-radius:2px;overflow:hidden"><div id="expPdfProgressBar" style="height:100%;width:0%;background:linear-gradient(90deg,var(--accent),var(--accent-l));transition:width 0.3s"></div></div>';
      // Inject CSS pour spinner (idempotent)
      if (!document.getElementById('expPdfProgressStyle')) {
        const style = document.createElement('style');
        style.id = 'expPdfProgressStyle';
        style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
        document.head.appendChild(style);
      }

      function onProgress(info) {
        const txt = document.getElementById('expPdfProgressText');
        const bar = document.getElementById('expPdfProgressBar');
        if (!txt) return;
        txt.textContent = info.message || '…';
        if (info.phase === 'screenshots' && info.total > 0) {
          bar.style.width = Math.round((info.current / info.total) * 100) + '%';
        } else if (info.phase === 'finalizing') {
          bar.style.width = '95%';
        } else if (info.phase === 'done') {
          bar.style.width = '100%';
        }
      }

      try {
        const result = await ExportPDF.generate({ startMs, endMs, accountId: acc, onProgress });
        const shotsMsg = result.screenshots > 0 ? ` + ${result.screenshots} screenshot(s)` : '';
        UI.toast(
          (t('set.export.pdf.ok') || 'PDF généré : %n trades sur %p pages.')
            .replace('%n', result.count)
            .replace('%p', result.pages) + shotsMsg
        );
        close();
      } catch (e) {
        errEl.textContent = e.message || (t('set.export.pdf.err.generic') || 'Échec de la génération.');
        errEl.style.display = '';
        progressEl.style.display = 'none';
        btn.disabled = false;
        cancelBtn.disabled = false;
        btn.textContent = originalLabel;
      }
    });
  }

  // v0.9.163 : Export PDF — direct binding (event delegation au top-level
  // échouait sur certains setups, cause inconnue, peut-être stopPropagation
  // upstream). Binding direct dans initSettings (comme CSV) → robuste.

  // v0.9.150 : toggle newsletter — lit depuis Auth.getConsentStatus() + écrit via Auth.setNewsletterOptIn()
  let _newsletterBound = false;
  async function _refreshNewsletterToggle() {
    try {
      const toggle = document.getElementById('toggleNewsletter');
      if (!toggle) return;
      const consent = await Auth.getConsentStatus();
      if (consent && !consent.error) {
        toggle.checked = !!consent.currentNewsletter;
      }
      if (_newsletterBound) return;
      _newsletterBound = true;
      toggle.addEventListener('change', async () => {
        const desired = toggle.checked;
        const original = !desired;
        toggle.disabled = true;
        const r = await Auth.setNewsletterOptIn(desired);
        toggle.disabled = false;
        if (r && r.ok) {
          UI.toast(desired
            ? (t('set.notif.newsletter.on') || 'Tu recevras les mises à jour par email.')
            : (t('set.notif.newsletter.off') || 'Plus d\'emails de mises à jour.'));
        } else {
          // rollback visuel
          toggle.checked = original;
          UI.toast('Erreur : ' + (r && r.error || 'inconnue'), true);
        }
      });
    } catch (e) {
      console.warn('[Settings] newsletter refresh failed:', e && e.message);
    }
  }

  // v0.9.358 (fix B-05) : masque l'email affiché (anti shoulder-surfing / screenshots).
  // pltn.aaronpro@free.fr → p••••@f••••.fr
  function _maskEmail(email) {
    const e = String(email || '');
    const at = e.indexOf('@');
    if (at < 1) return e;
    const local  = e.slice(0, at);
    const domain = e.slice(at + 1);
    const dot = domain.lastIndexOf('.');
    const maskedLocal = local[0] + '••••';
    if (dot < 1) return maskedLocal + '@' + (domain[0] || '') + '••••';
    return maskedLocal + '@' + domain[0] + '••••' + domain.slice(dot);
  }

  // v0.9.142 : vérification email — refresh statut + handlers via event delegation
  function _refreshEmailVerifyStatus() {
    try {
      const user = firebase.auth().currentUser;
      const statusEl = document.getElementById('emailVerifyStatus');
      const btnResend = document.getElementById('btnResendVerify');
      const btnCheck  = document.getElementById('btnCheckVerify');
      if (!statusEl || !btnResend || !btnCheck) return;
      if (!user) {
        statusEl.textContent = t('set.email.verify.unauth') || 'Non connecté';
        btnResend.style.display = 'none';
        btnCheck.style.display = 'none';
        return;
      }
      const email = _maskEmail(user.email || '');
      if (user.emailVerified) {
        // v0.9.148 fix : l'emoji ✅ est déjà dans la clé i18n, ne pas le doubler.
        // Et il faut interpoler {email} aussi dans ce cas (bug v0.9.142).
        const tplOk = t('set.email.verify.ok') ||
          '✅ Ton email ({email}) est vérifié. Tu as accès à toutes les fonctionnalités.';
        statusEl.innerHTML = '<span style="color:var(--green)">' +
          UI.escHtml(tplOk).replace('{email}', '<strong>' + UI.escHtml(email) + '</strong>') +
          '</span>';
        btnResend.style.display = 'none';
        btnCheck.style.display = 'none';
      } else {
        const tpl = t('set.email.verify.pending') ||
          '⚠ Email non vérifié — clique sur le lien envoyé à {email}, puis "J\'ai vérifié".';
        statusEl.innerHTML = '<span style="color:var(--amber)">' +
          UI.escHtml(tpl).replace('{email}', '<strong>' + UI.escHtml(email) + '</strong>') +
          '</span>';
        btnResend.style.display = '';
        btnCheck.style.display = '';
      }
    } catch (e) {
      console.warn('[Settings] emailVerify refresh failed:', e && e.message);
    }
  }

  document.body.addEventListener('click', async function (e) {
    // ─ Bouton "Renvoyer l'email" ─
    if (e.target.closest('#btnResendVerify')) {
      e.preventDefault();
      const user = firebase.auth().currentUser;
      if (!user) return;
      const btn = document.getElementById('btnResendVerify');
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = t('set.email.verify.sending') || 'Envoi…';
      try {
        // v0.9.284 : passe par le pipeline custom (CF → email stylé via Brevo).
        const r = await Auth.resendVerification();
        if (r && r.error) { const er = new Error(r.error); er.code = r.error; throw er; }
        UI.toast(t('set.email.verify.sent') ||
          'Email envoyé ! Vérifie ta boîte mail (et les spams).');
      } catch (err) {
        const code = err && err.code;
        if (code === 'auth/too-many-requests' || code === 'resource-exhausted' || code === 'functions/resource-exhausted') {
          UI.toast(t('set.email.verify.toomany') ||
            'Trop de tentatives. Attends quelques minutes avant de réessayer.', true);
        } else {
          UI.toast((t('set.email.verify.err') || 'Échec de l\'envoi : ') +
            (err && err.message || ''), true);
        }
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
      return;
    }
    // ─ Bouton "J'ai vérifié" → reload user state ─
    if (e.target.closest('#btnCheckVerify')) {
      e.preventDefault();
      const user = firebase.auth().currentUser;
      if (!user) return;
      const btn = document.getElementById('btnCheckVerify');
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = t('set.email.verify.checking') || 'Vérification…';
      try {
        await user.reload();
        _refreshEmailVerifyStatus();
        if (user.emailVerified) {
          UI.toast(t('set.email.verify.confirmed') || 'Email vérifié !');
        } else {
          UI.toast(t('set.email.verify.notyet') ||
            'Pas encore vérifié — clique sur le lien dans ton email.', true);
        }
      } catch (err) {
        UI.toast('Erreur : ' + (err && err.message || ''), true);
      } finally {
        btn.disabled = false;
        btn.textContent = originalText;
      }
      return;
    }
  });

  let _settingsBound = false;

  // v0.9.239 : sync visuel du toggle thème (3 boutons auto/dark/light)
  function _refreshThemeToggle() {
    if (typeof Theme === 'undefined') return;
    const current = Theme.get();
    document.querySelectorAll('#themeToggleGroup .theme-btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.themeChoice === current);
    });
  }

  // v0.9.394 — « Mes instruments » : sélection des instruments tradés. Alimente la
  // liste STRICTE de la modale de trade (favInstruments). Toggle = sauvegarde immédiate.
  const INSTRUMENT_CATALOG = [
    { cat: { fr: 'Futures CME — Indices', en: 'CME Futures — Indices' }, items: ['MES1','ES1','MNQ1','NQ1','MYM1','YM1','M2K1','RTY1','EMD1','NKD1'] },
    { cat: { fr: 'Futures CME — Métaux', en: 'CME Futures — Metals' }, items: ['MGC1','GC1','SI1','SIL1','PL1','PA1','HG1','MHG1'] },
    { cat: { fr: 'Futures CME — Énergie', en: 'CME Futures — Energy' }, items: ['MCL1','CL1','QM1','NG1','QG1','MNG1','RB1','HO1'] },
    { cat: { fr: 'Futures CME — Taux', en: 'CME Futures — Rates' }, items: ['ZN1','ZB1','ZF1','ZT1','UB1','TN1'] },
    { cat: { fr: 'Futures CME — Forex', en: 'CME Futures — FX' }, items: ['6E1','6B1','6J1','6C1','6A1','6S1','6N1','M6E1','M6B1','M6A1','E71','6M1'] },
    { cat: { fr: 'Futures CME — Agricole', en: 'CME Futures — Agricultural' }, items: ['ZS1','ZC1','ZW1','ZL1','ZM1','HE1','LE1','GF1'] },
    { cat: { fr: 'Futures CME — Crypto', en: 'CME Futures — Crypto' }, items: ['MBT1','MET1'] },
    { cat: { fr: 'CFD — Indices', en: 'CFD — Indices' }, items: ['US500','US100','US30','GER40','UK100'] },
    { cat: { fr: 'Forex (spot/CFD)', en: 'Forex (spot/CFD)' }, items: ['EURUSD','GBPUSD','USDJPY'] },
    { cat: { fr: 'CFD — Métaux / Énergie', en: 'CFD — Metals / Energy' }, items: ['XAUUSD','USOIL'] },
    { cat: { fr: 'Crypto perp', en: 'Crypto perp' }, items: ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','AVAXUSDT','DOGEUSDT','LINKUSDT','DOTUSDT'] },
    { cat: { fr: 'Crypto spot', en: 'Crypto spot' }, items: ['BTC-USD','ETH-USD','SOL-USD','XRP-USD','AVAX-USD'] },
  ];
  // v0.9.396 : exposé pour le wizard de setup obligatoire (app-bootstrap.js) — source unique.
  try { UI.INSTRUMENT_CATALOG = INSTRUMENT_CATALOG; } catch(e) {}
  function renderInstrumentsSettings() {
    const el = $('settingsInstruments');
    if (!el) return;
    const en = i18n.getLang() === 'en';
    function render() {
      const selected = new Set((Store.getSettings && Store.getSettings().favInstruments) || []);
      const blocks = INSTRUMENT_CATALOG.map(g => {
        const pills = g.items.map(sym =>
          `<button type="button" class="instr-pill${selected.has(sym) ? ' on' : ''}" data-sym="${sym}">${sym}</button>`).join('');
        return `<div class="instr-cat"><div class="instr-cat-label">${en ? g.cat.en : g.cat.fr}</div><div class="instr-pills">${pills}</div></div>`;
      }).join('');
      el.innerHTML = `
        <div class="settings-section">
          <h3 style="margin:0 0 4px">${en ? 'My instruments' : 'Mes instruments'}</h3>
          <p style="font-size:12px;color:var(--muted);margin:0 0 14px;line-height:1.5">
            ${en ? 'Pick the instruments you trade. Only these appear when logging a trade.' : 'Choisis les instruments que tu trades. Seuls ceux-ci apparaissent au moment de saisir un trade.'}
            &nbsp;<strong style="color:var(--accent-l)">${selected.size}</strong> ${en ? 'selected' : 'sélectionné(s)'}
          </p>
          ${blocks}
        </div>`;
      el.querySelectorAll('.instr-pill').forEach(b => b.addEventListener('click', () => {
        const sym = b.dataset.sym;
        const cur = new Set((Store.getSettings && Store.getSettings().favInstruments) || []);
        if (cur.has(sym)) cur.delete(sym); else cur.add(sym);
        Store.updateSettings({ favInstruments: [...cur] });
        render();
      }));
    }
    render();
  }

  UI.initSettings = function () {
    try { renderInstrumentsSettings(); } catch(e) { console.error('[Settings] instruments error:', e); }
    try { renderGroupsSettings(); }    catch(e) { console.error('[Settings] groups error:', e); }
    try { renderMyAccountsSettings(); } catch(e) { console.error('[Settings] accounts error:', e); }
    try { renderPropFirmsSettings(); }  catch(e) { console.error('[Settings] propfirms error:', e); }
    try { renderPersonalSettings(); }   catch(e) { console.error('[Settings] personal error:', e); }
    try { renderCryptoSettings(); }     catch(e) { console.error('[Settings] crypto error:', e); }
    // v0.9.313 : spreads MASQUÉS aux utilisateurs — on ne rend plus la section
    // (valeurs par défaut toujours appliquées au calcul P&L côté Store). Pour réactiver :
    // remettre `renderSpreadsSettings();`.
    try { const _spEl = $('settingsSpreads'); if (_spEl) { _spEl.style.display = 'none'; _spEl.innerHTML = ''; } } catch(e) {}

    // v0.9.275 (F1/F2) : adapte « Règles & marchés » au profil de trading.
    // Profil non renseigné (null) → on montre tout (défaut).
    try {
      const tt = (Store.getTradingTypes && Store.getTradingTypes()) || [];
      const showProp   = !tt.length || tt.includes('propFirm');
      const showCrypto = !tt.length || tt.includes('crypto');
      const showFunds  = !tt.length || tt.includes('fundsOwn');
      const _setVis = (id, show) => { const e = $(id); if (e) e.style.display = show ? '' : 'none'; };
      _setVis('settingsPropFirms', showProp);
      _setVis('settingsCrypto',    showCrypto);
      _setVis('settingsPersonal',  showFunds);
    } catch(e) { console.error('[Settings] tradingTypes adapt error:', e); }

    // v0.9.275 (F1/F2) : éditeur « Mon profil de trading » (modifiable à tout moment)
    (function setupProfileEditor() {
      const saveBtn = $('btnSaveProfile');
      if (!saveBtn) return;
      const current = (Store.getTradingTypes && Store.getTradingTypes()) || [];
      document.querySelectorAll('.set-tp-choice').forEach(c => { c.checked = current.includes(c.value); });
      if (saveBtn.dataset.bound) return;
      saveBtn.dataset.bound = '1';
      saveBtn.addEventListener('click', () => {
        const checked = [...document.querySelectorAll('.set-tp-choice:checked')].map(c => c.value);
        if (!checked.length) { UI.toast(i18n.getLang() === 'en' ? 'Pick at least one option.' : 'Choisis au moins une option.', true); return; }
        Store.updateSettings({ tradingTypes: checked });
        UI.toast(i18n.getLang() === 'en' ? 'Profile saved ✓' : 'Profil enregistré ✓');
        UI.initSettings(); // ré-applique l'adaptation immédiatement
      });
    })();

    // v0.9.133 : refresh visibilité du bouton Export PDF à CHAQUE render (pas
    // seulement au premier bind) — sinon si Store.isPro() retourne false au
    // first render (plan pas encore chargé depuis Firestore), le bouton reste
    // masqué pour toujours.
    const _rowPdf = document.getElementById('rowExportPdf');
    if (_rowPdf) _rowPdf.style.display = (Store.isPro && Store.isPro()) ? '' : 'none';

    // v0.9.142 : refresh statut email vérifié à chaque render Settings.
    _refreshEmailVerifyStatus();

    // v0.9.396 : rafraîchit le sélecteur Focus (options dépendent des comptes/firms)
    try { if (UI.refreshFocusScope) UI.refreshFocusScope(); } catch(e) {}

    // v0.9.150 : refresh state du toggle newsletter (lit depuis userEmails.newsletterOptIn)
    _refreshNewsletterToggle();

    // v0.9.257 : section abonnement Stripe — DOIT tourner à CHAQUE render (avant le
    // garde _settingsBound), sinon la visibilité n'est calculée qu'au 1er appel (avant
    // que le customerId Stripe arrive de Firestore) → la section reste masquée pour
    // toujours et le bouton n'est jamais bindé. La visibilité + le bind sont idempotents
    // (bind gardé par btn.dataset.bound).
    (function setupSubscription() {
      const section = $('subscriptionSection');
      const btn     = $('btnManageSub');
      if (!section || !btn) return;
      const stripeInfo = Store.getStripeInfo ? Store.getStripeInfo() : null;
      const hasStripe  = stripeInfo && stripeInfo.customerId;
      section.style.display = hasStripe ? '' : 'none';
      if (!hasStripe || btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', async () => {
        if (typeof _fbFunctions === 'undefined' || !_fbFunctions) {
          UI.toast('Service indisponible — recharge la page.', true); return;
        }
        const orig = btn.textContent;
        btn.disabled = true; btn.textContent = '…';
        try {
          const res = await _fbFunctions.httpsCallable('createBillingPortalSession')({});
          if (res && res.data && res.data.url) { window.location.href = res.data.url; return; }
          UI.toast('Impossible d\'ouvrir le portail abonnement.', true);
        } catch (e) {
          UI.toast('Impossible d\'ouvrir le portail abonnement.', true);
        } finally {
          btn.disabled = false; btn.textContent = orig;
        }
      });
    })();

    // v0.9.353 : onglet « Règles & marchés » (config) caché pour le plan GRATUIT (Trader).
    // L'info des règles n'est exploitable qu'avec les presets (payant) → on ne la montre
    // qu'aux payants. Tourne à CHAQUE render (avant le garde) car le tier arrive après coup.
    (function gateRulesTab() {
      const isFree = (Store.getTier ? Store.getTier() : 'trader') === 'trader';
      const btn  = document.querySelector('[data-settings-tab="config"]');
      const pane = document.querySelector('[data-settings-pane="config"]');
      if (btn) btn.style.display = isFree ? 'none' : '';
      if (!isFree) return;
      if (pane) pane.style.display = 'none';
      if (btn && btn.classList.contains('active')) {   // on était sur Règles → revenir sur « Mes comptes »
        document.querySelectorAll('[data-settings-tab]').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('[data-settings-pane]').forEach(p => { p.style.display = 'none'; });
        const accBtn = document.querySelector('[data-settings-tab="accounts"]');
        const accPane = document.querySelector('[data-settings-pane="accounts"]');
        if (accBtn) accBtn.classList.add('active');
        if (accPane) accPane.style.display = '';
      }
    })();

    if (_settingsBound) {
      updateAIStatus();
      _refreshThemeToggle();
      return;
    }
    _settingsBound = true;

    // Tab switching
    document.querySelectorAll('[data-settings-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-settings-tab]').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('[data-settings-pane]').forEach(p => { p.style.display = 'none'; });
        btn.classList.add('active');
        document.querySelector(`[data-settings-pane="${btn.dataset.settingsTab}"]`).style.display = '';
      });
    });

    // v0.9.239 : toggle thème (auto / dark / light)
    _refreshThemeToggle();
    document.querySelectorAll('#themeToggleGroup .theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const choice = btn.dataset.themeChoice;
        if (typeof Theme !== 'undefined' && Theme.set) {
          Theme.set(choice);
          _refreshThemeToggle();
        }
      });
    });

    function updateAIStatus() {
      const statusEl = $('aiKeyStatus');
      if (!statusEl) return;
      // v0.9.229 : la clé IA est gérée côté serveur (Firebase Secret Manager).
      // L'IA est toujours active pour tous les users, indépendamment du tier
      // (le quota par tier est appliqué côté Cloud Function).
      // v0.9.357 : reflète le quota du jour (rouge si épuisé).
      if (typeof Store !== 'undefined' && Store.canAnalyzeToday && !Store.canAnalyzeToday()) {
        statusEl.textContent = t('modal.ai.exhausted') || '● IA — quota du jour épuisé';
        statusEl.style.color = 'var(--red)';
      } else {
        statusEl.textContent = t('set.ai.ok') || '✓ IA active';
        statusEl.style.color = 'var(--green)';
      }
    }
    updateAIStatus();
    window.addEventListener('store:aiReady', updateAIStatus);

    $('btnExport').addEventListener('click', () => {
      const blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = 'zeldtrade-' + UI.localToday() + '.json';
      a.click();
      UI.toast(t('set.export.done'));
    });

    // v0.9.163 : Export PDF — binding direct (cf. comment plus haut)
    const _btnExportPdf = $('btnExportPdf');
    if (_btnExportPdf) {
      _btnExportPdf.addEventListener('click', (e) => {
        e.preventDefault();
        // Double check Pro côté client (sécurité — anti DevTools bypass)
        if (!Store.isPro || !Store.isPro()) {
          UI.toast(t('set.export.pdf.pro.only') || 'Export PDF réservé aux plans Funded / Elite.', true);
          return;
        }
        try {
          _openExportPdfModal();
        } catch (err) {
          console.error('[ExportPDF] erreur:', err);
          UI.toast('Erreur : ' + (err && err.message || 'inconnue'), true);
        }
      });
    }

    // ── v0.9.162 (F5) — Export CSV ──────────────────────────────────────────
    // Format : Date, Compte, Symbole, Direction, Lot, Entry, SL, TP1, TP2, TP3,
    // Sortie, Setup, Notes, Outcome, R, Net P&L
    // CSV RFC 4180 : double-quotes pour échapper les chaînes contenant "," ou guillemets.
    function _csvCell(v) {
      if (v === null || v === undefined) return '';
      const s = String(v);
      // Échapper si contient virgule, retour ligne, ou guillemet
      if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    $('btnExportCsv').addEventListener('click', () => {
      try {
        const trades = Store.getTrades() || [];
        if (!trades.length) {
          UI.toast(t('set.export.csv.empty') || 'Aucun trade à exporter.', true);
          return;
        }
        const headers = [
          'Date', 'Compte', 'Symbole', 'Direction', 'Lot',
          'Entry', 'SL', 'TP1', 'TP2', 'TP3', 'Sortie',
          'Setup', 'Notes', 'Outcome', 'R', 'NetPnL_USD',
        ];
        const lines = [headers.join(',')];
        for (const t of trades) {
          let calc = {};
          try { calc = (typeof Calc !== 'undefined' && Calc.trade) ? Calc.trade(t) : {}; } catch {}
          lines.push([
            _csvCell(t.date || ''),
            _csvCell(t.apex || ''),
            _csvCell(t.symbol || ''),
            _csvCell(t.direction || ''),
            _csvCell(t.contracts != null ? t.contracts : ''),
            _csvCell(t.entry != null ? t.entry : ''),
            _csvCell(t.sl != null ? t.sl : ''),
            _csvCell(t.tp1 != null ? t.tp1 : ''),
            _csvCell(t.tp2 != null ? t.tp2 : ''),
            _csvCell(t.tp3 != null ? t.tp3 : ''),
            _csvCell(t.exit != null ? t.exit : ''),
            _csvCell(t.setup || ''),
            _csvCell(t.notes || ''),
            _csvCell(t.outcome || ''),
            _csvCell(calc.rr != null ? calc.rr.toFixed(2) : ''),
            _csvCell(calc.netPnl != null ? calc.netPnl.toFixed(2) : ''),
          ].join(','));
        }
        // BOM UTF-8 pour Excel (sinon les accents s'affichent mal)
        const csv  = '﻿' + lines.join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const a    = document.createElement('a');
        a.href     = URL.createObjectURL(blob);
        a.download = 'zeldtrade-trades-' + UI.localToday() + '.csv';
        a.click();
        URL.revokeObjectURL(a.href);
        UI.toast((t('set.export.csv.done') || 'Export CSV : %n trade(s).').replace('%n', trades.length));
      } catch (e) {
        console.error('[ExportCSV] failed:', e);
        UI.toast('Erreur export CSV : ' + (e && e.message || ''), true);
      }
    });

    // ── Export PDF (Pro only) ────────────────────────────────────────────────
    // Note : la visibilité de #rowExportPdf est gérée en haut de initSettings()
    // (à chaque render, pour éviter l'effet "masqué pour toujours" si isPro()
    // retournait false au first render avant chargement du plan).
    //
    // v0.9.135 : bind via event delegation sur document.body (bind une seule
    // fois ci-dessous, hors du bloc _settingsBound). Plus robuste qu'un
    // addEventListener direct qui dépendait du timing d'initSettings().


    $('btnImport').addEventListener('click', () => $('importFile').click());

    $('importFile').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { UI.toast(t('err.file.large'), true); e.target.value = ''; return; }
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          if (Array.isArray(data)) {
            Store.importTrades(data);
            UI.renderList();
            UI.updateStats();
            UI.toast(t('set.import.done').replace('{n}', data.length));
          }
        } catch { UI.toast(t('set.import.err'), true); }
      };
      reader.readAsText(file);
      e.target.value = '';
    });

    // ── Import CSV ─────────────────────────────────────────────────────────────
    const CSV_TEMPLATE = [
      '# ZeldTrade — Modèle CSV',
      '# direction : long | short',
      '# outcome   : win | loss | be | open  (ou laisser vide si pnl renseigné)',
      '# Si exitPrice OU pnl fourni, outcome est déduit automatiquement',
      'date,instrument,direction,outcome,entry,sl,tp1,exitPrice,pnl,contracts,account,setup,notes',
      '2024-01-15 09:30,MES1,long,win,4800.25,4795.00,4810.50,4810.50,,2,Apex-50K,ORB,Bon trade',
      '2024-01-15 14:00,MNQ1,short,loss,18200.00,18215.00,18160.00,18215.00,,1,Apex-50K,Breakout,,',
      '2024-01-16 10:15,MES1,long,be,4805.50,4800.00,4815.00,4805.50,,1,Apex-50K,,,',
    ].join('\n');

    function normalizeCSVDate(str) {
      str = str.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const d = new Date(str.length <= 10 ? str + 'T12:00:00Z' : str);
        return isNaN(d) ? null : d.toISOString();
      }
      const m = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (m) {
        const d = new Date(`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}T12:00:00Z`);
        return isNaN(d) ? null : d.toISOString();
      }
      const d = new Date(str);
      return isNaN(d) ? null : d.toISOString();
    }

    function parseCSVText(text) {
      const firstLine = text.split('\n').find(l => l.trim() && !l.trim().startsWith('#')) || '';
      const delim = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';

      function parseLine(line) {
        const cols = []; let cur = ''; let inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (ch === '"') { inQ = !inQ; }
          else if (ch === delim && !inQ) { cols.push(cur.trim()); cur = ''; }
          else { cur += ch; }
        }
        cols.push(cur.trim());
        return cols;
      }

      const COL_MAP = {
        date:       ['date','datetime','time','trade date','tradedate','open time','opentime','opened','open date'],
        instrument: ['instrument','symbol','ticker','contract','asset','market','symbole'],
        direction:  ['direction','side','type','action','buy/sell','buysell','sens'],
        outcome:    ['outcome','result','status','résultat','resultat'],
        entry:      ['entry','entry price','entryprice','open price','openprice','price open','prix entrée','prix entree'],
        sl:         ['sl','stop','stoploss','stop loss','stop_loss','stop-loss'],
        tp1:        ['tp1','tp','target','take profit','takeprofit','objectif'],
        exitPrice:  ['exit','exitprice','exit price','close','close price','closeprice','price close','prix sortie'],
        pnl:        ['pnl','net pnl','netpnl','p&l','profit','profit/loss','net profit','gain','realised p&l','realized p&l','résultat net','resultat net'],
        contracts:  ['contracts','qty','quantity','lots','size','volume','nb contracts','nb contrats','contrats','quantité','quantite'],
        account:    ['account','apex','firm','account name','accountname','compte','nom du compte'],
        setup:      ['setup','strategy','stratégie','strategie','pattern'],
        notes:      ['notes','note','comment','comments','description','memo','commentaire'],
      };

      const lines = text.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
      if (lines.length < 2) return { trades: [], skipped: 0 };

      const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g,'').trim());
      const colIdx  = {};
      for (const [field, aliases] of Object.entries(COL_MAP)) {
        for (const alias of aliases) {
          const idx = headers.indexOf(alias);
          if (idx >= 0 && colIdx[field] === undefined) { colIdx[field] = idx; break; }
        }
      }

      const trades  = [];
      let   skipped = 0;
      const get = (cols, field) => colIdx[field] !== undefined ? (cols[colIdx[field]] || '').replace(/['"]/g,'').trim() : '';

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = parseLine(line);
        const gf   = f => get(cols, f);

        const dateISO = normalizeCSVDate(gf('date'));
        if (!dateISO) { skipped++; continue; }

        const instrument = gf('instrument').toUpperCase();
        if (!instrument) { skipped++; continue; }

        const dirRaw = gf('direction').toLowerCase().trim();
        let direction;
        if (['long','buy','b','l','bto','buy to open','achat'].includes(dirRaw)) direction = 'long';
        else if (['short','sell','s','sto','sell to open','vente'].includes(dirRaw)) direction = 'short';
        else { skipped++; continue; }

        const contracts = Math.max(0.01, Math.min(999, parseFloat(gf('contracts')) || 1));
        const entry     = parseFloat(gf('entry').replace(',','.'))     || null;
        const sl        = parseFloat(gf('sl').replace(',','.'))        || null;
        const tp1       = parseFloat(gf('tp1').replace(',','.'))       || null;
        let   exitPrice = parseFloat(gf('exitPrice').replace(',','.')) || null;
        const pnlRaw    = parseFloat(gf('pnl').replace(',','.'));

        if (!exitPrice && !isNaN(pnlRaw) && pnlRaw !== 0 && entry) {
          const pv = Calc.pointValue(instrument);
          if (pv > 0) {
            const pts = pnlRaw / (pv * contracts);
            exitPrice = Math.round((direction === 'long' ? entry + pts : entry - pts) * 10000) / 10000;
          }
        }

        const outRaw = gf('outcome').toLowerCase().trim();
        let outcome;
        const WIN_WORDS  = ['win','profit','winner','tp','take profit','yes','w','gagné','gagne'];
        const LOSS_WORDS = ['loss','loser','sl','stop loss','no','l','perdu'];
        const BE_WORDS   = ['be','breakeven','break even','break-even','neutre','neutral','scratch'];
        if (WIN_WORDS.includes(outRaw))  outcome = 'win';
        else if (LOSS_WORDS.includes(outRaw)) outcome = 'loss';
        else if (BE_WORDS.includes(outRaw))   outcome = 'be';
        else if (!isNaN(pnlRaw)) {
          outcome = pnlRaw > 0 ? 'win' : pnlRaw < 0 ? 'loss' : 'be';
        } else {
          outcome = exitPrice ? (exitPrice > (entry || 0) ? 'win' : exitPrice < (entry || 0) ? 'loss' : 'be') : 'open';
        }

        const trade = {
          date: dateISO, instrument, direction, outcome,
          entry: entry || 0, sl: sl || 0, tp1: tp1 || 0, contracts,
          apex:  gf('account'), setup: gf('setup'), notes: gf('notes'),
        };
        if (exitPrice) trade.exitPrice = exitPrice;

        trades.push(trade);
      }
      return { trades, skipped };
    }

    $('btnCsvTemplate').addEventListener('click', () => {
      const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = 'zeldtrade-modele.csv';
      a.click();
    });

    $('btnImportCsv').addEventListener('click', () => $('importCsvFile').click());

    $('importCsvFile').addEventListener('change', e => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) { UI.toast(t('err.file.large'), true); e.target.value = ''; return; }
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const { trades, skipped } = parseCSVText(ev.target.result);
          if (trades.length === 0 && skipped === 0) { UI.toast(t('set.csv.import.err'), true); return; }
          if (trades.length > 0) {
            Store.importTrades(trades);
            UI.renderList();
            UI.updateStats();
            UI.toast(t('set.csv.import.done').replace('{n}', trades.length));
          }
          if (skipped > 0) setTimeout(() => UI.toast(t('set.csv.import.warn').replace('{n}', skipped), true), trades.length > 0 ? 3200 : 0);
        } catch (err) { UI.toast(t('set.csv.import.err'), true); }
      };
      reader.readAsText(file, 'utf-8');
      e.target.value = '';
    });

    $('btnClearAll').addEventListener('click', () => {
      const overlay = $('clearTradesOverlay');
      const input   = $('clearTradesConfirmInput');
      const errEl   = $('clearTradesError');
      if (!overlay) return;
      input.value = '';
      errEl.textContent = '';
      overlay.style.display = 'flex';
      setTimeout(() => input.focus(), 50);
    });

    $('clearTradesCancelBtn')?.addEventListener('click', () => {
      $('clearTradesOverlay').style.display = 'none';
    });

    $('clearTradesConfirmBtn')?.addEventListener('click', () => {
      const input = $('clearTradesConfirmInput');
      const errEl = $('clearTradesError');
      if (input.value.trim() !== 'EFFACER') {
        errEl.textContent = 'Tape exactement "EFFACER" pour confirmer.';
        return;
      }
      Store.clearTrades();
      UI.selectedId = null;
      UI.renderList();
      UI.renderDetail();
      UI.updateStats();
      $('clearTradesOverlay').style.display = 'none';
      UI.toast(t('set.clear.done'));
    });

    // Submit avec Entrée dans le champ
    $('clearTradesConfirmInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') $('clearTradesConfirmBtn').click();
      if (e.key === 'Escape') $('clearTradesCancelBtn').click();
    });

    // ── Suppression de compte ──────────────────────────────────────────────────
    const delOverlay    = $('deleteAccountOverlay');
    const delConfirmBtn = $('delConfirmBtn');
    const delCancelBtn  = $('delCancelBtn');
    const delError      = $('delError');

    $('btnDeleteAccount').addEventListener('click', () => {
      $('delEmail').value    = '';
      $('delPassword').value = '';
      delError.textContent   = '';
      delOverlay.style.display = 'flex';
      setTimeout(() => $('delEmail').focus(), 50);
    });

    delCancelBtn.addEventListener('click', () => {
      delOverlay.style.display = 'none';
    });

    delOverlay.addEventListener('click', e => {
      if (e.target === delOverlay) delOverlay.style.display = 'none';
    });

    // Rate-limiting local : max 3 échecs → blocage 5 min (anti-vandalisme session)
    let _delAttempts = 0;
    let _delLockedUntil = 0;

    delConfirmBtn.addEventListener('click', async () => {
      const email    = $('delEmail').value.trim().slice(0, 254);
      const password = $('delPassword').value;
      delError.textContent = '';

      if (Date.now() < _delLockedUntil) {
        const wait = Math.ceil((_delLockedUntil - Date.now()) / 1000);
        delError.textContent = `Trop de tentatives — réessaie dans ${wait}s.`;
        return;
      }

      if (!email || !password) {
        delError.textContent = t('auth.err.required');
        return;
      }

      delConfirmBtn.disabled   = true;
      delConfirmBtn.textContent = t('del.modal.deleting');

      const result = await Auth.deleteAccount(email, password);

      if (result.ok) {
        _delAttempts = 0;
        delOverlay.style.display = 'none';
        // Firebase signOut se déclenche automatiquement après delete()
        // v0.9.263 : redirige avec ?deleted=1 → bannière de confirmation sur la landing
        // (avant, l'user était renvoyé à l'accueil sans aucun message).
        window.location.href = '/?deleted=1';
      } else {
        _delAttempts++;
        if (_delAttempts >= 3) {
          _delLockedUntil = Date.now() + 5 * 60_000;
          _delAttempts = 0;
        }
        delError.textContent     = result.error;
        delConfirmBtn.disabled   = false;
        delConfirmBtn.textContent = t('del.modal.confirm');
      }
    });

    $('delPassword').addEventListener('keydown', e => {
      if (e.key === 'Enter') delConfirmBtn.click();
    });
  };
})();
