import {altOn,altOff,hideCursor,showCursor,home,clear} from './ansi.mjs';
import {renderTui} from './render.mjs';

export async function terminal(rt,{demo=false}={}){
  const syncEvery=demo?8000:12000;
  const state={selected:0,filter:'all',engine:true,message:'',nextSyncAt:Date.now()+syncEvery};
  await rt.init();
  await rt.sync();
  state.nextSyncAt=Date.now()+syncEvery;

  let stopped=false,renderTimer,syncTimer,markTimer,pulseTimer,demoTimer,messageTimer;
  const render=()=>{if(stopped)return;process.stdout.write(home+renderTui(rt,state)+'\x1b[J')};
  const flash=msg=>{state.message=msg;clearTimeout(messageTimer);messageTimer=setTimeout(()=>{state.message=''},4000)};
  const cleanup=()=>{
    if(stopped)return;stopped=true;
    clearInterval(renderTimer);clearInterval(syncTimer);clearInterval(markTimer);clearInterval(pulseTimer);clearInterval(demoTimer);clearTimeout(messageTimer);
    try{if(process.stdin.isTTY)process.stdin.setRawMode(false)}catch{}
    process.stdin.pause();process.stdout.write(showCursor+altOff+'\n');
  };

  if(!process.stdout.isTTY||!process.stdin.isTTY){console.log('COPY terminal needs a TTY. Try: npm run hunt');return}
  process.stdout.write(altOn+hideCursor+clear);
  process.stdin.setRawMode(true);process.stdin.resume();process.stdin.setEncoding('utf8');

  const currentEvent=()=>{
    const events=(rt.events||[]).filter(e=>state.filter==='all'?true:e.candidate&&(state.filter==='fire'?e.candidate.verdict==='FIRE':e.candidate.verdict==='SKIP'));
    return events[state.selected]||events[0]||null;
  };

  process.stdin.on('data',async key=>{
    if(key==='q'||key==='\u0003'){cleanup();return}
    if(key==='p'){state.engine=!state.engine;flash(state.engine?'engine resumed':'engine paused');render();return}
    if(key==='f'){state.filter=state.filter==='all'?'fire':state.filter==='fire'?'skip':'all';state.selected=0;flash(`filter ${state.filter.toUpperCase()}`);render();return}
    if(key==='r'){flash('refreshing providers…');await rt.sync();state.nextSyncAt=Date.now()+syncEvery;render();return}
    if(key==='\x1b[A'||key==='k'){state.selected=Math.max(0,state.selected-1);render();return}
    if(key==='\x1b[B'||key==='j'){state.selected++;render();return}
    const event=currentEvent();const cand=event?.candidate||rt.candidates?.[0];
    if(key==='c'&&cand){const added=await rt.toggleTrack(cand);flash(added?'source added to COPY list':'source removed from COPY list');render();return}
    if(key===' '&&cand){const res=await rt.openPaper(cand);flash(res.ok?`paper copy opened: $${cand.token.symbol}`:res.reasons.join(' · '));render();return}
  });

  renderTimer=setInterval(render,250);
  pulseTimer=setInterval(()=>{if(state.engine){rt.heartbeat();render()}},demo?1450:2200);
  syncTimer=setInterval(async()=>{if(state.engine||!demo){await rt.sync();state.nextSyncAt=Date.now()+syncEvery;render()}},syncEvery);
  markTimer=setInterval(async()=>{if(state.engine){await rt.markPositions();rt.refreshShadowCopies();render()}},demo?950:1800);
  if(demo)demoTimer=setInterval(()=>{if(state.engine){rt.demoTick();render()}},900);
  render();

  await new Promise(resolve=>{const poll=setInterval(()=>{if(stopped){clearInterval(poll);resolve()}},100)});
}
