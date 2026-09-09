import fs from 'node:fs/promises';
import {FomoProvider} from '../providers/fomo.mjs';
import {DexScreenerProvider} from '../providers/dexscreener.mjs';
import {marketTokenScore,walletScore} from '../services/scoring.mjs';
import {config} from '../config.mjs';
import {normalizeRules,evaluate} from './rules.mjs';
import {loadStore,saveStore} from './store.mjs';

const lower=x=>String(x||'').toLowerCase();
const valid=a=>/^0x[a-fA-F0-9]{40}$/.test(String(a||''));
const now=()=>new Date().toISOString();
const num=x=>Number.isFinite(Number(x))?Number(x):null;
const uniqBy=(arr,key)=>{const seen=new Set();return arr.filter(x=>{const k=key(x);if(!k||seen.has(k))return false;seen.add(k);return true})};

export class CopyRuntime{
  constructor({demo=false}={}){
    this.demo=demo;
    this.seed=null;this.store=null;this.rules=null;
    this.leaderboard=[];this.tokens=[];this.trades=[];this.verified=[];this.candidates=[];
    this.events=[];this.shadowCopies=[];this.demoMirrors=[];this.demoWalletCursor=0;this.demoTokenCursor=0;this.demoPairCursor=0;
    this.providers={fomo:'snapshot',trades:'snapshot',dex:'snapshot',rpc:'unknown'};
    this.lastSync=null;this.syncing=false;this.listeners=new Set();
    this.seenTradeIds=new Set();this.knownTokenAddresses=new Set();this.eventSeq=0;this.scanCursor=0;this.demoTickNo=0;
    this.stats={newTokens:0,tradeEvents:0,marketMoves:0,scans:0,syncs:0,totalEvents:0};
    this.fomo=new FomoProvider({bearer:config.fomoBearer,replyNodesKey:config.replyNodesKey,replyNodesChain:config.replyNodesChain});
    this.dex=new DexScreenerProvider();
  }

  async init(){
    this.seed=JSON.parse(await fs.readFile(new URL('../../data/seed.json',import.meta.url),'utf8'));
    this.store=await loadStore();
    this.rules=normalizeRules(this.store.rules||{});
    this.leaderboard=this.seed.leaderboard||[];
    this.tokens=(this.seed.dexTokens||[]).map(t=>({...t,score:marketTokenScore(t)}));
    this.verified=this.seed.verifiedPositions||[];
    this.knownTokenAddresses=new Set(this.tokens.map(x=>lower(x.address)).filter(Boolean));
    if(this.demo)this.seedDemoTokens(48);
    this.rebuild();
    this.seedEvents();
    if(this.demo)this.seedDemoMirrors();
    this.refreshShadowCopies();
    return this;
  }

  on(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  emit(e){for(const fn of this.listeners)try{fn(e)}catch{}}

  pushEvent(type,{candidate=null,message='',meta={}}={}){
    const event={
      id:`e${++this.eventSeq}:${Date.now()}`,
      at:now(),type,
      candidate: candidate?this.cloneCandidate(candidate):null,
      verdict:candidate?.verdict||null,
      message,meta
    };
    this.events.unshift(event);
    this.stats.totalEvents++;
    // Keep a deep rolling history while allowing the stream to continue forever.
    // The monotonic totalEvents counter never resets even when old rows are compacted.
    if(this.events.length>20000)this.events.length=20000;
    this.emit({type:'event',event});
    return event;
  }

  cloneCandidate(c){
    if(!c)return null;
    return {...c,token:{...c.token},trader:c.trader?{...c.trader}:null,reasons:[...(c.reasons||[])]};
  }

  seedEvents(){
    if(this.events.length)return;
    for(const c of this.candidates.slice(0,12).reverse()){
      this.pushEvent(c.verdict==='FIRE'?'READY':'SCAN',{candidate:c,message:c.reasons?.[0]||'all copy walls passed'});
    }
    this.pushEvent('BOOT',{message:`snapshot loaded · ${this.hunters.length} hunters · ${this.tokens.length} ${this.demo?'markets (RH + replay)':'RH tokens'}`});
  }

  mergeLeaderboard(items=[]){
    if(!items.length)return;
    const m=new Map(this.leaderboard.map(x=>[lower(x.handle||x.id||x.name),x]));
    for(const x of items){const k=lower(x.handle||x.id||x.name);if(k)m.set(k,{...(m.get(k)||{}),...x})}
    this.leaderboard=[...m.values()].sort((a,b)=>Number(a.rank||9999)-Number(b.rank||9999)).slice(0,160);
  }

  mergeTokens(items=[]){
    if(!items.length)return [];
    const fresh=[];
    const m=new Map(this.tokens.map(x=>[lower(x.address),x]));
    for(const x of items){
      const k=lower(x.address||x.token);
      if(!k||!valid(x.address||x.token))continue;
      const was=m.get(k);
      const merged={...(was||{}),...x,address:x.address||x.token,score:marketTokenScore({...was,...x})};
      m.set(k,merged);
      if(!this.knownTokenAddresses.has(k)){this.knownTokenAddresses.add(k);fresh.push(merged)}
    }
    this.tokens=[...m.values()].sort((a,b)=>Number(b.volume24h||0)-Number(a.volume24h||0)||Number(b.liquidity||0)-Number(a.liquidity||0));
    return fresh;
  }

  mergeTrades(items=[]){
    const fresh=[];
    const existing=new Map(this.trades.map(x=>[String(x.id),x]));
    for(const x of items){
      const id=String(x.id||'');if(!id)continue;
      existing.set(id,{...(existing.get(id)||{}),...x});
      if(!this.seenTradeIds.has(id)){this.seenTradeIds.add(id);fresh.push(x)}
    }
    this.trades=[...existing.values()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,4000);
    return fresh;
  }

  async sync(){
    if(this.syncing)return;
    this.syncing=true;
    const started=Date.now();
    const before=new Map(this.tokens.map(t=>[lower(t.address),{price:num(t.price),volume24h:num(t.volume24h),liquidity:num(t.liquidity),marketCap:num(t.marketCap)}]));
    let freshTrades=[],freshTokens=[];
    try{
      if(!this.demo){
        const topHandles=this.leaderboard.slice(0,32).map(x=>x.handle).filter(Boolean);
        const [lbR,tradesR,trendingR]=await Promise.allSettled([
          this.fomo.leaderboard('24h',140),
          this.fomo.trades(500,topHandles),
          this.fomo.trending(100)
        ]);
        if(lbR.status==='fulfilled'&&lbR.value.items?.length){this.mergeLeaderboard(lbR.value.items);this.providers.fomo=lbR.value.provider||'live'}
        if(tradesR.status==='fulfilled'){
          freshTrades=this.mergeTrades(tradesR.value||[]);
          this.providers.trades=(tradesR.value||[]).length?'live':this.providers.trades;
        }
        if(trendingR.status==='fulfilled'&&trendingR.value?.length){freshTokens.push(...this.mergeTokens(trendingR.value));}

        const discovered=[...this.tokens.map(x=>x.address),...freshTrades.map(x=>x.tokenAddress),...(trendingR.status==='fulfilled'?(trendingR.value||[]).map(x=>x.address):[])].filter(valid);
        const dexR=await Promise.allSettled([this.dex.sync(discovered)]);
        const dex=dexR[0];
        if(dex.status==='fulfilled'&&dex.value.items?.length){freshTokens.push(...this.mergeTokens(dex.value.items));this.providers.dex=dex.value.provider||'live'}

        try{
          const r=await fetch(config.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]}),signal:AbortSignal.timeout(5000)});
          const j=await r.json();
          this.providers.rpc=parseInt(j.result,16)===4663?'live':'wrong-chain';
        }catch{this.providers.rpc='degraded'}
      }

      this.lastSync=now();
      this.rebuild();
      this.recordExternalChanges({before,freshTrades,freshTokens:uniqBy(freshTokens,x=>lower(x.address))});
      this.refreshShadowCopies();
      this.stats.syncs++;
      this.pushEvent('SYNC',{message:`refreshed ${this.tokens.length} markets · ${freshTokens.length} new · ${freshTrades.length} wallet trades · ${Date.now()-started}ms`});
      this.emit({type:'sync',ms:Date.now()-started});
    }finally{this.syncing=false}
  }

  recordExternalChanges({before,freshTrades,freshTokens}){
    for(const token of freshTokens){
      const c=this.candidates.find(x=>lower(x.token.address)===lower(token.address));
      this.stats.newTokens++;
      this.pushEvent('NEW',{candidate:c,message:`new RH market discovered · mcap ${Number(token.marketCap||0)>0?'updated':'pending'} · waiting for wallet confirmation`});
    }

    for(const t of freshTrades){
      const c=this.candidates.find(x=>x.kind==='trade'&&x.trade?.id===t.id)||this.candidates.find(x=>lower(x.token.address)===lower(t.tokenAddress));
      this.stats.tradeEvents++;
      this.pushEvent(t.side==='SELL'?'SELL':'BUY',{candidate:c,message:`${t.side} ${t.usdAmount?`$${Math.round(t.usdAmount).toLocaleString('en-US')}`:'size n/a'} from @${t.handle||t.name||'wallet'}${t.txHash?' · confirmed tx':''}`,meta:{trade:t}});
    }

    const moved=[];
    for(const token of this.tokens){
      const old=before.get(lower(token.address));if(!old)continue;
      const p0=old.price,p1=num(token.price);if(!p0||!p1)continue;
      const delta=(p1/p0-1)*100;
      const v0=old.volume24h,v1=num(token.volume24h);const vDelta=v0&&v1?(v1/v0-1)*100:0;
      if(Math.abs(delta)>=0.03||Math.abs(vDelta)>=0.5)moved.push({token,delta,vDelta});
    }
    moved.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
    for(const m of moved.slice(0,5)){
      const c=this.candidates.find(x=>lower(x.token.address)===lower(m.token.address));
      this.stats.marketMoves++;
      this.pushEvent('MOVE',{candidate:c,message:`price ${m.delta>=0?'+':''}${m.delta.toFixed(2)}% since last refresh · 24h vol ${m.vDelta>=0?'+':''}${m.vDelta.toFixed(1)}%`});
    }
  }

  rebuild(){
    const max=Math.max(1,...this.leaderboard.map(x=>Number(x.pnl24h||0)));
    this.hunters=this.leaderboard.slice(0,140).map((x,i)=>({...x,score:walletScore(x,max),rank:x.rank24h||x.rank||i+1}));
    const byHandle=new Map(this.hunters.map(x=>[lower(x.handle||x.name),x]));
    this.candidates=[];

    for(const p of this.verified){
      const token=this.tokens.find(t=>lower(t.address)===lower(p.tokenAddress));if(!token)continue;
      const trader=byHandle.get(lower(p.handle))||this.hunters.find(h=>lower(h.handle)===lower(p.handle))||{name:p.name,handle:p.handle,pnl24h:p.pnl};
      this.candidates.push(this.makeCandidate(token,trader,{kind:'verified',pnl:p.pnl,verified:p}));
    }

    const used=new Set(this.candidates.map(x=>lower(x.token.address)));
    for(const token of this.tokens){if(used.has(lower(token.address)))continue;this.candidates.push(this.makeCandidate(token,null,{kind:'market'}))}

    for(const t of this.trades.slice(0,160)){
      const token=this.tokens.find(x=>lower(x.address)===lower(t.tokenAddress));if(!token)continue;
      const trader=this.hunters.find(h=>lower(h.handle)===lower(t.handle))||{name:t.name,handle:t.handle};
      this.candidates.unshift(this.makeCandidate(token,trader,{kind:'trade',trade:t}));
    }

    const seen=new Set();
    this.candidates=this.candidates.filter(x=>{const k=`${x.kind}:${lower(x.token.address)}:${lower(x.trader?.handle||x.trader?.name||'market')}`;if(seen.has(k))return false;seen.add(k);return true}).slice(0,5000);
  }

  makeCandidate(token,trader,extra={}){
    const r=evaluate({token,trader,rules:this.rules,openPositions:this.store?.positions?.length||0,spentEth:Number(this.store?.spentEth||0)});
    return{
      id:`${extra.kind||'market'}:${token.address}:${trader?.handle||trader?.name||'market'}`,
      createdAt:extra.trade?.createdAt||extra.verified?.snapshotDate||now(),kind:extra.kind||'market',
      token:{...token,score:Number(token.score||marketTokenScore(token))},
      trader:trader||null,pnl:extra.pnl??trader?.pnl24h??null,trade:extra.trade||null,verified:extra.verified||null,...r
    };
  }

  heartbeat(){
    if(!this.candidates.length)return;
    const c=this.candidates[this.scanCursor++%this.candidates.length];
    const total=5;
    const failed=Math.min(total,c.reasons?.length||0);
    const passed=Math.max(0,total-failed);
    this.stats.scans++;
    this.pushEvent('SCAN',{candidate:c,message:`scanner ${passed}/${total} walls · ${c.reasons?.[0]||'ready for copy decision'}`});
  }

  demoTokenSymbol(serial){
    const stems=['BARA','COPY','WICK','MINT','FLOW','TAPE','PULSE','LOOP','CLIP','MIRR','LIME','NODE','TRACE','STACK','GLOW','BYTE','RUSH','RAIL','MOJO','TICK','SNAP','FLIP','DRIP','EDGE'];
    const stem=stems[serial%stems.length];
    return `${stem}${serial.toString(36).toUpperCase()}`.slice(0,10);
  }

  makeReplayToken(serial=++this.demoTokenCursor){
    const phase=serial*1.61803398875;
    const mcap=85_000 + (Math.abs(Math.sin(phase*.71))*1_850_000) + (serial%9)*47_000;
    const depth=.006 + Math.abs(Math.cos(phase*.37))*.055;
    const liquidity=Math.max(12_000,mcap*depth);
    const turnover=.28 + Math.abs(Math.sin(phase*.53))*3.4;
    const volume24h=liquidity*turnover;
    const change24h=-18 + Math.abs(Math.sin(phase*.29))*54;
    const price=Math.max(0.00000004,(mcap/1_000_000)*0.000014*(.55+Math.abs(Math.cos(phase*.19))));
    const symbol=this.demoTokenSymbol(serial);
    const t={
      symbol,name:`${symbol} replay market`,address:`replay:${String(serial).padStart(6,'0')}`,
      price,marketCap:mcap,liquidity,volume24h,change24h,
      replay:true,replayId:serial,discoveredAt:now(),source:'REPLAY'
    };
    t.score=marketTokenScore(t);
    return t;
  }

  seedDemoTokens(count=48){
    const created=[];
    for(let i=0;i<count;i++){const t=this.makeReplayToken();this.tokens.push(t);created.push(t)}
    this.stats.newTokens+=created.length;
    return created;
  }

  addReplayToken(){
    const token=this.makeReplayToken();
    // Newest replay markets are placed first so scanner/radar sees them immediately.
    this.tokens.unshift(token);
    this.stats.newTokens++;
    this.rebuild();
    const pool=this.hunters.filter(h=>/^[\x20-\x7E]+$/.test(String(h.handle||h.name||'')));
    const trader=pool[(this.demoTokenCursor*7)%Math.max(1,pool.length)]||this.hunters[(this.demoTokenCursor*5)%Math.max(1,this.hunters.length)]||null;
    const c=this.makeCandidate(token,trader,{kind:'replay'});
    // Ensure this exact new intake is selectable at the top before the next full rebuild.
    this.candidates.unshift(c);
    this.pushEvent('REPLAY NEW',{candidate:c,message:`new replay market #${this.demoTokenCursor} · @${trader?.handle||trader?.name||'scanner'} picked up $${token.symbol} · stream keeps growing`});
    return token;
  }

  seedDemoMirrors(){
    const priced=this.tokens.filter(t=>num(t.price));
    if(!priced.length)return;
    const ascii=x=>/^[\x20-\x7E]+$/.test(String(x||''));
    const hunters=this.hunters.filter(h=>ascii(h.handle||h.name)).slice(0,30);
    const seeds=[3.8,-1.4,7.2,0.9,11.6,-2.1,4.7,1.8,8.4,-0.6,14.8,2.7,21.3,-3.6,6.9,17.4,0.4,27.8,-5.2,9.1,4.2,12.9,-0.8,31.6,5.5,19.2,1.3,8.8];
    this.demoMirrors=[];
    const target=Math.min(28,Math.max(22,hunters.length));
    for(let i=0;i<target;i++){

      const token=priced[(i*5+3)%priced.length];
      const trader=hunters[(i*7+2)%hunters.length]||{name:`shadow_${i+1}`};
      const initial=seeds[i%seeds.length];
      const currentPrice=Number(token.price);
      const entryPrice=currentPrice/(1+initial/100);
      this.demoMirrors.push({
        key:`replay:${i}:${lower(token.address)}`,kind:'SHADOW',replay:true,
        trader:trader.name||trader.handle||`wallet_${i+1}`,handle:trader.handle||trader.name||`wallet_${i+1}`,
        symbol:token.symbol,address:token.address,entryPrice,currentPrice,pnlPct:initial,deltaPct:0,
        history:[initial*.20,initial*.42,initial*.66,initial*.82,initial],startedAt:now(),source:'REPLAY'
      });
    }
  }

  rotateDemoMirror(){
    if(!this.demo||!this.tokens.length||!this.hunters.length)return;
    const priced=this.tokens.filter(t=>num(t.price));if(!priced.length)return;
    const idx=this.demoWalletCursor++;
    const token=priced[(idx*5+this.demoTickNo)%priced.length];
    const pool=this.hunters.filter(h=>/^[\x20-\x7E]+$/.test(String(h.handle||h.name||'')))||this.hunters;
    const trader=pool[(idx*7+this.demoTickNo+5)%pool.length];
    const fresh={
      key:`replay:new:${this.demoTickNo}:${lower(token.address)}:${lower(trader.handle||trader.name)}`,
      kind:'SHADOW',replay:true,trader:trader.name||trader.handle||'wallet',handle:trader.handle||trader.name||'wallet',
      symbol:token.symbol,address:token.address,entryPrice:Number(token.price),currentPrice:Number(token.price),
      pnlPct:0,deltaPct:0,history:[0],startedAt:now(),source:'REPLAY'
    };
    this.demoMirrors.unshift(fresh);this.demoMirrors=this.demoMirrors.slice(0,32);
    const cand=this.candidates.find(c=>lower(c.token.address)===lower(token.address));
    this.pushEvent('REPLAY IN',{candidate:cand,message:`shadow @${fresh.handle} entered $${fresh.symbol} · model size ${this.rules.buySizeEth.toFixed(3)} ETH`});
  }

  reassignDemoPair(){
    if(!this.demo||!this.demoMirrors.length)return;
    const priced=this.tokens.filter(t=>num(t.price));if(!priced.length)return;
    const idx=this.demoPairCursor++%this.demoMirrors.length;
    const m=this.demoMirrors[idx];
    let token=priced[(this.demoPairCursor*11+this.demoTickNo*3)%priced.length];
    if(lower(token.address)===lower(m.address))token=priced[(priced.indexOf(token)+7)%priced.length]||token;
    const targetPnl=-4+Math.abs(Math.sin((this.demoPairCursor+3)*1.71))*29;
    const currentPrice=Number(token.price);
    m.symbol=token.symbol;m.address=token.address;m.currentPrice=currentPrice;
    m.entryPrice=currentPrice/(1+targetPnl/100);m.pnlPct=targetPnl;m.deltaPct=0;
    m.history=[targetPnl*.32,targetPnl*.51,targetPnl*.73,targetPnl];m.startedAt=now();
    const cand=this.candidates.find(c=>lower(c.token.address)===lower(token.address))||this.makeCandidate(token,null,{kind:'replay'});
    this.pushEvent('REPLAY IN',{candidate:cand,message:`@${m.handle} rotated pair → $${m.symbol} · fresh mirror ${targetPnl>=0?'+':''}${targetPnl.toFixed(1)}% mark`});
  }

  demoTick(){
    if(!this.demo||!this.tokens.length)return;
    this.demoTickNo++;

    // Feed the terminal forever: every second tick a brand-new, explicitly REPLAY-labeled
    // market is appended to the universe. Live mode never invents markets.
    if(this.demoTickNo%2===0)this.addReplayToken();

    // Every mirror's underlying market gets a mark every tick, plus a rotating batch of
    // unrelated markets so radar/feed never freeze even with dozens of wallet pairs.
    const wanted=[];
    for(const m of this.demoMirrors){const t=this.tokens.find(x=>lower(x.address)===lower(m.address));if(t)wanted.push(t)}
    const offset=(this.demoTickNo*13)%Math.max(1,this.tokens.length);
    for(let i=0;i<24&&i<this.tokens.length;i++)wanted.push(this.tokens[(offset+i)%this.tokens.length]);
    const targets=uniqBy(wanted,x=>lower(x.address)).filter(t=>num(t.price));

    for(let i=0;i<targets.length;i++){
      const t=targets[i];
      const seed=String(t.symbol||'').split('').reduce((a,ch)=>a+ch.charCodeAt(0),0);
      const wave=Math.sin((this.demoTickNo+seed*.13+i*.31)/1.9)*0.0072 + Math.cos((this.demoTickNo+seed*.07+i)/3.1)*0.0038;
      const old=Number(t.price);const next=Math.max(old*0.12,old*(1+wave));
      t.price=next;
      if(num(t.marketCap))t.marketCap=Number(t.marketCap)*(next/old);
      t.volume24h=Number(t.volume24h||0)+Math.max(90,Math.abs(wave)*Number(t.volume24h||100000)*0.16);
      t.change24h=Number(t.change24h||0)+wave*100*.22;
      t.score=marketTokenScore(t);
    }

    this.rebuild();
    // Pair churn is intentionally frequent in showcase mode: wallets rotate into new
    // tokens instead of sitting on one pair for the entire recording.
    if(this.demoTickNo%3===0)this.reassignDemoPair();
    if(this.demoTickNo%7===0)this.rotateDemoMirror();
    this.refreshShadowCopies();

    const movedToken=targets[this.demoTickNo%Math.max(1,targets.length)];
    const c=movedToken?this.candidates.find(x=>lower(x.token.address)===lower(movedToken.address)):this.candidates[0];
    if(this.demoTickNo%3!==0&&this.shadowCopies.length){
      const m=this.shadowCopies[(this.demoTickNo*5)%this.shadowCopies.length];
      const mc=this.candidates.find(x=>lower(x.token.address)===lower(m.address));
      if(mc)this.pushEvent('REPLAY PNL',{candidate:mc,message:`@${m.handle} mirror $${m.symbol} ${m.pnlPct>=0?'+':''}${m.pnlPct.toFixed(2)}% · Δ ${m.deltaPct>=0?'+':''}${m.deltaPct.toFixed(2)}%`});
    }else if(c){
      this.pushEvent('REPLAY MOVE',{candidate:c,message:`market mark · $${c.token.symbol} ${Number(c.token.change24h||0)>=0?'+':''}${Number(c.token.change24h||0).toFixed(2)}% 24h · turnover ${(Number(c.token.volume24h||0)/Math.max(1,Number(c.token.liquidity||0))).toFixed(2)}x`});
    }
  }

  refreshShadowCopies(){
    const keep=new Map(this.shadowCopies.map(x=>[x.key,x]));
    const source=[];
    for(const c of this.candidates){
      if(c.verdict!=='FIRE'||!c.trader||!num(c.token.price))continue;
      const key=`${lower(c.trader.handle||c.trader.name)}:${lower(c.token.address)}`;
      if(source.some(x=>x.key===key))continue;
      const prev=keep.get(key);
      const currentPrice=Number(c.token.price);
      const entryPrice=prev?.entryPrice||currentPrice;
      const pnlPct=entryPrice?((currentPrice/entryPrice)-1)*100:0;
      const hist=[...(prev?.history||[]),pnlPct].slice(-18);
      const diff=pnlPct-Number(prev?.pnlPct||0);
      source.push({key,kind:'SHADOW',trader:c.trader.name||c.trader.handle||'wallet',handle:c.trader.handle||'',symbol:c.token.symbol,address:c.token.address,entryPrice,currentPrice,pnlPct,deltaPct:Math.abs(diff)>=.0005?diff:Number(prev?.deltaPct||0),history:hist,startedAt:prev?.startedAt||now(),source:c.kind,replay:this.demo});
      if(source.length>=20)break;
    }

    if(this.demo){
      const next=[];
      for(const m of this.demoMirrors){
        const t=this.tokens.find(x=>lower(x.address)===lower(m.address));if(!t||!num(t.price))continue;
        const currentPrice=Number(t.price),prevPct=Number(m.pnlPct||0);
        m.currentPrice=currentPrice;m.pnlPct=m.entryPrice?((currentPrice/m.entryPrice)-1)*100:0;
        const diff=m.pnlPct-prevPct;if(Math.abs(diff)>=.0005)m.deltaPct=diff;
        m.history=[...(m.history||[]),m.pnlPct].slice(-18);
        next.push(m);
      }
      this.demoMirrors=next;
      for(const m of this.demoMirrors){if(!source.some(x=>x.key===m.key))source.push({...m});if(source.length>=32)break;}
    }
    this.shadowCopies=source.slice(0,32);
  }

  async setRules(patch){this.rules=normalizeRules({...this.rules,...patch});this.store.rules=this.rules;await saveStore(this.store);this.rebuild();this.refreshShadowCopies();this.emit({type:'rules'});return this.rules}

  async toggleTrack(candidate){
    const key=lower(candidate.trader?.handle||candidate.trader?.name||candidate.token.symbol);
    const i=this.store.tracked.findIndex(x=>lower(x)===key);
    if(i>=0)this.store.tracked.splice(i,1);else this.store.tracked.unshift(candidate.trader?.handle||candidate.trader?.name||candidate.token.symbol);
    await saveStore(this.store);this.emit({type:'tracked'});return i<0;
  }

  async openPaper(candidate){
    const d=evaluate({token:candidate.token,trader:candidate.trader,rules:this.rules,openPositions:this.store.positions.length,spentEth:Number(this.store.spentEth||0)});
    if(d.verdict!=='FIRE')return{ok:false,reasons:d.reasons};
    const px=Number(candidate.token.price||0);
    if(!px)return{ok:false,reasons:['market price unavailable']};
    const pos={id:`paper:${Date.now()}:${candidate.token.address}`,openedAt:now(),tokenAddress:candidate.token.address,symbol:candidate.token.symbol,trader:candidate.trader?.name||candidate.trader?.handle||'market',entryPrice:px,currentPrice:px,sizeEth:this.rules.buySizeEth,pnlPct:0,peakPct:0,status:'OPEN'};
    this.store.positions.unshift(pos);this.store.spentEth=Number(this.store.spentEth||0)+this.rules.buySizeEth;
    await saveStore(this.store);
    this.pushEvent('COPY',{candidate,message:`paper copy opened · ${this.rules.buySizeEth.toFixed(3)} ETH · @${pos.trader}`});
    this.emit({type:'position',action:'open',pos});return{ok:true,pos};
  }

  async closePaper(id,reason='manual'){
    const i=this.store.positions.findIndex(x=>x.id===id);if(i<0)return null;
    const [p]=this.store.positions.splice(i,1);p.closedAt=now();p.exitReason=reason;p.status='CLOSED';
    this.store.closed.unshift(p);this.store.closed=this.store.closed.slice(0,100);
    await saveStore(this.store);
    const c=this.candidates.find(x=>lower(x.token.address)===lower(p.tokenAddress));
    this.pushEvent('EXIT',{candidate:c,message:`$${p.symbol} ${Number(p.pnlPct)>=0?'+':''}${Number(p.pnlPct||0).toFixed(2)}% · ${reason}`});
    this.emit({type:'position',action:'close',pos:p});return p;
  }

  async markPositions(){
    let dirty=false;
    for(const p of [...this.store.positions]){
      const t=this.tokens.find(x=>lower(x.address)===lower(p.tokenAddress));
      if(!t||!Number(t.price)||!Number(p.entryPrice))continue;
      const prev=Number(p.pnlPct||0);
      p.currentPrice=Number(t.price);p.pnlPct=(p.currentPrice/p.entryPrice-1)*100;p.peakPct=Math.max(Number(p.peakPct||0),p.pnlPct);
      const held=(Date.now()-new Date(p.openedAt).getTime())/60000;
      let reason=null;
      if(p.pnlPct>=this.rules.takeProfitPct)reason='take profit';
      else if(p.pnlPct<=this.rules.stopLossPct)reason='stop loss';
      else if(p.peakPct>0&&p.pnlPct<=p.peakPct-this.rules.trailingPct)reason='trailing stop';
      else if(held>=this.rules.maxHoldMin)reason='max hold';
      if(reason){await this.closePaper(p.id,reason);dirty=true;continue}
      if(Math.abs(p.pnlPct-prev)>=0.03){
        const c=this.candidates.find(x=>lower(x.token.address)===lower(p.tokenAddress));
        this.pushEvent('PNL',{candidate:c,message:`paper $${p.symbol} ${p.pnlPct>=0?'+':''}${p.pnlPct.toFixed(2)}% · Δ ${(p.pnlPct-prev)>=0?'+':''}${(p.pnlPct-prev).toFixed(2)}%`});
      }
      dirty=true;
    }
    if(dirty)await saveStore(this.store);
  }

  status(){
    const modes=Object.values(this.providers);
    return{
      mode:this.demo?'REPLAY':modes.some(x=>x==='live')?'LIVE':'SNAPSHOT',
      providers:this.providers,lastSync:this.lastSync,hunters:this.hunters.length,tokens:this.tokens.length,
      trades:this.trades.length,positions:this.store.positions.length,spentEth:this.store.spentEth,rules:this.rules,
      events:this.events.length,totalEvents:this.stats.totalEvents,shadowCopies:this.shadowCopies.length,stats:{...this.stats}
    };
  }
}
