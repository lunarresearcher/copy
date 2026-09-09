import {header,lineEvent} from './render.mjs';
import {soft} from './ansi.mjs';

export async function hunt(rt,{fireOnly=false,forSec=0,json=false}={}){
  await rt.init();await rt.sync();
  if(!json)console.log(header(rt,'hunt'));
  const started=Date.now(),seen=new Set();
  const print=()=>{
    for(const e of [...rt.events].reverse()){
      if(seen.has(e.id))continue;
      if(fireOnly&&e.candidate?.verdict!=='FIRE')continue;
      seen.add(e.id);
      if(json){
        const c=e.candidate,t=c?.token;
        console.log(JSON.stringify({ts:e.at,type:e.type,verdict:c?.verdict||null,score:t?.score??null,symbol:t?.symbol??null,token:t?.address??null,trader:c?.trader?.handle||c?.trader?.name||null,message:e.message,reasons:c?.reasons||[],marketCap:t?.marketCap??null,liquidity:t?.liquidity??null}));
      }else console.log(lineEvent(e));
    }
  };
  print();
  let nextSync=Date.now()+12000,nextPulse=Date.now()+(rt.demo?1450:2200),nextDemo=Date.now()+900;
  while(!forSec||Date.now()-started<forSec*1000){
    await new Promise(r=>setTimeout(r,250));
    if(Date.now()>=nextPulse){rt.heartbeat();nextPulse=Date.now()+(rt.demo?1450:2200);print()}
    if(rt.demo&&Date.now()>=nextDemo){rt.demoTick();nextDemo=Date.now()+900;print()}
    if(Date.now()>=nextSync){await rt.sync();await rt.markPositions();nextSync=Date.now()+12000;print()}
  }
  if(!json)console.log(soft('done'));
}
