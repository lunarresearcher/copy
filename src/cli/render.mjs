import {A,c,lime,danger,amber,muted,soft,pad,trunc,hr} from './ansi.mjs';
import {logoLines,baraLines,miniBara} from './logo.mjs';
import {usd,pct,short,age,verdict,score,pnl,links} from './format.mjs';

const typeTag=t=>{
  const s=String(t||'SCAN').toUpperCase();
  if(['BUY','COPY','READY'].includes(s))return c(A.brightGreen,s.padEnd(7));
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

function eventCandidate(e){return e?.candidate||null}

function eventRow(e,w,selected=false){
  const cand=eventCandidate(e),t=cand?.token,tr=cand?.trader;
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
  const t=cand.token;const hasTrader=!!cand.trader;
  const checks=[
    ['leader',hasTrader,hasTrader?'confirmed profit source':'missing profit source'],
    ['score',Number(t.score||0)>=rules.minScore,`${t.score||0} / ${rules.minScore}`],
    ['mcap',Number(t.marketCap||0)<=rules.maxMarketCap,`${usd(t.marketCap)} / ${usd(rules.maxMarketCap)}`],
    ['liq',Number(t.liquidity||0)>=rules.minLiquidity,`${usd(t.liquidity)} / ${usd(rules.minLiquidity)}`],
    ['slots',true,'checked at copy time']
  ];
  return checks.map(([k,ok,v])=>`${ok?c(A.brightGreen,'✓'):danger('×')} ${soft(String(k).padEnd(7))} ${v}`);
}

function mirrorLines(rt,max=4){
  const paper=(rt.store.positions||[]).map(p=>({kind:'PAPER',trader:p.trader,symbol:p.symbol,pnlPct:Number(p.pnlPct||0),deltaPct:0,history:[0,Number(p.pnlPct||0)]}));
  const all=[...paper,...rt.shadowCopies].slice(0,max);
  if(!all.length)return[muted('waiting for passing wallet + priced RH market')];
  return all.map(x=>{
    const label=x.kind==='PAPER'?c(A.brightGreen,'PAPER '):lime('SHADOW');
    const val=Number(x.pnlPct||0);const d=Number(x.deltaPct||0);
    const p=val>=0?c(A.brightGreen,`${val>=0?'+':''}${val.toFixed(2)}%`):danger(`${val.toFixed(2)}%`);
    const delta=Math.abs(d)>=.005?(d>=0?c(A.brightGreen,`Δ+${d.toFixed(2)}`):danger(`Δ${d.toFixed(2)}`)):soft('Δ0.00');
    return `${label} ${trunc('@'+String(x.handle||x.trader||'wallet').replace(/^@/,''),15).padEnd(15)} → ${c(A.bold,'$'+String(x.symbol||'?').padEnd(8).slice(0,8))} ${p.padStart(8)} ${delta.padStart(7)} ${spark(x.history||[],10)}`;
  });
}

export function renderTui(rt,state){
  const W=Math.max(108,process.stdout.columns||150),H=Math.max(34,process.stdout.rows||46);
  const left=Math.max(68,Math.floor(W*.60)),right=W-left-1;
  const lines=[];const logo=logoLines();const st=rt.status(),rules=st.rules;
  const nextSync=Math.max(0,Math.ceil(((state.nextSyncAt||Date.now())-Date.now())/1000));

  for(let i=0;i<6;i++){
    const rhs=i===0?`${miniBara()}  ${lime('COPYTRADE ENGINE')}  ${muted('Robinhood Chain')}`
      :i===1?`${soft('mode')} ${st.mode==='LIVE'?c(A.brightGreen,'LIVE'):st.mode==='REPLAY'?amber('REPLAY'):muted(st.mode)}  ${soft('fomo')} ${st.providers.fomo}  ${soft('trades')} ${st.providers.trades}  ${soft('dex')} ${st.providers.dex}  ${soft('rpc')} ${st.providers.rpc}`
      :i===2?`${soft('hunters')} ${c(A.white,st.hunters)}  ${soft('tokens')} ${c(A.white,st.tokens)}  ${soft('wallet trades')} ${c(A.white,st.trades)}  ${soft('stream')} ${c(A.white,st.events)}`
      :i===3?`${soft('copy desk')} ${c(A.white,`${st.shadowCopies} shadow`)}  ${soft('paper')} ${c(A.white,st.positions)}  ${soft('budget')} ${c(A.white,`${Number(st.spentEth).toFixed(3)}/${rules.sessionBudgetEth.toFixed(3)} ETH`)}`
      :i===4?`${soft('walls')} score≥${rules.minScore} · mcap≤$${Math.round(rules.maxMarketCap/1e6)}M · liq≥$${Math.round(rules.minLiquidity/1e3)}K · max ${rules.maxPositions} pos`
      :state.engine?c(A.brightGreen,'ENGINE RUNNING')+`  ${muted(`scanner tick · provider refresh in ${nextSync}s · p pause · q quit`)}`:amber('ENGINE PAUSED')+`  ${muted('p resume · r sync · q quit')}`;
    lines.push(pad(logo[i]||'',left-1)+soft('│')+trunc(rhs,right-1));
  }

  lines.push(soft(hr(left-1))+soft('┼')+soft(hr(right)));

  const events=(rt.events||[]).filter(e=>{
    if(state.filter==='all')return true;
    const c=e.candidate;if(!c)return false;
    return state.filter==='fire'?c.verdict==='FIRE':c.verdict==='SKIP';
  });
  if(state.selected>=events.length)state.selected=Math.max(0,events.length-1);
  const selectedEvent=events[state.selected]||rt.events?.[0];
  const sel=selectedEvent?.candidate||rt.candidates?.[0];

  const bottomRows=7;
  const feedHeight=Math.max(16,H-6-1-1-bottomRows);
  const leftRows=[];
  leftRows.push(`${soft(' LIVE EVENT STREAM ')} ${state.filter==='all'?lime('ALL'):state.filter==='fire'?c(A.brightGreen,'FIRE'):danger('SKIP')}  ${soft('new tokens + wallet flow + market moves + scanner decisions')}`);
  const visibleFeed=Math.max(1,feedHeight-1);
  const start=Math.max(0,state.selected-Math.floor(visibleFeed/2));
  for(let i=start;i<Math.min(events.length,start+visibleFeed);i++)leftRows.push(eventRow(events[i],left-2,i===state.selected));
  while(leftRows.length<feedHeight)leftRows.push('');

  const detail=[];
  if(sel){
    const t=sel.token,tr=sel.trader;
    detail.push(`${lime(`$${t.symbol||'?'}  COPY SCORE ${t.score}`)}  ${sel.verdict==='FIRE'?c(A.brightGreen,'● READY'):danger('● REFUSED')}`);
    detail.push(`${c(A.bold,tr?.name||tr?.handle||'NO CONFIRMED TRADER')} ${tr?.handle?muted('@'+tr.handle):''}`);
    detail.push(`${soft('event')} ${selectedEvent?typeTag(selectedEvent.type):'—'} ${selectedEvent?muted(age(selectedEvent.at)+' ago'):''}`);
    detail.push(`${soft('market cap')} ${usd(t.marketCap)}   ${soft('liq')} ${usd(t.liquidity)}`);
    detail.push(`${soft('24h vol')}  ${usd(t.volume24h)}   ${soft('24h')} ${Number(t.change24h)>=0?c(A.brightGreen,pct(t.change24h)):danger(pct(t.change24h))}`);
    detail.push(`${soft('contract')} ${short(t.address)}   ${links(t.address)}`);
    if(sel.pnl!=null)detail.push(`${soft('source pnl')} ${pnl(sel.pnl)}`);
    detail.push('');
    detail.push(soft('RISK WALLS'));
    detail.push(...wallRead(sel,rules));
    detail.push('');
    detail.push(sel.reasons?.length?danger('FIRST LEAK')+` ${sel.reasons[0]}`:c(A.brightGreen,'ALL WALLS PASSED · eligible for paper/native queue'));
    detail.push('');
    detail.push(soft('COPY DESK'));
    detail.push(...mirrorLines(rt,3));
    detail.push('');
    detail.push(`${soft('session pulse')} +${st.stats.newTokens} markets · ${st.stats.tradeEvents} wallet trades · ${st.stats.marketMoves} moves · ${st.stats.scans} scans`);
    detail.push(`${soft('next refresh')} ${nextSync}s   ${soft('last sync')} ${st.lastSync?age(st.lastSync)+' ago':'waiting'}`);
    detail.push('');
    for(const x of baraLines().slice(0,4))detail.push(x);
  }else{
    detail.push(muted('waiting for token candidates'));
  }
  const infoBox=box('selected + live desk',right-1,detail).slice(0,feedHeight);
  for(let i=0;i<feedHeight;i++)lines.push(pad(leftRows[i]||'',left-1)+soft('│')+(infoBox[i]||''));

  lines.push(soft(hr(left-1))+soft('┼')+soft(hr(right)));

  const mirrors=mirrorLines(rt,4);
  const recent=rt.events?.slice(0,3)||[];
  const bottomLeft=[`${soft(' COPY WALLETS / PAPER MIRRORS ')} ${muted('PnL marks update from refreshed market prices')}`,...mirrors];
  while(bottomLeft.length<bottomRows)bottomLeft.push('');
  const bottomRight=[
    `${soft('FLOW')} ${st.mode==='REPLAY'?amber('REPLAY DATA'):st.mode==='LIVE'?c(A.brightGreen,'LIVE READS'):muted('SNAPSHOT FALLBACK')}`,
    `${soft('latest')} ${recent[0]?`${typeTag(recent[0].type)} ${trunc(recent[0].message,Math.max(10,right-18))}`:muted('waiting')}`,
    `${soft('queue')} ${st.positions}/${rules.maxPositions} paper · ${(rules.sessionBudgetEth-Number(st.spentEth)).toFixed(3)} ETH budget left`,
    `${soft('keys')} ↑↓ event · f filter · space paper · c track`,
    `${soft('keys')} p pause · r refresh · q quit`,
    state.message?amber(trunc(state.message,right-2)):muted('scanner keeps writing even when no wallet trade arrives'),
    soft('COPYBARA watches the walls. market data moves the PnL.')
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
  const why=e?.message||cand.reasons?.[0]||'all walls passed';
  return `${soft(time)} ${typeTag(e?.type||cand.verdict)} ${c(A.bold,'$'+String(t.symbol||'?').padEnd(10).slice(0,10))} score ${score(t.score)}  ${trunc(name,16).padEnd(16)} mcap ${usd(t.marketCap).padEnd(9)} liq ${usd(t.liquidity).padEnd(8)} ${why}`;
}

export function header(rt,mode='hunt'){
  const st=rt.status(),r=st.rules;
  return [...logoLines(),'',`${lime('copy')} ${mode} · ${st.mode.toLowerCase()} · ${r.buySizeEth.toFixed(2)} ETH per paper copy · budget ${r.sessionBudgetEth.toFixed(2)} ETH · max open ${r.maxPositions} · min score ${r.minScore}`,`${soft('sources')} fomo ${st.providers.fomo} · trades ${st.providers.trades} · dex ${st.providers.dex} · rpc ${st.providers.rpc}`,soft('stream includes provider syncs and scanner pulses; REPLAY events are explicitly labeled'),soft(hr(Math.min(150,process.stdout.columns||120)))].join('\n');
}
