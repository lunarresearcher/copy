import {A,c,lime,danger,amber,muted,soft,pad,trunc,hr} from './ansi.mjs';
import {logoLines,baraLines,miniBara} from './logo.mjs';
import {usd,pct,short,age,score,pnl,links} from './format.mjs';

const typeTag=t=>{
  const s=String(t||'SCAN').toUpperCase();
  if(['BUY','COPY','READY','MIRROR'].includes(s))return c(A.brightGreen,s.padEnd(7));
  if(['SELL','EXIT'].includes(s))return danger(s.padEnd(7));
  if(s==='NEW')return lime(s.padEnd(7));
  if(s==='MOVE'||s==='PNL')return c(A.brightCyan,s.padEnd(7));
  if(s.startsWith('REPLAY'))return amber(s.padEnd(11));
  if(s==='SYNC'||s==='BOOT')return soft(s.padEnd(7));
  return muted(s.padEnd(7));
};

const box=(title,w,lines=[])=>{
  const out=[soft('┌'+` ${title} `.padEnd(w-1,'─')+'┐')];
  for(const l of lines){const t=trunc(l,w-4);out.push(soft('│ ')+pad(t,w-4)+soft(' │'))}
  out.push(soft('└'+''.padEnd(w-2,'─')+'┘'));
  return out;
};

const spark=(vals=[],width=12)=>{
  const chars='▁▂▃▄▅▆▇█',v=vals.slice(-width).map(Number).filter(Number.isFinite);
  if(!v.length)return soft('·'.repeat(width));
  const min=Math.min(...v),max=Math.max(...v),range=max-min||1;
  const raw=v.map(x=>chars[Math.max(0,Math.min(chars.length-1,Math.round((x-min)/range*(chars.length-1))))]).join('').padStart(width,'·');
  const last=v.at(-1)||0;return last>=0?c(A.brightGreen,raw):danger(raw);
};

const meter=(v,min,max,width=9)=>{
  const p=Math.max(0,Math.min(1,(Number(v)-min)/Math.max(.00001,max-min)));
  const n=Math.round(p*width);return lime('█'.repeat(n))+soft('░'.repeat(width-n));
};

function eventRow(e,w,selected=false){
  const cand=e?.candidate,t=cand?.token,tr=cand?.trader;
  const token=t?`$${String(t.symbol||'?').padEnd(9).slice(0,9)}`:'SYSTEM'.padEnd(10);
  const trader=tr?.handle||tr?.name||'';
  const left=`${soft(age(e.at).padStart(4))} ${typeTag(e.type)} ${t?c(A.bold,token):soft(token)}`;
  const middle=t?`${score(t.score)} ${trunc(trader||'market',13).padEnd(13)}`:'   '.padEnd(17);
  const msg=e.message||cand?.reasons?.[0]||'';
  const base=`${left} ${middle} ${trunc(msg,Math.max(12,w-46))}`;
  return selected?`${lime('›')} ${trunc(base,w-2)}`:`  ${trunc(base,w-2)}`;
}

function wallRead(cand,rules){
  if(!cand)return[];
  const m=cand.metrics||{};
  const checks=[
    ['EDGE',!!cand.trader&&Number(m.sourceEdge||0)>=rules.minSourceEdge,`${Math.round(m.sourceEdge||0)} / ${rules.minSourceEdge}`],
    ['DEPTH',Number(m.depthPct||0)>=rules.minDepthPct,`${Number(m.depthPct||0).toFixed(2)}% / ${rules.minDepthPct.toFixed(2)}%`],
    ['TURN',Number(m.turnover||0)>=rules.minTurnover,`${Number(m.turnover||0).toFixed(2)}x / ${rules.minTurnover.toFixed(2)}x`],
    ['MOMO',Number(m.momentum||0)>=rules.momentumFloorPct&&Number(m.momentum||0)<=rules.momentumCeilPct,`${Number(m.momentum||0)>=0?'+':''}${Number(m.momentum||0).toFixed(1)}% / ${rules.momentumFloorPct}%…+${rules.momentumCeilPct}%`],
    ['PRICE',!rules.requirePrice||!!m.hasPrice,m.hasPrice?'live mark':'missing']
  ];
  return checks.map(([k,ok,v])=>`${ok?c(A.brightGreen,'✓'):danger('×')} ${soft(String(k).padEnd(7))} ${v}`);
}

function mirrorLines(rt,max=8){
  const paper=(rt.store.positions||[]).map(p=>({kind:'PAPER',trader:p.trader,symbol:p.symbol,pnlPct:Number(p.pnlPct||0),deltaPct:0,history:[0,Number(p.pnlPct||0)],startedAt:p.openedAt}));
  const all=[...paper,...rt.shadowCopies].slice(0,max);
  if(!all.length)return[muted('waiting for passing wallet + priced RH market')];
  return all.map(x=>{
    const label=x.kind==='PAPER'?c(A.brightGreen,'PAPER '):x.replay?amber('R-SHDW'):lime('SHADOW');
    const val=Number(x.pnlPct||0),d=Number(x.deltaPct||0);
    const p=val>=0?c(A.brightGreen,`${val>=0?'+':''}${val.toFixed(2)}%`):danger(`${val.toFixed(2)}%`);
    const delta=Math.abs(d)>=.005?(d>=0?c(A.brightGreen,`Δ+${d.toFixed(2)}`):danger(`Δ${d.toFixed(2)}`)):soft('Δ0.00');
    return `${label} ${trunc('@'+String(x.handle||x.trader||'wallet').replace(/^@/,''),17).padEnd(17)} → ${c(A.bold,'$'+String(x.symbol||'?').padEnd(8).slice(0,8))} ${p.padStart(8)} ${delta.padStart(7)} ${spark(x.history||[],10)}`;
  });
}

function radarLines(rt,max=5){
  const rows=(rt.tokens||[]).filter(t=>Number(t.price)>0).map(t=>{
    const depth=Number(t.marketCap)>0?Number(t.liquidity||0)/Number(t.marketCap)*100:0;
    const turn=Number(t.liquidity)>0?Number(t.volume24h||0)/Number(t.liquidity):0;
    const mom=Number(t.change24h||0);
    const heat=turn*18+Math.min(depth,5)*8-Math.abs(mom-6)*.2;
    const cand=rt.candidates?.find(c=>String(c.token.address).toLowerCase()===String(t.address).toLowerCase()&&c.trader)||rt.candidates?.find(c=>String(c.token.address).toLowerCase()===String(t.address).toLowerCase());
    return{t,depth,turn,mom,heat,verdict:cand?.verdict||'WATCH'};
  }).sort((a,b)=>b.heat-a.heat).slice(0,max);
  return rows.map(x=>`${x.verdict==='FIRE'?c(A.brightGreen,'●'):x.verdict==='SKIP'?danger('×'):amber('·')} ${c(A.bold,'$'+String(x.t.symbol||'?').padEnd(7).slice(0,7))} d${x.depth.toFixed(1).padStart(4)}%  t${x.turn.toFixed(2)}x  ${x.mom>=0?c(A.brightGreen,`+${x.mom.toFixed(1)}%`):danger(`${x.mom.toFixed(1)}%`)}`);
}

export function renderTui(rt,state){
  const W=Math.max(108,process.stdout.columns||150),H=Math.max(34,process.stdout.rows||46);
  const left=Math.max(68,Math.floor(W*.60)),right=W-left-1;
  const lines=[];const logo=logoLines(Date.now(),Math.max(12,left-53));const st=rt.status(),rules=st.rules;
  const nextSync=Math.max(0,Math.ceil(((state.nextSyncAt||Date.now())-Date.now())/1000));
  const phase=(Math.floor(Date.now()/180)%8);
  const scanner=`${'▰'.repeat(phase)}${'▱'.repeat(8-phase)}`;

  for(let i=0;i<6;i++){
    const rhs=i===0?`${miniBara(Date.now())}  ${lime('COPYTRADE ENGINE')}  ${muted('Robinhood Chain')}`
      :i===1?`${soft('mode')} ${st.mode==='LIVE'?c(A.brightGreen,'LIVE'):st.mode==='REPLAY'?amber('REPLAY'):muted(st.mode)}  ${soft('fomo')} ${st.providers.fomo}  ${soft('trades')} ${st.providers.trades}  ${soft('dex')} ${st.providers.dex}  ${soft('rpc')} ${st.providers.rpc}`
      :i===2?`${soft('hunters')} ${c(A.white,st.hunters)}  ${soft('tokens')} ${c(A.white,st.tokens)}  ${soft('wallet flow')} ${c(A.white,st.trades)}  ${soft('events')} ${c(A.white,st.events)}`
      :i===3?`${soft('copy wallets')} ${c(A.white,`${st.shadowCopies} mirrors`)}  ${soft('paper')} ${c(A.white,st.positions)}  ${soft('budget')} ${c(A.white,`${Number(st.spentEth).toFixed(3)}/${rules.sessionBudgetEth.toFixed(3)} ETH`)}`
      :i===4?`${soft('COPY FLOW BOX')} edge≥${rules.minSourceEdge} · depth≥${rules.minDepthPct.toFixed(1)}% · turn≥${rules.minTurnover.toFixed(2)}x · momo ${rules.momentumFloorPct}…+${rules.momentumCeilPct}%`
      :state.engine?c(A.brightGreen,'ENGINE RUNNING')+`  ${lime(scanner)} ${muted(`scanner tick · refresh ${nextSync}s · p pause · q quit`)}`:amber('ENGINE PAUSED')+`  ${muted('p resume · r sync · q quit')}`;
    lines.push(pad(logo[i]||'',left-1)+soft('│')+trunc(rhs,right-1));
  }

  lines.push(soft(hr(left-1))+soft('┼')+soft(hr(right)));

  const events=(rt.events||[]).filter(e=>{
    if(state.filter==='all')return true;
    const cand=e.candidate;if(!cand)return false;
    return state.filter==='fire'?cand.verdict==='FIRE':cand.verdict==='SKIP';
  });
  if(state.selected>=events.length)state.selected=Math.max(0,events.length-1);
  const selectedEvent=events[state.selected]||rt.events?.[0];
  const sel=selectedEvent?.candidate||rt.candidates?.[0];

  const bottomRows=11;
  const feedHeight=Math.max(14,H-6-1-1-bottomRows);
  const leftRows=[];
  leftRows.push(`${soft(' LIVE EVENT STREAM ')} ${state.filter==='all'?lime('ALL'):state.filter==='fire'?c(A.brightGreen,'FIRE'):danger('SKIP')}  ${soft('wallet entries + market intake + marks + COPY decisions')}`);
  const visibleFeed=Math.max(1,feedHeight-1);
  const start=Math.max(0,state.selected-Math.floor(visibleFeed/2));
  for(let i=start;i<Math.min(events.length,start+visibleFeed);i++)leftRows.push(eventRow(events[i],left-2,i===state.selected));
  while(leftRows.length<feedHeight)leftRows.push('');

  const detail=[];
  if(sel){
    const t=sel.token,tr=sel.trader,m=sel.metrics||{};
    detail.push(`${lime(`$${t.symbol||'?'}  COPY SCORE ${t.score}`)}  ${sel.verdict==='FIRE'?c(A.brightGreen,'● READY'):danger('● REFUSED')}`);
    detail.push(`${c(A.bold,tr?.name||tr?.handle||'NO CONFIRMED TRADER')} ${tr?.handle?muted('@'+tr.handle):''}`);
    detail.push(`${soft('event')} ${selectedEvent?typeTag(selectedEvent.type):'—'} ${selectedEvent?muted(age(selectedEvent.at)+' ago'):''}`);
    detail.push(`${soft('depth')} ${Number(m.depthPct||0).toFixed(2)}%   ${soft('turn')} ${Number(m.turnover||0).toFixed(2)}x   ${soft('momo')} ${pct(m.momentum)}`);
    detail.push(`${soft('market cap')} ${usd(t.marketCap)}   ${soft('liq')} ${usd(t.liquidity)}`);
    detail.push(`${soft('contract')} ${short(t.address)}   ${links(t.address)}`);
    if(sel.pnl!=null)detail.push(`${soft('source pnl')} ${pnl(sel.pnl)}`);
    detail.push('');
    detail.push(soft('COPY FLOW WALLS'));
    detail.push(...wallRead(sel,rules));
    detail.push('');
    detail.push(sel.reasons?.length?danger('FIRST LEAK')+` ${sel.reasons[0]}`:c(A.brightGreen,'ALL FLOW WALLS PASSED · eligible for copy queue'));
    detail.push('');
    detail.push(soft('HOT MARKET RADAR'));
    detail.push(...radarLines(rt,4));
    detail.push('');
    detail.push(`${soft('session')} +${st.stats.newTokens} intake · ${st.stats.tradeEvents} wallet events · ${st.stats.marketMoves} moves · ${st.stats.scans} scans`);
    detail.push(`${soft('pulse')} ${meter((Date.now()/1000)%10,0,10,10)}  ${soft('next sync')} ${nextSync}s`);
  }else detail.push(muted('waiting for token candidates'));

  const infoBox=box('selected + market radar',right-1,detail).slice(0,feedHeight);
  for(let i=0;i<feedHeight;i++)lines.push(pad(leftRows[i]||'',left-1)+soft('│')+(infoBox[i]||''));

  lines.push(soft(hr(left-1))+soft('┼')+soft(hr(right)));

  const mirrors=mirrorLines(rt,8);
  const recent=rt.events?.slice(0,3)||[];
  const bottomLeft=[`${soft(' COPY WALLETS / MIRROR DESK ')} ${st.mode==='REPLAY'?amber('replay shadows'):muted('live-confirmed pairs + paper copies')}`,...mirrors];
  while(bottomLeft.length<bottomRows)bottomLeft.push('');
  const hot=radarLines(rt,3);
  const bottomRight=[
    `${soft('FLOW')} ${st.mode==='REPLAY'?amber('REPLAY DATA'):st.mode==='LIVE'?c(A.brightGreen,'LIVE READS'):muted('SNAPSHOT FALLBACK')}`,
    `${soft('latest')} ${recent[0]?`${typeTag(recent[0].type)} ${trunc(recent[0].message,Math.max(10,right-18))}`:muted('waiting')}`,
    `${soft('queue')} ${st.positions}/${rules.maxPositions} paper · ${(rules.sessionBudgetEth-Number(st.spentEth)).toFixed(3)} ETH left`,
    `${soft('HOT NOW')} ${hot[0]||muted('waiting')}`,
    `${soft('NEXT')}    ${hot[1]||muted('waiting')}`,
    `${soft('WATCH')}   ${hot[2]||muted('waiting')}`,
    `${soft('keys')} ↑↓ event · f filter · space paper · c track`,
    `${soft('keys')} p pause · r refresh · q quit`,
    state.message?amber(trunc(state.message,right-2)):muted('COPYBARA keeps scanning between provider refreshes'),
    `${soft('box')} 0.012 ETH · 5 max · 0.080 session · TP +65 · SL -22`,
    soft('SHADOW is analytics. PAPER is local. REPLAY is labeled.')
  ];
  for(let i=0;i<bottomRows;i++)lines.push(pad(trunc(bottomLeft[i]||'',left-1),left-1)+soft('│')+trunc(bottomRight[i]||'',right-1));

  return lines.slice(0,H).map(x=>trunc(x,W)).join('\n');
}

export function lineEvent(input){
  const e=input?.candidate||input?.type?input:null;
  const cand=e?.candidate||input;
  const t=cand?.token,tr=cand?.trader;
  const time=new Date(e?.at||Date.now()).toTimeString().slice(0,8);
  if(!t)return `${soft(time)} ${typeTag(e?.type||'SYSTEM')} ${e?.message||''}`;
  const name=tr?.handle||tr?.name||'market';
  const why=e?.message||cand.reasons?.[0]||'all flow walls passed';
  const m=cand.metrics||{};
  return `${soft(time)} ${typeTag(e?.type||cand.verdict)} ${c(A.bold,'$'+String(t.symbol||'?').padEnd(10).slice(0,10))} edge ${String(Math.round(m.sourceEdge||0)).padStart(2)}  ${trunc(name,16).padEnd(16)} depth ${Number(m.depthPct||0).toFixed(1).padStart(4)}% turn ${Number(m.turnover||0).toFixed(2)}x  ${why}`;
}

export function header(rt,mode='hunt'){
  const st=rt.status(),r=st.rules;
  return [...logoLines(Date.now(),20),'',`${lime('copy')} ${mode} · ${st.mode.toLowerCase()} · ${r.buySizeEth.toFixed(3)} ETH paper size · budget ${r.sessionBudgetEth.toFixed(3)} ETH · max open ${r.maxPositions}`,`${soft('flow box')} edge≥${r.minSourceEdge} · depth≥${r.minDepthPct.toFixed(1)}% · turnover≥${r.minTurnover.toFixed(2)}x · momentum ${r.momentumFloorPct}%…+${r.momentumCeilPct}%`,`${soft('sources')} fomo ${st.providers.fomo} · trades ${st.providers.trades} · dex ${st.providers.dex} · rpc ${st.providers.rpc}`,soft('LIVE / SNAPSHOT / REPLAY are always labeled. SHADOW is analytics, not execution.'),soft(hr(Math.min(150,process.stdout.columns||120)))].join('\n');
}
