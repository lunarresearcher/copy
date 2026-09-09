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
    this.events=[];this.shadowCopies=[];
    this.providers={fomo:'snapshot',trades:'snapshot',dex:'snapshot',rpc:'unknown'};
    this.lastSync=null;this.syncing=false;this.listeners=new Set();
    this.seenTradeIds=new Set();this.knownTokenAddresses=new Set();this.eventSeq=0;this.scanCursor=0;this.demoTickNo=0;
    this.stats={newTokens:0,tradeEvents:0,marketMoves:0,scans:0,syncs:0};
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
    this.rebuild();
    this.seedEvents();
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
    if(this.events.length>240)this.events.length=240;
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
    this.pushEvent('BOOT',{message:`snapshot loaded · ${this.hunters.length} hunters · ${this.tokens.length} RH tokens`});
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
    this.trades=[...existing.values()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,500);
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
    const byHandle=new Map(this.leaderboard.map(x=>[lower(x.handle||x.name),x]));
    const max=Math.max(1,...this.leaderboard.map(x=>Number(x.pnl24h||0)));
    this.hunters=this.leaderboard.slice(0,140).map((x,i)=>({...x,score:walletScore(x,max),rank:x.rank24h||x.rank||i+1}));
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
    this.candidates=this.candidates.filter(x=>{const k=`${x.kind}:${lower(x.token.address)}:${lower(x.trader?.handle||x.trader?.name||'market')}`;if(seen.has(k))return false;seen.add(k);return true}).slice(0,220);
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

  demoTick(){
    if(!this.demo||!this.tokens.length)return;
    this.demoTickNo++;
    const targets=this.tokens.filter(t=>num(t.price)).slice(0,4);
    for(let i=0;i<targets.length;i++){
      const t=targets[i];
      const wave=Math.sin((this.demoTickNo+i*1.7)/2.2)*0.0018 + Math.cos((this.demoTickNo+i)/3.7)*0.0008;
      const old=Number(t.price);const next=Math.max(old*0.2,old*(1+wave));
      t.price=next;
      if(num(t.marketCap))t.marketCap=Number(t.marketCap)*(next/old);
      t.volume24h=Number(t.volume24h||0)+Math.max(40,Math.abs(wave)*Number(t.volume24h||100000)*0.08);
      t.change24h=Number(t.change24h||0)+wave*100*0.12;
      t.score=marketTokenScore(t);
    }
    this.rebuild();
    this.refreshShadowCopies();
    const movedToken=targets[this.demoTickNo%Math.max(1,targets.length)];
    const c=movedToken?this.candidates.find(x=>lower(x.token.address)===lower(movedToken.address)):this.candidates[0];
    if(c)this.pushEvent(this.demoTickNo%5===0?(c.verdict==='FIRE'?'REPLAY BUY':'REPLAY SKIP'):'REPLAY MOVE',{candidate:c,message:this.demoTickNo%5===0?`replay wallet tick · ${c.reasons?.[0]||'paper copy would fire'}`:`replay market tick · $${c.token.symbol} ${Number(c.token.change24h||0)>=0?'+':''}${Number(c.token.change24h||0).toFixed(2)}% 24h`});
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
      source.push({key,kind:'SHADOW',trader:c.trader.name||c.trader.handle||'wallet',handle:c.trader.handle||'',symbol:c.token.symbol,address:c.token.address,entryPrice,currentPrice,pnlPct,deltaPct:pnlPct-Number(prev?.pnlPct||0),history:hist,startedAt:prev?.startedAt||now(),source:c.kind});
      if(source.length>=4)break;
    }
    this.shadowCopies=source;
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
      events:this.events.length,shadowCopies:this.shadowCopies.length,stats:{...this.stats}
    };
  }
}
