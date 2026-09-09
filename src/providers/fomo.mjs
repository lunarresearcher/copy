const FOMO_HOST='https://prod-api.fomo.family';
const FOMO_WS='wss://prod-api.fomo.family/ws';
const SUPPORTED_CHAINS='1,56,143,4663,8453,1399811149';
const RH=4663;

const n=v=>{const x=Number(String(v??'').replace(/[$,+]/g,''));return Number.isFinite(x)?x:null};
const arr=v=>Array.isArray(v)?v:[];
const ro=d=>d?.responseObject??d?.data??d??{};
const decode=s=>String(s).replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const handleOf=u=>String(u?.userHandle||u?.handle||u?.username||'').replace(/^@/,'');
const cleanText=s=>decode(String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
const scaleProfit=(v,u='')=>{const x=Number(String(v||'').replace(/,/g,''));if(!Number.isFinite(x))return null;return x*({k:1e3,m:1e6,b:1e9}[String(u).toLowerCase()]||1)};
const FOMP_HANDLES=new Map(Object.entries({
  'unipcs':'Unipcs','avast':'0xAvast','ajc':'AvgJoesCrypto','theslstice':'The__Solstice','ddumbcrayoneater':'DumbCrayonEater','vee':'theveeman','ethermonk':'ether_monk','ethermonk ':'ether_monk','zzeri_terminal':'zeri_terminal','ogle':'ogle','b the bezel':'BtheBezel'
}));
const fompKey=name=>String(name||'').toLowerCase().replace(/[📿✨🍃🕊️◎]/g,'').replace(/[^\p{L}\p{N}_. ]/gu,'').replace(/\s+/g,' ').trim();

export function normalizeLeaderboard(items,window='24h'){
  return arr(items).map((u,i)=>({
    id:u.id||u.userId||u.uid||null,
    rank:Number(u.rank||i+1),
    name:u.displayName||u.name||u.username||u.userHandle||u.handle||`Trader ${i+1}`,
    handle:handleOf(u),
    avatar:u.profileImageUrl||u.avatarUrl||u.avatar||u.imageUrl||null,
    followers:n(u.followers??u.followerCount),
    trades:n(u.trades??u.tradeCount??u.totalTrades),
    volume:n(u.volume??u.totalVolume??u.volumeUsd),
    coins:n(u.coins??u.coinCount??u.tokenCount??u.positionsCount),
    pnl24h:window==='24h'?n(u.pnl??u.profit??u.realizedPnl??u.pnl24h):n(u.pnl24h),
    pnl7d:window==='7d'?n(u.pnl??u.profit??u.realizedPnl??u.pnl7d):n(u.pnl7d),
    pnl30d:window==='30d'?n(u.pnl??u.profit??u.realizedPnl??u.pnl30d):n(u.pnl30d),
    winRate:n(u.winRate??u.winrate??u.winningTradePercent),
    source:'FOMO'
  })).filter(x=>x.handle||x.name)
}

export function normalizeTrade(x){
  const b=x?.body||{},tt=arr(b.topTraders)[0]||{},token=x?.token||b.token||{};
  const networkId=Number(x?.networkId||b.networkId||token.networkId||0);
  const type=String(x?.type||b.type||x?.feedType||'').toLowerCase();
  const side=type.includes('sell')?'SELL':type.includes('buy')?'BUY':String(x?.side||b.side||'').toUpperCase();
  const wallet=x?.evmAddress||x?.walletAddress||x?.tradingAccountAddress||x?.swapAddress||b.evmAddress||b.walletAddress||b.tradingAccountAddress||b.swapAddress||tt.evmAddress||tt.walletAddress||null;
  return {
    id:String(x?.tradeId||x?.id||[x?.userId||tt.id,token.address||x?.tokenAddress,x?.createdAt].join(':')),
    userId:x?.userId||tt.id||b.userId||null,
    name:x?.displayName||tt.displayName||b.displayName||x?.userHandle||tt.userHandle||'Fomo trader',
    handle:String(x?.userHandle||tt.userHandle||b.userHandle||'').replace(/^@/,''),
    wallet,
    side,
    networkId,
    tokenAddress:x?.tokenAddress||token.address||b.tokenAddress||null,
    symbol:x?.ticker||token.symbol||b.tokenSymbol||'?',
    tokenName:token.name||b.tokenName||null,
    usdAmount:n(x?.usdAmount??b.usdAmount??x?.amountUsd),
    price:n(x?.price??b.price),
    marketCap:n(x?.marketCap??b.marketCap??token.marketCap),
    createdAt:x?.createdAt||b.createdAt||new Date().toISOString(),
    txHash:x?.txHash||b.txHash||x?.transactionHash||null,
    source:'FOMO'
  }
}

export function normalizeTrending(x){
  const t=x?.token||x||{};
  const networkId=Number(t.networkId??x?.networkId??0);
  return {
    address:t.address||x?.address||null,
    networkId,
    symbol:t.symbol||x?.symbol||'?',
    name:t.name||x?.name||'Robinhood token',
    image:t.imageUrl||t.image||x?.imageUrl||x?.image||null,
    price:n(x?.price??t.price),
    marketCap:n(x?.marketCap??t.marketCap),
    liquidity:n(x?.liquidity??x?.liquidityUsd??t.liquidity),
    volume24h:n(x?.volume24h??x?.volumeUsd24h??x?.volume??t.volume24h),
    change24h:n(x?.priceChange24h??x?.change24h??x?.percentageChange24h),
    buys:n(x?.buys24h??x?.buyCount??x?.buys),
    sells:n(x?.sells24h??x?.sellCount??x?.sells),
    holders:n(x?.holderCount??t.holderCount),
    updatedAt:new Date().toISOString(),
    source:'FOMO'
  }
}

async function callJson(url,headers={}){
  const r=await fetch(url,{headers,signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw new Error(`${new URL(url).hostname} ${r.status}`);
  return r.json()
}
async function fomoCall(path,bearer,params={}){
  const u=new URL(FOMO_HOST+path);
  Object.entries(params).forEach(([k,v])=>v!=null&&u.searchParams.set(k,String(v)));
  return callJson(u,{Authorization:`Bearer ${bearer}`,'X-Supported-Chains':SUPPORTED_CHAINS,'Content-Type':'application/json'})
}
async function replyCall(path,key,params={}){
  const u=new URL(`https://api.replynodes.com/v1/fomo${path}`);
  Object.entries(params).forEach(([k,v])=>v!=null&&u.searchParams.set(k,String(v)));
  return callJson(u,{Authorization:`Bearer ${key}`})
}

export class FomoProvider{
  constructor({bearer='',replyNodesKey='',replyNodesChain='robinhood'}={}){
    this.bearer=bearer;
    this.replyNodesKey=replyNodesKey;
    this.replyNodesChain=replyNodesChain;
    this.mode=replyNodesKey?'replynodes':bearer?'direct':'fomp-public';
    this.ws=null;this.wsRetry=1000;this.wsStopped=false;
  }
  async leaderboard(window='24h',limit=100){
    if(this.replyNodesKey){
      const d=await replyCall(`/leaderboard/${window}`,this.replyNodesKey,{chain:this.replyNodesChain,limit}),b=ro(d),list=b.leaderboard||b.items||b.users||d.leaderboard||d.items||[];
      return{items:normalizeLeaderboard(list,window),fresh:true,source:'FOMO',provider:'replynodes'}
    }
    if(this.bearer&&window==='24h'){
      const d=await fomoCall('/v2/leaderboard',this.bearer,{limit}),b=ro(d);
      return{items:normalizeLeaderboard(b.leaderboard||b.items||[],window),fresh:true,source:'FOMO',provider:'direct'}
    }
    return this.publicCapture(window,limit)
  }
  async publicCapture(window='24h',limit=100){
    const tw=window==='24h'?'24h':window;
    const r=await fetch(`https://www.fomp.app/?tw=${encodeURIComponent(tw)}`,{headers:{'user-agent':'COPY/1.0 read-only Fomo leaderboard mirror'},signal:AbortSignal.timeout(12000)});
    if(!r.ok)throw new Error(`Fomo public leaderboard mirror ${r.status}`);
    const html=await r.text(),out=[];
    // fomp SSRs each leaderboard row as /kol/<id> anchors. Parsing anchors first avoids accidental feed matches.
    const anchors=[...html.matchAll(/<a[^>]+href=["']\/kol\/([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    for(const a of anchors){
      const text=cleanText(a[2]).replace(/\s+/g,' ').trim();
      const m=text.match(/^(\d{1,3})\s*(.+?)\s*\+\$([\d,.]+)\s*([KMB]?)$/i);
      if(!m)continue;
      const rank=Number(m[1]),name=m[2].trim(),profit=scaleProfit(m[3],m[4]);
      if(!rank||profit==null||out.some(x=>x.rank===rank))continue;
      const handle=FOMP_HANDLES.get(fompKey(name))||'';
      out.push({id:`fomp:${a[1]}`,rank,name,handle,profileUrl:`https://www.fomp.app/kol/${a[1]}`,pnl24h:window==='24h'?profit:null,pnl7d:window==='7d'?profit:null,pnl30d:window==='30d'?profit:null,source:'FOMO'});
      if(out.length>=limit)break;
    }
    // Resilient fallback for markup changes: only parse the TOP TRADERS segment.
    if(out.length<5){
      const text=cleanText(html),segment=(text.split(/TOP TRADERS/i)[1]||text).split(/MOST KOLS HOLDING/i)[0]||'';
      const re=/(\d{1,3})\s*([^+$]{1,80}?)\s*\+\$([\d,.]+)\s*([KMB]?)/gi;let m;
      while((m=re.exec(segment))&&out.length<limit){const rank=Number(m[1]);if(out.some(x=>x.rank===rank))continue;const name=m[2].trim(),profit=scaleProfit(m[3],m[4]);if(!rank||profit==null)continue;const handle=FOMP_HANDLES.get(fompKey(name))||'';out.push({id:`fomp:${window}:${rank}:${fompKey(name)}`,rank,name,handle,pnl24h:window==='24h'?profit:null,pnl7d:window==='7d'?profit:null,pnl30d:window==='30d'?profit:null,source:'FOMO'})}
    }
    if(!out.length)throw new Error('Fomo public leaderboard mirror could not be parsed');
    return{items:out.sort((a,b)=>a.rank-b.rank),fresh:true,source:'FOMO',provider:'fomp-public'}
  }
  async trades(limit=500,topHandles=[]){
    if(this.bearer){
      const d=await fomoCall('/feed/tradingActivity',this.bearer,{limit}),b=ro(d);
      return arr(b.items||b.feed).map(normalizeTrade).filter(x=>x.networkId===RH&&(x.side==='BUY'||x.side==='SELL'))
    }
    if(this.replyNodesKey){
      const batches=await Promise.allSettled(topHandles.filter(Boolean).slice(0,24).map(async h=>{
        const d=await replyCall(`/users/${encodeURIComponent(h)}/trades`,this.replyNodesKey,{limit:25}),b=ro(d);
        return arr(b.trades||b.items||d.trades||d.items).map(x=>normalizeTrade({...x,userHandle:x.userHandle||h}))
      }));
      return batches.flatMap(x=>x.status==='fulfilled'?x.value:[]).filter(x=>(!x.networkId||x.networkId===RH)&&(x.side==='BUY'||x.side==='SELL')).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,limit)
    }
    return[]
  }
  async trending(limit=60){
    if(this.replyNodesKey){
      const d=await replyCall('/tokens/trending',this.replyNodesKey,{limit}),b=ro(d),items=b.tokens||b.items||d.tokens||d.items||[];
      return arr(items).map(normalizeTrending).filter(x=>!x.networkId||x.networkId===RH).slice(0,limit)
    }
    return[]
  }
  async profile(handle){
    if(this.replyNodesKey)return ro(await replyCall(`/users/${encodeURIComponent(handle)}`,this.replyNodesKey));
    if(this.bearer)return ro(await fomoCall(`/v2/users/userHandle/${encodeURIComponent(handle)}`,this.bearer));
    return null
  }
  connectStream({onTrades=()=>{},onTrending=()=>{},onStatus=()=>{}}={}){
    if(!this.bearer||typeof WebSocket!=='function')return()=>{};
    this.wsStopped=false;
    const connect=()=>{
      if(this.wsStopped)return;
      let ws;try{ws=new WebSocket(FOMO_WS)}catch(e){onStatus({connected:false,error:e.message});return setTimeout(connect,this.wsRetry)}
      this.ws=ws;
      ws.onopen=()=>onStatus({connected:false,stage:'authenticating'});
      ws.onmessage=ev=>{
        let m;try{m=JSON.parse(String(ev.data))}catch{return}
        if(m.type==='challenge')return ws.send(JSON.stringify({type:'challengeResponse',jwt:this.bearer}));
        if(m.type==='challengeAccepted'){
          this.wsRetry=1000;onStatus({connected:true});
          for(const topicType of ['trending_tokens','trading_activity','feed'])ws.send(JSON.stringify({type:'subscribe',topicType,topicId:SUPPORTED_CHAINS}));
          return;
        }
        if(m.type==='data'&&m.topicType==='trending_tokens'){
          const p=m.payload||{};let list=[];
          if(p.kind==='snapshot')list=arr(p.tokens);
          else if(p.kind==='update'&&p.update)list=[p.update];
          const normalized=list.map(normalizeTrending).filter(x=>x.networkId===RH);
          if(normalized.length)onTrending({items:normalized,kind:p.kind||'update'});
        }
        if(m.type==='data'&&(m.topicType==='trading_activity'||m.topicType==='trade')){
          const p=m.payload||{};const items=Array.isArray(p)?p:arr(p.items).length?p.items:[p.trade||p.signal||p];
          const normalized=items.map(normalizeTrade).filter(x=>x.networkId===RH&&(x.side==='BUY'||x.side==='SELL'));
          if(normalized.length)onTrades(normalized);
        }
        if(m.type==='error')onStatus({connected:false,error:m.message||'Fomo websocket error',code:m.code});
      };
      ws.onclose=e=>{
        onStatus({connected:false,error:e.code===1008?'Fomo session expired':`websocket closed ${e.code}`});
        if(this.wsStopped||e.code===1008)return;
        setTimeout(connect,this.wsRetry);this.wsRetry=Math.min(this.wsRetry*2,15000)
      };
      ws.onerror=()=>{};
    };
    connect();
    return()=>{this.wsStopped=true;try{this.ws?.close()}catch{}}
  }
}
