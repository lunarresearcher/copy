import fs from 'node:fs/promises';
import {CopyRuntime} from '../src/cli/runtime.mjs';
import {renderTui} from '../src/cli/render.mjs';
Object.defineProperty(process.stdout,'columns',{value:214,configurable:true});
Object.defineProperty(process.stdout,'rows',{value:74,configurable:true});
const rt=await new CopyRuntime({demo:true}).init();
// Seed the README preview with a few local PAPER examples so the lower-right desk
// demonstrates the full runtime instead of wasting space on an empty-state message.
const previewFire=(rt.candidates||[]).filter(c=>c.verdict==='FIRE'&&Number(c.token?.price)>0).slice(0,3);
rt.store.positions=previewFire.map((c,i)=>({
  id:`preview:${i}`,
  openedAt:new Date(Date.now()-(i+1)*180000).toISOString(),
  tokenAddress:c.token.address,
  symbol:c.token.symbol,
  trader:c.trader?.handle||c.trader?.name||'wallet',
  entryPrice:Number(c.token.price)/(1+[12.8,-4.2,6.7][i]/100),
  currentPrice:Number(c.token.price),
  sizeEth:rt.rules.buySizeEth,
  pnlPct:[12.8,-4.2,6.7][i],
  peakPct:[15.1,1.2,8.9][i],
  status:'OPEN'
}));
rt.store.closed=[
  {symbol:'CASHCAT',pnlPct:22.4,exitReason:'trailing stop'},
  {symbol:'AI',pnlPct:-8.7,exitReason:'manual'}
];
rt.store.spentEth=rt.store.positions.length*rt.rules.buySizeEth;
rt.refreshShadowCopies();
// Warm up the replay engine so the first README frame is already dense instead of
// showing an empty middle section while events accumulate in real time.
for(let i=0;i<26;i++)rt.demoTick();

const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function ansiHtml(s){let out='',i=0,style={fg:'#dfe8df',bg:'transparent',bold:false,dim:false};const open=()=>`<span style="color:${style.fg};background:${style.bg};font-weight:${style.bold?700:400};opacity:${style.dim?.65:1}">`;let span=false;const close=()=>{if(span){out+='</span>';span=false}};while(i<s.length){if(s[i]==='\x1b'&&s[i+1]==='['){const m=s.slice(i).match(/^\x1b\[([0-9;]*)m/);if(m){close();const codes=(m[1]?m[1].split(';').map(Number):[0]);for(let k=0;k<codes.length;k++){const x=codes[k];if(x===0)style={fg:'#dfe8df',bg:'transparent',bold:false,dim:false};else if(x===1)style.bold=true;else if(x===2)style.dim=true;else if(x===30)style.fg='#050806';else if(x===31||x===91)style.fg='#ff6363';else if(x===32||x===92)style.fg='#72ff86';else if(x===33||x===93)style.fg='#ffd15c';else if(x===37)style.fg='#f2f7f2';else if(x===90)style.fg='#657166';else if(x===42)style.bg='#72ff86';else if(x===100)style.bg='#222824';else if(x===38&&codes[k+1]===2){style.fg=`rgb(${codes[k+2]},${codes[k+3]},${codes[k+4]})`;k+=4}}i+=m[0].length;continue}}if(s.startsWith('\x1b]8;;',i)){const end=s.indexOf('\x1b\\',i);if(end>=0){i=end+2;continue}}if(!span){out+=open();span=true}out+=esc(s[i]);i++}close();return out}

// Pre-render a short loop of genuine TUI states. Opening cli-preview.html therefore
// behaves like a tiny video of the terminal instead of a frozen screenshot.
const realNow=Date.now;
const base=realNow();
const frames=[];
for(let i=0;i<12;i++){
  rt.demoTick();
  if(i%2===0)rt.heartbeat();
  Date.now=()=>base+i*900;
  const selected=Math.max(0,rt.events.findIndex(e=>String(e.type).includes('NEW')||String(e.type).includes('PNL')));
  frames.push(ansiHtml(renderTui(rt,{selected,filter:'all',engine:true,nextSyncAt:base+i*900+7000})));
}
Date.now=realNow;

const html=`<!doctype html><meta charset="utf-8"><title>COPY terminal v18</title><style>*{box-sizing:border-box}body{margin:0;background:#020403;color:#dfe8df;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;min-height:100vh;display:grid;place-items:center}.shell{width:min(1500px,100vw);height:100vh;background:#040706;padding:14px 20px;position:relative;overflow:hidden}.shell:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 78% 8%,rgba(183,255,0,.07),transparent 36%);pointer-events:none}.top{height:24px;display:flex;align-items:center;gap:8px;color:#59645b;font-size:11px;border-bottom:1px solid #172019;margin-bottom:12px;padding-bottom:9px}.dot{width:7px;height:7px;border-radius:50%;background:#72ff86;box-shadow:0 0 12px #72ff86}.term{font-size:11.2px;line-height:1.10;white-space:pre;letter-spacing:-.18px;position:relative;z-index:1;margin:0}.badge{margin-left:auto;color:#c6ff00}.cursor{display:inline-block;width:7px;height:13px;background:#b7ff00;margin-left:2px;animation:blink 1s steps(1) infinite}@keyframes blink{50%{opacity:0}}@media(max-width:900px){.term{font-size:7px}.shell{padding:10px}}</style><div class="shell"><div class="top"><span class="dot"></span> COPY // COPYBARA &nbsp; robinhood chain &nbsp; local terminal <span class="badge">REPLAY LOOP · TOKENS KEEP ARRIVING</span></div><pre id="term" class="term"></pre></div><script>const frames=${JSON.stringify(frames)};let i=0;const el=document.getElementById('term');function draw(){el.innerHTML=frames[i++%frames.length]+'\\ncopy@rh:~$ <span class="cursor"></span>'}draw();setInterval(draw,900);</script>`;
await fs.writeFile(new URL('../cli-preview.html',import.meta.url),html);
console.log(`animated cli preview generated · ${frames.length} frames · ${rt.tokens.length} markets · ${rt.shadowCopies.length} mirrors`);
