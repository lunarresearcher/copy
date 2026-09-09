import {A,c,lime,danger,amber,muted,soft,link,pad,trunc} from './ansi.mjs';
export const compact=n=>{n=Number(n);if(!Number.isFinite(n))return'—';const a=Math.abs(n);if(a>=1e9)return`${(n/1e9).toFixed(a>=1e10?1:2)}B`;if(a>=1e6)return`${(n/1e6).toFixed(a>=1e7?1:2)}M`;if(a>=1e3)return`${(n/1e3).toFixed(a>=1e4?1:2)}K`;return n.toFixed(a<10?2:0)};
export const usd=n=>Number.isFinite(Number(n))?`$${compact(n)}`:'—';
export const pct=n=>Number.isFinite(Number(n))?`${Number(n)>=0?'+':''}${Number(n).toFixed(1)}%`:'—';
export const eth=n=>`${Number(n||0).toFixed(3)} ETH`;
export const short=a=>a?`${String(a).slice(0,6)}…${String(a).slice(-4)}`:'—';
export const age=iso=>{const ms=Date.now()-new Date(iso||0).getTime();if(!Number.isFinite(ms)||ms<0)return'now';const s=Math.floor(ms/1000);if(s<60)return`${s}s`;const m=Math.floor(s/60);if(m<60)return`${m}m`;const h=Math.floor(m/60);return`${h}h`};
export const verdict=v=>v==='FIRE'?c(A.bgGreen,c(A.black,' FIRE ')):v==='PASS'?c(A.brightGreen,'PASS'):v==='SKIP'?danger('SKIP'):amber('WATCH');
export const score=n=>{n=Number(n||0);return n>=80?lime(String(n).padStart(2)):n>=60?c(A.brightGreen,String(n).padStart(2)):n>=45?amber(String(n).padStart(2)):danger(String(n).padStart(2))};
export const pnl=n=>Number(n)>=0?c(A.brightGreen,`+${usd(n)}`):danger(`-${usd(Math.abs(Number(n)))}`);
export function gmgn(token){return `https://gmgn.ai/robinhood/token/${token}`}
export function fomo(token){return `https://fomo.family/token/${token}`}
export function explorer(token){return `https://robinhoodchain.blockscout.com/address/${token}`}
export function links(token){if(!token)return'';return `${link('gmgn',gmgn(token))} · ${link('fomo',fomo(token))} · ${link('explorer',explorer(token))}`}
export function kv(label,value,w=18){return `${pad(soft(label),w)} ${value}`}
