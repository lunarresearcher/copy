const clamp=(n,a=0,b=100)=>Math.max(a,Math.min(b,n));
const logScore=(v,base)=>Math.log10(Math.max(1,v))/Math.log10(base);

export function walletScore(w, maxPnl = 1) {
  const pnl = Math.max(0, Number(w.pnl24h ?? w.pnl7d ?? w.pnl30d ?? 0));
  const pnlPart = clamp(Math.sqrt(pnl / Math.max(1,maxPnl))*42,0,42);
  const breadth = clamp(Math.log2(1+Number(w.coins||0))*5.3,0,18);
  const trades = clamp(Math.log10(1+Number(w.trades||0))*7.2,0,17);
  const followers = clamp(Math.log10(1+Number(w.followers||0))*2.7,0,11);
  const consistency = w.pnl7d && w.pnl30d ? clamp((Number(w.pnl7d)/Math.max(1,Number(w.pnl30d)))*27,0,9) : 4;
  return Math.round(clamp(13+pnlPart+breadth+trades+followers+consistency));
}

export function tokenScore(t) {
  const ageSec = Math.max(1, Number(t.ageSec||1));
  const buyers = Number(t.uniqueBuyers||0);
  const buys = Number(t.buys||0), sells=Number(t.sells||0);
  const buyPressure = buys+sells ? buys/(buys+sells) : 0.5;
  const quote = Number(t.quoteVolume||0);
  const fresh = clamp(28 - Math.log10(ageSec)*7, 3, 28);
  const flow = clamp(buyPressure*25, 0, 25);
  const smart = clamp(Math.log2(1+buyers)*8, 0, 24);
  const vol = clamp(logScore(1+quote,1e5)*17,0,17);
  return Math.round(clamp(8+fresh+flow+smart+vol));
}

export function marketTokenScore(t){
  const buys=Number(t.buys||0),sells=Number(t.sells||0),tx=buys+sells;
  const pressure=tx?buys/tx:.5;
  const volume=Math.max(0,Number(t.volume24h||0));
  const liq=Math.max(0,Number(t.liquidity||0));
  const mcap=Math.max(0,Number(t.marketCap||0));
  const change=Number(t.change24h||0);
  const flow=clamp(pressure*26,0,26);
  const activity=clamp(Math.log10(1+tx)*8,0,16);
  const volumePart=clamp(Math.log10(1+volume)/6*18,0,18);
  const liqPart=clamp(Math.log10(1+liq)/6*16,0,16);
  const momentum=clamp((change+30)/6,0,12);
  const capSweet=mcap>0?clamp(12-Math.abs(Math.log10(mcap)-5.3)*5,2,12):4;
  return Math.round(clamp(8+flow+activity+volumePart+liqPart+momentum+capSweet));
}
