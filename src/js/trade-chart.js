// ─── TradeChart (v1.0.8) ─────────────────────────────────────────────────────
// Trace un trade du journal sur un graphique : vraies bougies (CF getChartData → Yahoo)
// + zones risque/profit positionnées à l'HEURE du trade. Fallback schématique (niveaux
// seuls) si la data est indispo (instrument inconnu, trade trop vieux, Yahoo KO).
// Canvas maison (zéro lib, zéro coût). Thème sombre app.
const TradeChart = (() => {
  // instrument saisi par l'user → ticker Yahoo Finance
  const SYMAP = {
    NQ:'NQ=F', MNQ:'NQ=F', ES:'ES=F', MES:'ES=F', YM:'YM=F', MYM:'YM=F',
    RTY:'RTY=F', M2K:'RTY=F', CL:'CL=F', MCL:'CL=F', GC:'GC=F', MGC:'GC=F',
    SI:'SI=F', SIL:'SI=F', NG:'NG=F', QG:'NG=F', HG:'HG=F', PL:'PL=F', NKD:'NIY=F',
    ZB:'ZB=F', ZN:'ZN=F', ZF:'ZF=F', '6E':'EURUSD=X', '6B':'GBPUSD=X', '6J':'JPY=X',
    BTC:'BTC-USD', ETH:'ETH-USD', SOL:'SOL-USD', XRP:'XRP-USD', BNB:'BNB-USD',
    EURUSD:'EURUSD=X', GBPUSD:'GBPUSD=X', USDJPY:'JPY=X', XAUUSD:'GC=F', XAGUSD:'SI=F',
  };
  function ySymbol(instr){
    if(!instr) return null;
    const k = String(instr).toUpperCase().replace(/[^A-Z0-9]/g,'');
    if(SYMAP[k]) return SYMAP[k];
    const m = k.match(/^([A-Z]{2,5})(USDT|USD)$/);
    if(m && ['BTC','ETH','SOL','XRP','ADA','DOGE','BNB','AVAX','LINK','MATIC','DOT'].includes(m[1])) return m[1]+'-USD';
    return null;
  }
  const fmt = n => Number(n).toLocaleString('fr-FR',{maximumFractionDigits:2});

  async function render(container, t){
    if(!container) return;
    const en = (typeof i18n!=='undefined' && i18n.getLang && i18n.getLang()==='en');
    const entry=+t.entry, sl=+t.sl;
    const tp = +(t.tp1 || t.tp2 || t.tp3 || 0) || null;
    const exit = (t.exitPrice!=null && t.exitPrice!=='')?+t.exitPrice:null;
    if(!entry || !sl){ container.style.display='none'; return; }   // pas assez pour dessiner
    container.style.display='';
    container.innerHTML = `<div style="padding:22px;text-align:center;color:var(--muted);font-size:13px">${en?'Loading chart…':'Chargement du graphique…'}</div>`;

    const sym = ySymbol(t.instrument);
    let candles=null;
    if(sym && t.date && typeof _fbFunctions!=='undefined' && _fbFunctions){
      try{
        const d=new Date(t.date).getTime();
        const ageD=(Date.now()-d)/86400000;
        const interval = ageD<=6 ? '5m' : ageD<=58 ? '30m' : ageD<=700 ? '1h' : '1d';
        const span = interval==='1d' ? 26*86400 : 5*3600;
        const from = Math.floor(d/1000)-span, to = Math.floor(d/1000)+span;
        const res = await _fbFunctions.httpsCallable('getChartData')({symbol:sym,from,to,interval});
        candles = (res && res.data && Array.isArray(res.data.candles)) ? res.data.candles : null;
      }catch(e){ candles=null; }
    }
    try { _draw(container, {candles,t,entry,sl,tp,exit,sym,en}); }
    catch(e){ container.style.display='none'; }
  }

  function _draw(container, o){
    const {candles,t,entry,sl,tp,exit,sym,en}=o;
    const dir = (t.direction==='short') ? 'short' : 'long';
    const hasC = candles && candles.length>3;
    const head = `${sym?'<span style="font-family:var(--font-mono,monospace);font-weight:600">'+sym.replace('=F','').replace('-USD',' / USD')+'</span>':''}`
      + `<span style="font-size:11px;padding:2px 8px;border-radius:6px;background:${dir==='short'?'var(--red-dim,rgba(255,69,58,0.14))':'var(--green-dim,rgba(48,209,88,0.14))'};color:${dir==='short'?'var(--red,#ff453a)':'var(--green,#30d158)'}">${dir==='short'?(en?'Short':'Vente'):(en?'Long':'Achat')}</span>`
      + (hasC?'':`<span style="font-size:11px;color:var(--muted)">${en?'levels only — no market data':'niveaux seuls — pas de data marché'}</span>`);
    container.innerHTML = `
      <div class="info-card" style="margin-top:14px">
        <h4 style="margin-bottom:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">${en?'Trade on chart':'Trade sur le graphique'} <span style="display:inline-flex;gap:8px;align-items:center;margin-left:auto;font-size:12px">${head}</span></h4>
        <div class="tc-wrap" style="width:100%"><canvas class="tc-cv" role="img" aria-label="${en?'Trade plotted on price chart':'Trade tracé sur le graphique de prix'}"></canvas></div>
      </div>`;
    const wrap=container.querySelector('.tc-wrap'), cv=container.querySelector('.tc-cv');
    const dpr=window.devicePixelRatio||1, W=Math.max(280, wrap.clientWidth||560), H=300;
    cv.width=W*dpr; cv.height=H*dpr; cv.style.width=W+'px'; cv.style.height=H+'px';
    const ctx=cv.getContext('2d'); ctx.scale(dpr,dpr);
    const txt='#e6e6e9', sub='#9a9aa0', grid='rgba(255,255,255,0.07)', dn='#cfcfd4', upF='#1c1c20';
    const green='#30d158', red='#ff453a', greenZ='rgba(48,209,88,0.14)', redZ='rgba(255,69,58,0.11)', neutral='#8a8a90';

    const prices=[entry,sl]; if(tp)prices.push(tp); if(exit!=null)prices.push(exit);
    if(hasC) candles.forEach(c=>{prices.push(c.high,c.low);});
    let pMin=Math.min.apply(null,prices), pMax=Math.max.apply(null,prices);
    const pPad=(pMax-pMin)*0.08 || (pMax*0.001+1); pMin-=pPad; pMax+=pPad;
    const padL=8, padR=78, padT=12, padB=22;
    const plotL=padL, plotR=W-padR, plotT=padT, plotB=H-padB;
    const Y = p => plotT + (pMax-p)/(pMax-pMin)*(plotB-plotT);

    // grille prix (4 paliers ronds)
    ctx.font='11px ui-sans-serif,system-ui'; ctx.textBaseline='middle'; ctx.lineWidth=1;
    const step=(pMax-pMin)/4;
    for(let i=0;i<=4;i++){ const p=pMin+step*i, y=Y(p); ctx.strokeStyle=grid; ctx.beginPath(); ctx.moveTo(plotL,y); ctx.lineTo(plotR,y); ctx.stroke(); }

    const eSec = t.date ? Math.floor(new Date(t.date).getTime()/1000) : null;

    if(hasC){
      const tMin=candles[0].time, tMax=candles[candles.length-1].time;
      const X = ts => plotL + (ts-tMin)/((tMax-tMin)||1)*(plotR-plotL);
      const slot=(plotR-plotL)/candles.length, bw=Math.max(1.5, Math.min(9, slot*0.6));
      // zone : de l'heure d'entrée → sortie (ou +40% de la fenêtre si pas de sortie)
      const zX0 = eSec!=null ? X(Math.max(tMin,eSec)) : plotL+(plotR-plotL)*0.3;
      const exitSec = (t.exitDate ? Math.floor(new Date(t.exitDate).getTime()/1000) : null);
      const zX1 = exitSec!=null ? X(Math.min(tMax,exitSec)) : Math.min(plotR, zX0+(plotR-plotL)*0.45);
      if(tp){ ctx.fillStyle=greenZ; ctx.fillRect(zX0, Y(tp), zX1-zX0, Y(entry)-Y(tp)); }
      ctx.fillStyle=redZ; ctx.fillRect(zX0, Y(entry), zX1-zX0, Y(sl)-Y(entry));
      // bougies
      candles.forEach(c=>{
        const x=X(c.time), up=c.close>=c.open;
        ctx.strokeStyle=dn; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(x,Y(c.high)); ctx.lineTo(x,Y(c.low)); ctx.stroke();
        const yo=Y(c.open), yc=Y(c.close), top=Math.min(yo,yc), h=Math.max(1,Math.abs(yo-yc));
        if(up){ ctx.fillStyle=upF; ctx.fillRect(x-bw/2,top,bw,h); ctx.strokeRect(x-bw/2,top,bw,h); }
        else { ctx.fillStyle=dn; ctx.fillRect(x-bw/2,top,bw,h); }
      });
      // marqueur entrée à l'heure
      if(eSec!=null){ const mx=X(Math.max(tMin,Math.min(tMax,eSec))); ctx.fillStyle=neutral; ctx.beginPath(); ctx.moveTo(mx,Y(entry)-1); ctx.lineTo(mx-5,Y(entry)+8); ctx.lineTo(mx+5,Y(entry)+8); ctx.closePath(); ctx.fill(); }
    } else {
      // fallback schématique : bandes pleine largeur
      if(tp){ ctx.fillStyle=greenZ; ctx.fillRect(plotL, Y(tp), plotR-plotL, Y(entry)-Y(tp)); }
      ctx.fillStyle=redZ; ctx.fillRect(plotL, Y(entry), plotR-plotL, Y(sl)-Y(entry));
    }
    // lignes de niveau + tags prix
    function level(p,color,dash){ ctx.save(); ctx.strokeStyle=color; ctx.lineWidth=1.3; ctx.setLineDash(dash); ctx.beginPath(); ctx.moveTo(plotL,Y(p)); ctx.lineTo(plotR,Y(p)); ctx.stroke(); ctx.restore();
      const y=Y(p); ctx.globalAlpha=0.15; ctx.fillStyle=color; ctx.fillRect(plotR+3,y-9,padR-5,18); ctx.globalAlpha=1; ctx.fillStyle=color; ctx.textAlign='left'; ctx.font='500 11px ui-monospace,monospace'; ctx.fillText(fmt(p), plotR+7, y); }
    if(tp) level(tp,green,[5,4]);
    level(entry,neutral,[2,3]);
    level(sl,red,[5,4]);
    if(exit!=null && Math.abs(Y(exit)-Y(tp||entry))>6) level(exit, sub, [1,3]);
  }

  return { render, ySymbol };
})();
window.TradeChart = TradeChart;
