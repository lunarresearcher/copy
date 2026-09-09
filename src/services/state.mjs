import { EventEmitter } from 'node:events';
import { readJson, writeJsonAtomic } from './cache.mjs';
import { walletScore, tokenScore, marketTokenScore } from './scoring.mjs';
import { defaultCopyRule, normalizeCopyRule, matchingRule, convictionFor, evaluateCopy } from './copy-engine.mjs';

const lower=x=>String(x||'').toLowerCase();
const tradeKey=t=>String(t?.id||t?.txHash||[t?.handle||t?.wallet,t?.tokenAddress||t?.token,t?.createdAt].join(':'));
const dedupeByAddress=list=>{const m=new Map();for(const x of list){const a=lower(x?.token||x?.address);if(!a)continue;const prev=m.get(a);if(!prev||Number(x?.liquidity||0)>Number(prev?.liquidity||0))m.set(a,{...prev,...x})}return [...m.values()]};
export class State extends EventEmitter {
  constructor(cacheFile,seed){super();this.cacheFile=cacheFile;this.seed=seed;this.data={updatedAt:null,status:{fomo:'starting',chain:'starting',dex:'starting',fomoStream:'idle'},leaderboard:seed.leaderboard||[],profiles:seed.profiles||[],verifiedPositions:seed.verifiedPositions||[],fomoTrades:[],fomoTrending:[],dexTokens:seed.dexTokens||[],chain:{launches:[],trades:[],head:'0'},hunters:[],alpha:[],trackedWallets:[],trackedProfiles:[],copyRules:[],copyActivity:[],executor:{mode:'queue',ready:true,lastSync:null},sources:{}}}
  async hydrate(){
    const c=await readJson(this.cacheFile,null);
    if(!c)return;
    this.data={
      ...this.data,
      ...c,
      // A partial/empty cache must never erase the last-known-good discovery universe.
      leaderboard:c.leaderboard?.length?c.leaderboard:(this.seed.leaderboard||[]),
      profiles:c.profiles?.length?c.profiles:(this.seed.profiles||[]),
      verifiedPositions:this.seed.verifiedPositions?.length?this.seed.verifiedPositions:(c.verifiedPositions||[]),
      dexTokens:c.dexTokens?.length?c.dexTokens:(this.seed.dexTokens||[]),
      status:{...(c.status||{}),fomo:'starting',chain:'starting',dex:'starting',fomoStream:'idle'}
    };
  }
  async save(){await writeJsonAtomic(this.cacheFile,this.data)}
  broadcast(type,payload={}){this.emit('event',{type,payload,ts:Date.now()})}
  setFomo({leaderboard,trades,fresh,provider,error=null}){
    if(leaderboard?.length){
      const previous=this.data.leaderboard||[],map=new Map();
      const key=x=>lower(x?.handle||x?.id||x?.name);
      // Incoming rows win, but a short provider response never collapses the board.
      for(const x of previous){const k=key(x);if(k)map.set(k,x)}
      for(const x of leaderboard){const k=key(x);if(k)map.set(k,{...(map.get(k)||{}),...x})}
      this.data.leaderboard=[...map.values()].sort((a,b)=>Number(a.rank24h||a.rank||9999)-Number(b.rank24h||b.rank||9999)).slice(0,140);
    }
    if(Array.isArray(trades))this.data.fomoTrades=this.mergeTrades(this.data.fomoTrades,trades,700);
    this.data.sources.fomo={fresh:!!fresh,provider,lastSync:new Date().toISOString(),error};this.data.status.fomo=error?'degraded':'online';this.recompute();if(Array.isArray(trades))this.processCopyTrades(trades);this.broadcast('fomo')
  }
  mergeTrades(current,incoming,limit=700){const map=new Map();for(const t of [...incoming,...(current||[])]){const k=tradeKey(t);if(k&&!map.has(k))map.set(k,t)}return [...map.values()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,limit)}
  pushFomoTrades(trades){if(!trades?.length)return;this.data.fomoTrades=this.mergeTrades(this.data.fomoTrades,trades,800);this.data.sources.fomoStream={...(this.data.sources.fomoStream||{}),fresh:true,lastSync:new Date().toISOString()};this.recompute();this.processCopyTrades(trades);this.broadcast('fomo-trade',{count:trades.length})}
  setFomoTrending(items,{replace=false}={}){if(!items?.length)return;const map=new Map((replace?[]:this.data.fomoTrending||[]).map(x=>[lower(x.address),x]));for(const x of items)if(x?.address)map.set(lower(x.address),{...map.get(lower(x.address)),...x,updatedAt:new Date().toISOString()});this.data.fomoTrending=[...map.values()].sort((a,b)=>Number(b.volume24h||0)-Number(a.volume24h||0)).slice(0,120);this.data.sources.fomoStream={...(this.data.sources.fomoStream||{}),fresh:true,lastSync:new Date().toISOString()};this.recompute();this.broadcast('fomo-trending',{count:items.length})}
  setFomoStreamStatus(status){this.data.status.fomoStream=status.connected?'online':status.error?'degraded':'connecting';this.data.sources.fomoStream={...(this.data.sources.fomoStream||{}),fresh:!!status.connected,lastAttempt:new Date().toISOString(),error:status.error||null};this.broadcast('fomo-stream',status)}
  setChain(chain,error=null){if(chain)this.data.chain=chain;this.data.sources.chain={fresh:!error,provider:'robinhood-rpc',lastSync:new Date().toISOString(),error};this.data.status.chain=error?'degraded':'online';this.recompute();if(chain?.trades?.length)this.processCopyTrades(chain.trades);this.broadcast('chain')}
  setDex({items,fresh=true,provider='dexscreener',profileCount=0,boostCount=0},error=null){
    if(items?.length){
      const map=new Map((this.data.dexTokens||[]).map(x=>[lower(x.address||x.token),x]));
      for(const x of items){const k=lower(x.address||x.token);if(k)map.set(k,{...(map.get(k)||{}),...x})}
      this.data.dexTokens=[...map.values()].sort((a,b)=>Number(b.volume24h||0)-Number(a.volume24h||0)).slice(0,180);
    }
    this.data.sources.dex={fresh:!!fresh&&!error,provider,lastSync:new Date().toISOString(),profileCount,boostCount,error};this.data.status.dex=error?'degraded':'online';this.recompute();this.broadcast('dex',{count:items?.length||0})
  }

  setCopyRule(input){
    const previous=(this.data.copyRules||[]).find(x=>x.id===`${input.kind==='wallet'?'wallet':'profile'}:${lower(String(input.subject||'').replace(/^@/,''))}`)||{};
    const rule=normalizeCopyRule(input,previous);
    if(!rule.subject)throw new Error('copy subject required');
    const list=(this.data.copyRules||[]).filter(x=>x.id!==rule.id);list.unshift(rule);this.data.copyRules=list.slice(0,100);
    if(rule.kind==='profile'&&!this.data.trackedProfiles.some(x=>lower(x)===lower(rule.subject)))this.data.trackedProfiles.push(rule.subject);
    if(rule.kind==='wallet'&&!this.data.trackedWallets.some(x=>lower(x)===lower(rule.subject)))this.data.trackedWallets.push(rule.subject);
    this.broadcast('copy-rule',{id:rule.id});return rule;
  }
  removeCopyRule(id){this.data.copyRules=(this.data.copyRules||[]).filter(x=>x.id!==id);this.broadcast('copy-rule',{id,removed:true})}
  armManual(input){const tokenAddress=String(input.tokenAddress||'');if(!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress))throw new Error('valid token required');const entry={ruleId:'manual:fast-follow',kind:'manual',subject:'Fast Follow',subjectName:input.subjectName||'Manual signal',tradeId:String(input.tradeId||`manual:${Date.now()}`),tokenAddress,symbol:input.symbol||'TOKEN',sourceTradeAt:input.sourceTradeAt||new Date().toISOString(),createdAt:new Date().toISOString(),sizeEth:Math.max(.001,Number(input.sizeEth)||.05),conviction:Math.max(1,Number(input.conviction)||1),marketCap:Math.max(0,Number(input.marketCap)||0),liquidity:Math.max(0,Number(input.liquidity)||0),action:'BUY',status:'ARMED',reason:'manual Fast Follow · native execution queued'};this.data.copyActivity.unshift(entry);this.data.copyActivity=this.data.copyActivity.slice(0,160);this.broadcast('copy',{count:1,manual:true});return entry}
  processCopyTrades(incoming=[]){
    const rules=(this.data.copyRules||[]).filter(x=>x.enabled),dex=new Map((this.data.dexTokens||[]).map(x=>[lower(x.address||x.token),x])),all=[...(this.data.fomoTrades||[]),...(this.data.chain?.trades||[])],seen=new Set((this.data.copyActivity||[]).map(x=>`${x.ruleId}:${x.tradeId}`));let added=0;
    for(const trade of incoming||[]){for(const rule of rules){if(!matchingRule(rule,trade))continue;const tradeTs=new Date(trade?.createdAt||0).getTime(),ruleTs=new Date(rule.createdAt||rule.updatedAt||0).getTime();if(Number.isFinite(tradeTs)&&Number.isFinite(ruleTs)&&tradeTs<ruleTs-5000)continue;const tradeId=String(trade?.id||trade?.txHash||`${trade?.handle||trade?.wallet}:${trade?.tokenAddress||trade?.token}:${trade?.createdAt}`),dedupe=`${rule.id}:${tradeId}`;if(seen.has(dedupe))continue;const token=dex.get(lower(trade.tokenAddress||trade.token))||{},conviction=convictionFor(all,trade.tokenAddress||trade.token,trade.createdAt),latestByToken=new Map();for(const x of this.data.copyActivity||[]){if(x.ruleId!==rule.id||!x.tokenAddress||latestByToken.has(lower(x.tokenAddress)))continue;latestByToken.set(lower(x.tokenAddress),x)}const openCount=[...latestByToken.values()].filter(x=>x.action==='BUY'&&x.status==='ARMED').length,entry=evaluateCopy({trade,rule,token,conviction,openCount});this.data.copyActivity.unshift(entry);seen.add(dedupe);added++}}
    if(added){this.data.copyActivity=this.data.copyActivity.slice(0,160);this.broadcast('copy',{count:added})}
  }
  recompute(){
    const board=this.data.leaderboard||[],profileOnly=(this.data.profiles||[]).filter(p=>!board.some(w=>lower(w.handle)===lower(p.handle))).map(p=>({...p,rank:null,rank24h:null})),list=[...board,...profileOnly],max=Math.max(1,...list.map(x=>Number(x.pnl24h||x.pnl7d||x.pnl30d||0))),byHandle=new Map((this.data.profiles||[]).map(x=>[lower(x.handle),x])),positions=new Map((this.data.verifiedPositions||[]).map(x=>[lower(x.handle),x])),recentByHandle=new Map();
    for(const t of this.data.fomoTrades||[]){const k=lower(t.handle);if(!k)continue;const a=recentByHandle.get(k)||[];if(a.length<30)a.push(t);recentByHandle.set(k,a)}
    this.data.hunters=list.slice(0,120).map(w=>{const p=byHandle.get(lower(w.handle))||{},recent=recentByHandle.get(lower(w.handle))||[],merged={...p,...w,pnl7d:w.pnl7d??p.pnl7d,pnl30d:w.pnl30d??p.pnl30d,followers:w.followers??p.followers,trades:w.trades??p.trades,recentTrades:recent.length,lastTrade:recent[0]||null,focusPosition:positions.get(lower(w.handle))||null};return {...merged,score:walletScore(merged,max)}}).sort((a,b)=>b.score-a.score||Number(b.pnl24h||0)-Number(a.pnl24h||0));
    const dexMap=new Map((this.data.dexTokens||[]).map(x=>[lower(x.address||x.token),x])),allTrades=[...(this.data.fomoTrades||[]),...(this.data.chain?.trades||[])],launches=this.data.chain?.launches||[],now=Date.now(),launchMap=new Map();
    for(const l of launches){const key=lower(l.token),market=dexMap.get(key)||{};launchMap.set(key,{...market,...l,address:l.token,token:l.token,source:l.protocol||'PONS',buys:0,sells:0,uniqueBuyers:0,quoteVolume:0,buyerSet:new Set(),ageSec:Math.max(1,(now-new Date(l.createdAt).getTime())/1000),website:market.website||null,url:market.url||`https://dexscreener.com/robinhood/${l.token}`})}
    for(const t of allTrades){const key=lower(t.tokenAddress||t.token);if(!launchMap.has(key))continue;const x=launchMap.get(key);if(t.side==='BUY'){x.buys++;const w=t.wallet||t.userId;if(w)x.buyerSet.add(lower(w))}else if(t.side==='SELL')x.sells++;x.quoteVolume+=Number(t.usdAmount||t.quoteAmount||0)}
    const launchAlpha=[...launchMap.values()].map(x=>{x.uniqueBuyers=x.buyerSet.size;delete x.buyerSet;return{...x,score:Math.max(tokenScore(x),marketTokenScore(x)),kind:'launch',real:true}});
    const launchKeys=new Set(launchAlpha.map(x=>lower(x.token)));
    const trendAlpha=(this.data.fomoTrending||[]).filter(x=>x.address&&!launchKeys.has(lower(x.address))).map(x=>{const market=dexMap.get(lower(x.address))||{};const z={...x,...market,address:x.address,token:x.address,protocol:'FOMO TRENDING',symbol:market.symbol||x.symbol,name:market.name||x.name,website:market.website||null,url:market.url||`https://dexscreener.com/robinhood/${x.address}`,source:'FOMO + DEX',kind:'market',real:true};return{...z,score:marketTokenScore(z)}});
    const used=new Set([...launchKeys,...trendAlpha.map(x=>lower(x.token))]);
    const dexAlpha=(this.data.dexTokens||[]).filter(x=>x.address&&!used.has(lower(x.address))).map(x=>{const z={...x,token:x.address,protocol:x.profiled?'DEX PROFILE':'DEX MARKET',source:'DEXSCREENER',kind:'market',real:true};return{...z,score:marketTokenScore(z)}});
    this.data.alpha=dedupeByAddress([...launchAlpha,...trendAlpha,...dexAlpha]).sort((a,b)=>Number(b.score||0)-Number(a.score||0)||Number(b.volume24h||0)-Number(a.volume24h||0)).slice(0,100);
    this.data.updatedAt=new Date().toISOString();
  }
  public(){return this.data}
}
