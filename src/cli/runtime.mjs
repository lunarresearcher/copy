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
export class CopyRuntime{
  constructor({demo=false}={}){this.demo=demo;this.seed=null;this.store=null;this.rules=null;this.leaderboard=[];this.tokens=[];this.trades=[];this.verified=[];this.events=[];this.providers={fomo:'snapshot',dex:'snapshot',rpc:'unknown'};this.lastSync=null;this.syncing=false;this.listeners=new Set();this.fomo=new FomoProvider({bearer:config.fomoBearer,replyNodesKey:config.replyNodesKey,replyNodesChain:config.replyNodesChain});this.dex=new DexScreenerProvider()}
  async init(){this.seed=JSON.parse(await fs.readFile(new URL('../../data/seed.json',import.meta.url),'utf8'));this.store=await loadStore();this.rules=normalizeRules(this.store.rules||{});this.leaderboard=this.seed.leaderboard||[];this.tokens=(this.seed.dexTokens||[]).map(t=>({...t,score:marketTokenScore(t)}));this.verified=this.seed.verifiedPositions||[];this.rebuild();return this}
  on(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn)}
  emit(e){for(const fn of this.listeners)try{fn(e)}catch{}}
  async sync(){if(this.syncing)return;this.syncing=true;const started=Date.now();try{
    if(!this.demo){const [lb,dex]=await Promise.allSettled([this.fomo.leaderboard('24h',120),this.dex.sync(this.tokens.map(x=>x.address).filter(valid))]);
      if(lb.status==='fulfilled'&&lb.value.items?.length){const m=new Map(this.leaderboard.map(x=>[lower(x.handle||x.id||x.name),x]));for(const x of lb.value.items){const k=lower(x.handle||x.id||x.name);if(k)m.set(k,{...(m.get(k)||{}),...x})}this.leaderboard=[...m.values()].slice(0,140);this.providers.fomo=lb.value.provider||'live'}
      if(dex.status==='fulfilled'&&dex.value.items?.length){const m=new Map(this.tokens.map(x=>[lower(x.address),x]));for(const x of dex.value.items){const k=lower(x.address);if(k)m.set(k,{...(m.get(k)||{}),...x,score:marketTokenScore(x)})}this.tokens=[...m.values()].sort((a,b)=>Number(b.volume24h||0)-Number(a.volume24h||0));this.providers.dex='live'}
      try{const r=await fetch(config.rpcUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]}),signal:AbortSignal.timeout(5000)});const j=await r.json();this.providers.rpc=parseInt(j.result,16)===4663?'live':'wrong-chain'}catch{this.providers.rpc='degraded'}
    }
    this.lastSync=now();this.rebuild();this.addMarketPulse();this.emit({type:'sync',ms:Date.now()-started});
  }finally{this.syncing=false}}
  rebuild(){
    const byHandle=new Map(this.leaderboard.map(x=>[lower(x.handle||x.name),x]));const max=Math.max(1,...this.leaderboard.map(x=>Number(x.pnl24h||0)));
    this.hunters=this.leaderboard.slice(0,120).map((x,i)=>({...x,score:walletScore(x,max),rank:x.rank24h||x.rank||i+1}));
    this.candidates=[];
    for(const p of this.verified){const token=this.tokens.find(t=>lower(t.address)===lower(p.tokenAddress));if(!token)continue;const trader=byHandle.get(lower(p.handle))||this.hunters.find(h=>lower(h.handle)===lower(p.handle))||{name:p.name,handle:p.handle,pnl24h:p.pnl};this.candidates.push(this.makeCandidate(token,trader,{kind:'verified',pnl:p.pnl,verified:p}))}
    const used=new Set(this.candidates.map(x=>lower(x.token.address)));
    for(const token of this.tokens){if(used.has(lower(token.address)))continue;this.candidates.push(this.makeCandidate(token,null,{kind:'market'}))}
    for(const t of this.trades.slice(0,100)){const token=this.tokens.find(x=>lower(x.address)===lower(t.tokenAddress));if(!token)continue;const trader=this.hunters.find(h=>lower(h.handle)===lower(t.handle))||{name:t.name,handle:t.handle};this.candidates.unshift(this.makeCandidate(token,trader,{kind:'trade',trade:t}))}
    const seen=new Set();this.candidates=this.candidates.filter(x=>{const k=`${x.kind}:${lower(x.token.address)}:${lower(x.trader?.handle||x.trader?.name||'market')}`;if(seen.has(k))return false;seen.add(k);return true}).slice(0,150)
  }
  makeCandidate(token,trader,extra={}){const r=evaluate({token,trader,rules:this.rules,openPositions:this.store?.positions?.length||0,spentEth:Number(this.store?.spentEth||0)});return{id:`${extra.kind||'market'}:${token.address}:${trader?.handle||trader?.name||'market'}`,createdAt:extra.trade?.createdAt||extra.verified?.snapshotDate||now(),kind:extra.kind||'market',token:{...token,score:Number(token.score||marketTokenScore(token))},trader:trader||null,pnl:extra.pnl??trader?.pnl24h??null,trade:extra.trade||null,verified:extra.verified||null,...r}}
  addMarketPulse(){const fresh=this.candidates.slice(0,Math.min(4,this.candidates.length));for(const c of fresh){const key=`pulse:${c.id}:${Math.floor(Date.now()/15000)}`;if(this.events.some(e=>e.key===key))continue;this.events.unshift({key,at:now(),candidate:c,type:c.kind==='trade'?'trade':'pulse'});if(this.events.length>200)this.events.length=200}}
  async setRules(patch){this.rules=normalizeRules({...this.rules,...patch});this.store.rules=this.rules;await saveStore(this.store);this.rebuild();this.emit({type:'rules'});return this.rules}
  async toggleTrack(candidate){const key=lower(candidate.trader?.handle||candidate.trader?.name||candidate.token.symbol);const i=this.store.tracked.findIndex(x=>lower(x)===key);if(i>=0)this.store.tracked.splice(i,1);else this.store.tracked.unshift(candidate.trader?.handle||candidate.trader?.name||candidate.token.symbol);await saveStore(this.store);this.emit({type:'tracked'});return i<0}
  async openPaper(candidate){const d=evaluate({token:candidate.token,trader:candidate.trader,rules:this.rules,openPositions:this.store.positions.length,spentEth:Number(this.store.spentEth||0)});if(d.verdict!=='FIRE')return{ok:false,reasons:d.reasons};const px=Number(candidate.token.price||0);const pos={id:`paper:${Date.now()}:${candidate.token.address}`,openedAt:now(),tokenAddress:candidate.token.address,symbol:candidate.token.symbol,trader:candidate.trader?.name||candidate.trader?.handle||'market',entryPrice:px,currentPrice:px,sizeEth:this.rules.buySizeEth,pnlPct:0,peakPct:0,status:'OPEN'};this.store.positions.unshift(pos);this.store.spentEth=Number(this.store.spentEth||0)+this.rules.buySizeEth;await saveStore(this.store);this.emit({type:'position',action:'open',pos});return{ok:true,pos}}
  async closePaper(id,reason='manual'){const i=this.store.positions.findIndex(x=>x.id===id);if(i<0)return null;const [p]=this.store.positions.splice(i,1);p.closedAt=now();p.exitReason=reason;p.status='CLOSED';this.store.closed.unshift(p);this.store.closed=this.store.closed.slice(0,100);await saveStore(this.store);this.emit({type:'position',action:'close',pos:p});return p}
  async markPositions(){let dirty=false;for(const p of this.store.positions){const t=this.tokens.find(x=>lower(x.address)===lower(p.tokenAddress));if(!t||!Number(t.price)||!Number(p.entryPrice))continue;p.currentPrice=Number(t.price);p.pnlPct=(p.currentPrice/p.entryPrice-1)*100;p.peakPct=Math.max(Number(p.peakPct||0),p.pnlPct);const held=(Date.now()-new Date(p.openedAt).getTime())/60000;let reason=null;if(p.pnlPct>=this.rules.takeProfitPct)reason='take profit';else if(p.pnlPct<=this.rules.stopLossPct)reason='stop loss';else if(p.peakPct>0&&p.pnlPct<=p.peakPct-this.rules.trailingPct)reason='trailing stop';else if(held>=this.rules.maxHoldMin)reason='max hold';if(reason){await this.closePaper(p.id,reason);dirty=true;break}dirty=true}if(dirty)await saveStore(this.store)}
  status(){return{mode:this.demo?'REPLAY':Object.values(this.providers).some(x=>x==='live')?'LIVE':'SNAPSHOT',providers:this.providers,lastSync:this.lastSync,hunters:this.hunters.length,tokens:this.tokens.length,positions:this.store.positions.length,spentEth:this.store.spentEth,rules:this.rules}}
}
