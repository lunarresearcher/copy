export const DEFAULT_RULES={
  // COPY-native discovery walls. These are deliberately different from the
  // generic score / max-mcap / min-liquidity box used in older builds.
  minSourceEdge:58,
  minDepthPct:1.0,
  minTurnover:0.45,
  momentumFloorPct:-15,
  momentumCeilPct:38,
  requirePrice:true,

  // Local PAPER execution box.
  maxPositions:5,
  buySizeEth:0.012,
  sessionBudgetEth:0.08,
  takeProfitPct:65,
  stopLossPct:-22,
  trailingPct:18,
  maxHoldMin:32
};

const n=(x,fallback=0)=>Number.isFinite(Number(x))?Number(x):fallback;

export function normalizeRules(x={}){
  const r={...DEFAULT_RULES,...x};
  for(const k of ['minSourceEdge','minDepthPct','minTurnover','momentumFloorPct','momentumCeilPct','maxPositions','buySizeEth','sessionBudgetEth','takeProfitPct','stopLossPct','trailingPct','maxHoldMin'])r[k]=Number(r[k]);
  r.requirePrice=r.requirePrice!==false;
  return r;
}

export function signalMetrics(token={},trader=null){
  const mcap=n(token.marketCap);
  const liq=n(token.liquidity);
  const volume=n(token.volume24h);
  return{
    sourceEdge:n(trader?.score),
    depthPct:mcap>0?(liq/mcap)*100:0,
    turnover:liq>0?volume/liq:0,
    momentum:n(token.change24h),
    hasPrice:n(token.price)>0
  };
}

export function evaluate({token,trader,rules,openPositions=0,spentEth=0}){
  const m=signalMetrics(token,trader);
  const reasons=[];
  if(!trader)reasons.push('no confirmed profit source');
  else if(m.sourceEdge<rules.minSourceEdge)reasons.push(`source edge ${Math.round(m.sourceEdge)} < ${rules.minSourceEdge}`);
  if(m.depthPct<rules.minDepthPct)reasons.push(`depth ${m.depthPct.toFixed(2)}% < ${rules.minDepthPct.toFixed(2)}%`);
  if(m.turnover<rules.minTurnover)reasons.push(`turnover ${m.turnover.toFixed(2)}x < ${rules.minTurnover.toFixed(2)}x`);
  if(m.momentum<rules.momentumFloorPct||m.momentum>rules.momentumCeilPct)reasons.push(`momentum ${m.momentum>=0?'+':''}${m.momentum.toFixed(1)}% outside ${rules.momentumFloorPct}%…+${rules.momentumCeilPct}%`);
  if(rules.requirePrice&&!m.hasPrice)reasons.push('price feed unavailable');
  if(openPositions>=rules.maxPositions)reasons.push(`paper slots ${openPositions} ≥ ${rules.maxPositions}`);
  if(spentEth+rules.buySizeEth>rules.sessionBudgetEth+1e-12)reasons.push(`session budget ${Number(spentEth).toFixed(3)} + ${rules.buySizeEth.toFixed(3)} > ${rules.sessionBudgetEth.toFixed(3)} ETH`);
  return{verdict:reasons.length?'SKIP':'FIRE',reasons,metrics:m};
}
