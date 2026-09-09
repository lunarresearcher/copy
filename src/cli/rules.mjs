export const DEFAULT_RULES={
  minScore:60,
  maxMarketCap:250_000_000,
  minLiquidity:20_000,
  maxPositions:3,
  requireLeader:true,
  buySizeEth:0.01,
  sessionBudgetEth:0.05,
  takeProfitPct:80,
  stopLossPct:-35,
  trailingPct:25,
  maxHoldMin:45
};
export function normalizeRules(x={}){const r={...DEFAULT_RULES,...x};for(const k of ['minScore','maxMarketCap','minLiquidity','maxPositions','buySizeEth','sessionBudgetEth','takeProfitPct','stopLossPct','trailingPct','maxHoldMin'])r[k]=Number(r[k]);r.requireLeader=r.requireLeader!==false;return r}
export function evaluate({token,trader,rules,openPositions=0,spentEth=0}){
  const reasons=[];
  if(rules.requireLeader&&!trader)reasons.push('no confirmed Fomo trader');
  if(Number(token.score||0)<rules.minScore)reasons.push(`score ${token.score||0} < ${rules.minScore}`);
  if(Number(token.marketCap||0)>rules.maxMarketCap)reasons.push(`mcap $${Math.round(Number(token.marketCap)/1e6)}M > $${Math.round(rules.maxMarketCap/1e6)}M`);
  if(Number(token.liquidity||0)<rules.minLiquidity)reasons.push(`liq $${Math.round(Number(token.liquidity||0)/1e3)}K < $${Math.round(rules.minLiquidity/1e3)}K`);
  if(openPositions>=rules.maxPositions)reasons.push(`open positions ${openPositions} ≥ ${rules.maxPositions}`);
  if(spentEth+rules.buySizeEth>rules.sessionBudgetEth+1e-12)reasons.push(`session budget ${spentEth.toFixed(3)} + ${rules.buySizeEth.toFixed(3)} > ${rules.sessionBudgetEth.toFixed(3)} ETH`);
  return{verdict:reasons.length?'SKIP':'FIRE',reasons};
}
