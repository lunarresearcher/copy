const lower=x=>String(x||'').toLowerCase();
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const validAddr=a=>/^0x[a-fA-F0-9]{40}$/.test(String(a||''));
export const copyRuleId=(kind,subject)=>`${kind}:${lower(subject)}`;
export function defaultCopyRule({kind='profile',subject,name=''}){
  return {id:copyRuleId(kind,subject),kind,subject:String(subject||''),name:name||String(subject||''),enabled:true,copyBuys:true,copySells:true,sizeEth:.05,maxMarketCap:3_000_000,minLiquidity:20_000,maxTaxPct:3,slippagePct:10,minConviction:1,takeProfitPct:200,stopLossPct:-35,maxConcurrent:5,fastFollow:true,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
}
export function normalizeCopyRule(input,previous={}){
  const kind=input.kind==='wallet'?'wallet':'profile',subject=String(input.subject||previous.subject||'').replace(/^@/,'').trim();
  return {...defaultCopyRule({kind,subject,name:input.name||previous.name}),...previous,...input,kind,subject,id:copyRuleId(kind,subject),enabled:input.enabled!==false,copyBuys:input.copyBuys!==false,copySells:input.copySells!==false,sizeEth:Math.max(.001,Math.min(100,num(input.sizeEth,previous.sizeEth??.05))),maxMarketCap:Math.max(0,num(input.maxMarketCap,previous.maxMarketCap??3_000_000)),minLiquidity:Math.max(0,num(input.minLiquidity,previous.minLiquidity??20_000)),maxTaxPct:Math.max(0,Math.min(100,num(input.maxTaxPct,previous.maxTaxPct??3))),slippagePct:Math.max(.1,Math.min(100,num(input.slippagePct,previous.slippagePct??10))),minConviction:Math.max(1,Math.min(20,Math.round(num(input.minConviction,previous.minConviction??1)))),takeProfitPct:Math.max(0,num(input.takeProfitPct,previous.takeProfitPct??200)),stopLossPct:Math.min(0,num(input.stopLossPct,previous.stopLossPct??-35)),maxConcurrent:Math.max(1,Math.min(50,Math.round(num(input.maxConcurrent,previous.maxConcurrent??5)))),fastFollow:input.fastFollow!==false,updatedAt:new Date().toISOString()};
}
export function matchingRule(rule,trade){
  if(!rule?.enabled||!trade)return false;
  if(rule.kind==='profile')return lower(rule.subject)===lower(trade.handle);
  return lower(rule.subject)===lower(trade.wallet);
}
export function convictionFor(trades,tokenAddress,createdAt,windowMs=120000){
  const token=lower(tokenAddress),at=new Date(createdAt||Date.now()).getTime(),set=new Set();
  for(const t of trades||[]){if(lower(t.tokenAddress||t.token)!==token||String(t.side||'').toUpperCase()!=='BUY')continue;const ts=new Date(t.createdAt||0).getTime();if(!Number.isFinite(ts)||Math.abs(at-ts)>windowMs)continue;const actor=lower(t.handle||t.wallet||t.userId);if(actor)set.add(actor)}
  return set.size;
}
export function evaluateCopy({trade,rule,token={},conviction=1,openCount=0}){
  const side=String(trade?.side||'').toUpperCase(),symbol=trade?.symbol||token?.symbol||'TOKEN',tokenAddress=trade?.tokenAddress||trade?.token||token?.address||token?.token;
  const base={ruleId:rule.id,kind:rule.kind,subject:rule.subject,subjectName:rule.name||rule.subject,tradeId:String(trade?.id||trade?.txHash||`${trade?.handle||trade?.wallet}:${tokenAddress}:${trade?.createdAt}`),tokenAddress,symbol,sourceTradeAt:trade?.createdAt||new Date().toISOString(),createdAt:new Date().toISOString(),sizeEth:rule.sizeEth,conviction,marketCap:num(token.marketCap,0),liquidity:num(token.liquidity,0),maxTaxPct:rule.maxTaxPct,slippagePct:rule.slippagePct,takeProfitPct:rule.takeProfitPct,stopLossPct:rule.stopLossPct};
  const skip=reason=>({...base,action:side==='SELL'?'SELL':'BUY',status:'SKIPPED',reason});
  if(!validAddr(tokenAddress))return skip('token address unavailable');
  if(side==='BUY'){
    if(!rule.copyBuys)return skip('copy buys disabled');
    if(rule.maxMarketCap>0&&num(token.marketCap,0)>rule.maxMarketCap)return skip('market cap above limit');
    if(rule.minLiquidity>0&&num(token.liquidity,0)>0&&num(token.liquidity,0)<rule.minLiquidity)return skip('liquidity below floor');
    if(conviction<rule.minConviction)return skip(`needs ${rule.minConviction} wallet conviction`);
    if(openCount>=rule.maxConcurrent)return skip('max concurrent positions reached');
    return {...base,action:'BUY',status:'ARMED',reason:rule.fastFollow?'rules passed · native fast follow queued':'rules passed · native execution queued'};
  }
  if(side==='SELL'){
    if(!rule.copySells)return skip('copy sells disabled');
    return {...base,action:'SELL',status:'EXIT',reason:'copied wallet exit detected'};
  }
  return skip('unsupported flow event');
}
