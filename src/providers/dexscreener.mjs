const PROFILE_URL='https://api.dexscreener.com/token-profiles/latest/v1';
const BOOST_URL='https://api.dexscreener.com/token-boosts/latest/v1';
const TOKENS_URL='https://api.dexscreener.com/tokens/v1/robinhood/';
const RH='robinhood';
const valid=a=>/^0x[a-fA-F0-9]{40}$/.test(String(a||''));
const lower=a=>String(a||'').toLowerCase();
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const KNOWN=[
  {address:'0x020bfc650a365f8bb26819deaabf3e21291018b4',symbol:'CASHCAT',name:'Cash Cat',website:'https://cashcattoken.cc/',url:'https://dexscreener.com/robinhood/0x020bfc650a365f8bb26819deaabf3e21291018b4'},
  {address:'0x39dBED3a2bd333467115dE45665cC57F813C4571',symbol:'PONS',name:'Pons',website:'https://pons.family/launchpad/0x39dBED3a2bd333467115dE45665cC57F813C4571',url:'https://dexscreener.com/robinhood/0x39dBED3a2bd333467115dE45665cC57F813C4571'},
  {address:'0x2E8c31162b855A2ffa90F6F8634643Ad6F111e18',symbol:'AI',name:'Artificial Inu',website:'https://artificialinu.com/',url:'https://dexscreener.com/robinhood/0x2E8c31162b855A2ffa90F6F8634643Ad6F111e18'},
  {address:'0x13ca23fc7c96212c411e95e506567cce9d748d3f',symbol:'KOL',name:'Kol Capital',website:'https://kol.capital/',url:'https://dexscreener.com/robinhood/0x13ca23fc7c96212c411e95e506567cce9d748d3f'},
  {address:'0x32821d4275e88a255782a05439c989cf4a5ba87c',symbol:'BURNIE',name:'Burnie',website:'https://www.burnieonrh.com/',url:'https://dexscreener.com/robinhood/0x32821d4275e88a255782a05439c989cf4a5ba87c'},
  {address:'0x993100d2B2ec49C36568A772b69691963Cfa68d5',symbol:'DUST',name:'Dust',website:'https://dustdot.fun',url:'https://dexscreener.com/robinhood/0x993100d2B2ec49C36568A772b69691963Cfa68d5'},
  {address:'0x7E797Ba9D48e6c1a68ba756dAfdE2602C3a74A3A',symbol:'PULSE',name:'PonsPulse',website:'https://ponspulse.top',url:'https://dexscreener.com/robinhood/0x7E797Ba9D48e6c1a68ba756dAfdE2602C3a74A3A'}
];
async function getJson(url){const r=await fetch(url,{headers:{accept:'application/json','user-agent':'Sherwood/1.1 (+read-only market indexer)'},signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error(`dexscreener ${r.status}`);return r.json()}
const profileWebsite=p=>p?.links?.find?.(x=>String(x?.label||'').toLowerCase()==='website')?.url||null;
const pairWebsite=p=>p?.info?.websites?.find?.(x=>x?.url)?.url||null;
function normalizePair(pair,target,profile,boost){
  const tokenAddress=valid(target)?target:(pair?.baseToken?.address||'');
  const base=lower(pair?.baseToken?.address)===lower(tokenAddress)?pair.baseToken:pair?.baseToken||{};
  const h24=pair?.txns?.h24||{};
  const created=num(pair?.pairCreatedAt);
  return {
    address:tokenAddress||base.address||null,
    token:tokenAddress||base.address||null,
    symbol:base.symbol||profile?.symbol||'TOKEN',name:base.name||profile?.name||'Robinhood token',
    image:pair?.info?.imageUrl||profile?.icon||profile?.openGraph||null,
    price:num(pair?.priceUsd),marketCap:num(pair?.marketCap??pair?.fdv),liquidity:num(pair?.liquidity?.usd),volume24h:num(pair?.volume?.h24),change24h:num(pair?.priceChange?.h24),
    buys:num(h24.buys)||0,sells:num(h24.sells)||0,txns24h:(num(h24.buys)||0)+(num(h24.sells)||0),
    pairCreatedAt:created?new Date(created).toISOString():null,ageSec:created?Math.max(1,(Date.now()-created)/1000):null,
    url:pair?.url||profile?.url||`https://dexscreener.com/robinhood/${tokenAddress}`,
    website:pairWebsite(pair)||profileWebsite(profile)||null,
    socials:pair?.info?.socials||profile?.links?.filter?.(x=>x?.type)||[],
    pairAddress:pair?.pairAddress||null,dexId:pair?.dexId||null,quoteSymbol:pair?.quoteToken?.symbol||null,
    boosted:Number(boost?.amount||boost?.totalAmount||0)||0,profiled:!!profile,source:'DEXSCREENER',updatedAt:new Date().toISOString()
  }
}
export class DexScreenerProvider{
  async sync(candidateAddresses=[]){
    const [profilesR,boostsR]=await Promise.allSettled([getJson(PROFILE_URL),getJson(BOOST_URL)]);
    const profiles=(profilesR.status==='fulfilled'?profilesR.value:[]).filter(x=>x?.chainId===RH&&valid(x.tokenAddress));
    const boosts=(boostsR.status==='fulfilled'?boostsR.value:[]).filter(x=>x?.chainId===RH&&valid(x.tokenAddress));
    const pmap=new Map(profiles.map(x=>[lower(x.tokenAddress),x])),bmap=new Map(boosts.map(x=>[lower(x.tokenAddress),x]));
    const knownMap=new Map(KNOWN.map(x=>[lower(x.address),x]));
    const addresses=[...new Set([...profiles.map(x=>x.tokenAddress),...boosts.map(x=>x.tokenAddress),...candidateAddresses,...KNOWN.map(x=>x.address)].filter(valid).map(x=>String(x)))].slice(0,120);
    const pairs=[];
    for(let i=0;i<addresses.length;i+=30){const chunk=addresses.slice(i,i+30);try{const list=await getJson(TOKENS_URL+chunk.join(','));if(Array.isArray(list))pairs.push(...list)}catch(e){if(!pairs.length&&profilesR.status==='rejected')throw e}}
    const byToken=new Map();
    for(const a of addresses){const candidates=pairs.filter(p=>lower(p?.baseToken?.address)===lower(a));candidates.sort((x,y)=>Number(y?.liquidity?.usd||0)-Number(x?.liquidity?.usd||0));const pair=candidates[0];const profile=pmap.get(lower(a));const boost=bmap.get(lower(a));if(pair){const item=normalizePair(pair,a,profile,boost),known=knownMap.get(lower(a));byToken.set(lower(a),{...known,...item,website:item.website||known?.website||null,url:item.url||known?.url||null})}else{const known=knownMap.get(lower(a));if(profile||known)byToken.set(lower(a),{...known,address:a,token:a,image:profile?.icon||profile?.openGraph||known?.image||null,website:profileWebsite(profile)||known?.website||null,url:profile?.url||known?.url||`https://dexscreener.com/robinhood/${a}`,profiled:!!profile,boosted:Number(boost?.amount||0)||0,source:'DEXSCREENER',updatedAt:new Date().toISOString()})}}
    const items=[...byToken.values()].sort((a,b)=>Number(b.profiled)-Number(a.profiled)||Number(b.volume24h||0)-Number(a.volume24h||0)||Number(b.liquidity||0)-Number(a.liquidity||0));
    return {items,provider:'dexscreener',fresh:profilesR.status==='fulfilled'||pairs.length>0,profileCount:profiles.length,boostCount:boosts.length};
  }
}
