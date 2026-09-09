import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './src/config.mjs';
import { readJson } from './src/services/cache.mjs';
import { State } from './src/services/state.mjs';
import { FomoProvider } from './src/providers/fomo.mjs';
import { RobinhoodProvider } from './src/providers/robinhood.mjs';
import { DexScreenerProvider } from './src/providers/dexscreener.mjs';
import { NativeExecutor } from './src/services/native-executor.mjs';

const __dirname=path.dirname(fileURLToPath(import.meta.url)),pub=path.join(__dirname,'public');
const seed=await readJson(path.join(__dirname,'data/seed.json'),{leaderboard:[],profiles:[],dexTokens:[],verifiedPositions:[]});
const state=new State(config.cacheFile,seed);await state.hydrate();state.recompute();
const fomo=new FomoProvider({bearer:config.fomoBearer,replyNodesKey:config.replyNodesKey,replyNodesChain:config.replyNodesChain});
const rh=new RobinhoodProvider({rpcUrl:config.rpcUrl,rpcFallback:config.rpcFallback,initialLookback:config.rhInitialLookback});
const dex=new DexScreenerProvider();
const nativeExecutor=new NativeExecutor({webhook:config.nativeExecutorWebhook,token:config.nativeExecutorToken},state);
let fomoBusy=false,chainBusy=false,dexBusy=false;
const mergeWindows=(base,r7=[],r30=[])=>{const map=new Map(base.map(x=>[String(x.handle||x.id||x.name).toLowerCase(),{...x,rank24h:x.rank}]));for(const x of r7){const k=String(x.handle||x.id||x.name).toLowerCase(),prev=map.get(k)||{...x};map.set(k,{...prev,...x,rank:prev.rank??x.rank,rank24h:prev.rank24h??prev.rank,rank7d:x.rank,pnl24h:prev.pnl24h??x.pnl24h,pnl7d:x.pnl7d??x.pnl24h??prev.pnl7d})}for(const x of r30){const k=String(x.handle||x.id||x.name).toLowerCase(),prev=map.get(k)||{...x};map.set(k,{...prev,...x,rank:prev.rank??x.rank,rank24h:prev.rank24h??prev.rank,rank30d:x.rank,pnl24h:prev.pnl24h??x.pnl24h,pnl30d:x.pnl30d??x.pnl24h??prev.pnl30d})}return [...map.values()].sort((a,b)=>Number(a.rank24h||999)-Number(b.rank24h||999))};
async function syncFomo(){if(fomoBusy)return;fomoBusy=true;try{
  const [r24,r7,r30,trending]=await Promise.allSettled([fomo.leaderboard('24h',100),fomo.leaderboard('7d',100),fomo.leaderboard('30d',100),fomo.trending(100)]);
  if(r24.status!=='fulfilled')throw r24.reason;
  let board=r24.value;board={...board,items:mergeWindows(board.items,r7.status==='fulfilled'?r7.value.items:[],r30.status==='fulfilled'?r30.value.items:[])};
  if(trending.status==='fulfilled'&&trending.value.length)state.setFomoTrending(trending.value,{replace:true});
  const handles=board.items.slice(0,70).map(x=>x.handle).filter(Boolean),trades=await fomo.trades(900,handles);
  state.setFomo({leaderboard:board.items,trades,fresh:board.fresh,provider:board.provider});await state.save()
}catch(e){state.data.status.fomo='degraded';state.data.sources.fomo={...(state.data.sources.fomo||{}),fresh:false,error:String(e.message||e),lastAttempt:new Date().toISOString()};state.broadcast('fomo-error',{message:e.message})}finally{fomoBusy=false}}
async function syncChain(){if(chainBusy)return;chainBusy=true;try{const snap=await rh.poll(false);state.setChain(snap);await state.save()}catch(e){state.data.status.chain='degraded';state.data.sources.chain={...(state.data.sources.chain||{}),fresh:false,error:String(e.message||e),lastAttempt:new Date().toISOString()};state.broadcast('chain-error',{message:e.message})}finally{chainBusy=false}}
async function syncDex(){if(dexBusy)return;dexBusy=true;try{const candidates=[...(state.data.chain?.launches||[]).map(x=>x.token),...(state.data.fomoTrending||[]).map(x=>x.address),...(state.data.fomoTrades||[]).map(x=>x.tokenAddress)].filter(Boolean);const snap=await dex.sync(candidates);state.setDex(snap);await state.save()}catch(e){state.data.status.dex='degraded';state.data.sources.dex={...(state.data.sources.dex||{}),fresh:false,error:String(e.message||e),lastAttempt:new Date().toISOString()};state.broadcast('dex-error',{message:e.message})}finally{dexBusy=false}}
if(fomo.mode==='direct')fomo.connectStream({onTrades:trades=>state.pushFomoTrades(trades),onTrending:({items,kind})=>state.setFomoTrending(items,{replace:kind==='snapshot'}),onStatus:s=>state.setFomoStreamStatus(s)});
rh.init(state.data.chain||{}).then(s=>{state.setChain(s);state.save().catch(()=>{})}).catch(e=>{state.data.sources.chain={fresh:false,error:e.message};state.data.status.chain='degraded'});
syncFomo();setTimeout(syncChain,700);setTimeout(syncDex,1300);
setInterval(syncFomo,config.fomoPollMs).unref();setInterval(syncChain,config.chainPollMs).unref();setInterval(syncDex,config.dexPollMs).unref();setInterval(()=>state.save().catch(()=>{}),60000).unref();setTimeout(()=>nativeExecutor.tick().catch(()=>{}),1800);setInterval(()=>nativeExecutor.tick().catch(()=>{}),config.nativeExecutorPollMs).unref();
const clients=new Set();state.on('event',e=>{const msg=`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`;for(const res of clients){try{res.write(msg)}catch{clients.delete(res)}}});setInterval(()=>{for(const r of clients)try{r.write(': ping\n\n')}catch{clients.delete(r)}},15000).unref();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
function json(res,status,obj){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(obj))}async function body(req){let s='';for await(const c of req){s+=c;if(s.length>100000)throw new Error('body too large')}return s?JSON.parse(s):{}}async function serveFile(res,file){try{const st=await fsp.stat(file);if(!st.isFile())throw 0;res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':path.extname(file)==='.html'?'no-cache':'public, max-age=300'});fs.createReadStream(file).pipe(res)}catch{res.writeHead(404);res.end('Not found')}}
const server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/api/health')return json(res,200,{ok:true,uptime:process.uptime(),status:state.data.status,updatedAt:state.data.updatedAt,fomoMode:fomo.mode,sources:state.data.sources,counts:{hunters:state.data.hunters.length,fomoTrades:state.data.fomoTrades.length,trending:state.data.fomoTrending.length,dexTokens:state.data.dexTokens.length,alpha:state.data.alpha.length,launches:state.data.chain?.launches?.length||0,chainTrades:state.data.chain?.trades?.length||0,copyRules:state.data.copyRules?.length||0,copyActivity:state.data.copyActivity?.length||0},executor:state.data.executor});
  if(u.pathname==='/api/state')return json(res,200,state.public());if(u.pathname==='/api/leaderboard')return json(res,200,{items:state.data.hunters,verifiedPositions:state.data.verifiedPositions,source:state.data.sources.fomo});if(u.pathname==='/api/trades')return json(res,200,{fomo:state.data.fomoTrades,chain:state.data.chain?.trades||[],source:state.data.sources});if(u.pathname==='/api/tokens')return json(res,200,{items:state.data.alpha,dex:state.data.dexTokens,trending:state.data.fomoTrending,head:state.data.chain?.head,source:state.data.sources});
  if(u.pathname==='/api/events'){res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});res.write(': connected\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return}
  if(u.pathname==='/api/copy-rules'&&req.method==='GET')return json(res,200,{items:state.data.copyRules||[],activity:state.data.copyActivity||[],executor:state.data.executor});
  if(u.pathname==='/api/executor'&&req.method==='GET')return json(res,200,state.data.executor||{mode:'queue',ready:true});
  if(u.pathname==='/api/copy-rule'&&req.method==='POST'){const b=await body(req),kind=b.kind==='wallet'?'wallet':'profile',subject=String(b.subject||'').trim().replace(/^@/,'');if(kind==='wallet'&&!/^0x[a-fA-F0-9]{40}$/.test(subject))return json(res,400,{error:'invalid wallet'});if(kind==='profile'&&!/^[A-Za-z0-9_.-]{1,64}$/.test(subject))return json(res,400,{error:'invalid profile'});const rule=state.setCopyRule({...b,kind,subject});await state.save();nativeExecutor.tick().catch(()=>{});return json(res,200,{ok:true,rule})}
  if(u.pathname.startsWith('/api/copy-rule/')&&req.method==='DELETE'){const id=decodeURIComponent(u.pathname.slice('/api/copy-rule/'.length));state.removeCopyRule(id);await state.save();return json(res,200,{ok:true})}
  if(u.pathname==='/api/manual-arm'&&req.method==='POST'){const b=await body(req);try{const entry=state.armManual(b);await state.save();nativeExecutor.tick().catch(()=>{});return json(res,200,{ok:true,entry})}catch(e){return json(res,400,{error:e.message||String(e)})}}
  if(u.pathname==='/api/track-profile'&&req.method==='POST'){const b=await body(req),h=String(b.handle||'').trim().replace(/^@/,'');if(!/^[A-Za-z0-9_.-]{1,64}$/.test(h))return json(res,400,{error:'invalid handle'});if(!state.data.trackedProfiles.some(x=>x.toLowerCase()===h.toLowerCase()))state.data.trackedProfiles.push(h);await state.save();return json(res,200,{ok:true,trackedProfiles:state.data.trackedProfiles})}
  if(u.pathname.startsWith('/api/track-profile/')&&req.method==='DELETE'){const h=decodeURIComponent(u.pathname.split('/').pop());state.data.trackedProfiles=state.data.trackedProfiles.filter(x=>x.toLowerCase()!==h.toLowerCase());await state.save();return json(res,200,{ok:true})}
  if(u.pathname==='/api/track-wallet'&&req.method==='POST'){const b=await body(req),a=String(b.address||'').trim();if(!/^0x[a-fA-F0-9]{40}$/.test(a))return json(res,400,{error:'invalid address'});if(!state.data.trackedWallets.some(x=>x.toLowerCase()===a.toLowerCase()))state.data.trackedWallets.push(a);await state.save();return json(res,200,{ok:true,trackedWallets:state.data.trackedWallets})}
  if(u.pathname.startsWith('/api/track-wallet/')&&req.method==='DELETE'){const a=decodeURIComponent(u.pathname.split('/').pop());state.data.trackedWallets=state.data.trackedWallets.filter(x=>x.toLowerCase()!==a.toLowerCase());await state.save();return json(res,200,{ok:true})}
  if(u.pathname.startsWith('/api/'))return json(res,404,{error:'not found'});const rel=u.pathname==='/'?'index.html':u.pathname.replace(/^\/+/,''),file=path.normalize(path.join(pub,rel));if(!file.startsWith(pub))return serveFile(res,path.join(pub,'index.html'));if(fs.existsSync(file)&&fs.statSync(file).isFile())return serveFile(res,file);return serveFile(res,path.join(pub,'index.html'))
}catch(e){json(res,500,{error:e.message||String(e)})}});
server.listen(config.port,'0.0.0.0',()=>console.log(`COPY http://localhost:${config.port} · Fomo ${fomo.mode} · Robinhood live · Native ${nativeExecutor.mode}`));
