import fs from 'node:fs';import path from 'node:path';import { fileURLToPath } from 'node:url';import { State } from '../src/services/state.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),seed=JSON.parse(fs.readFileSync(path.join(root,'data/seed.json'),'utf8')),st=new State('/tmp/copy-preview-cache.json',seed);st.recompute();
const samples=st.data.hunters.filter(x=>x.handle).slice(0,2);for(const [i,h] of samples.entries())st.setCopyRule({kind:'profile',subject:h.handle,name:h.name||h.handle,sizeEth:i?0.03:0.05,maxMarketCap:i?2000000:3500000,minLiquidity:25000,maxTaxPct:3,slippagePct:10,minConviction:i?2:1,takeProfitPct:200,stopLossPct:-35,maxConcurrent:5,fastFollow:true});
st.data.status={fomo:'online',chain:'online',dex:'online',fomoStream:'online'};st.data.sources={fomo:{fresh:true,provider:'preview snapshot',lastSync:new Date().toISOString()},chain:{fresh:true,provider:'robinhood-rpc',lastSync:new Date().toISOString()},dex:{fresh:true,provider:'dexscreener',lastSync:new Date().toISOString()}};st.data.updatedAt=new Date().toISOString();
let html=fs.readFileSync(path.join(root,'public/index.html'),'utf8'),css=fs.readFileSync(path.join(root,'public/styles.css'),'utf8'),js=fs.readFileSync(path.join(root,'public/app.js'),'utf8'),bootstrap=fs.readFileSync(path.join(root,'public/bootstrap-state.js'),'utf8');
const dataUri=(rel,mime)=>`data:${mime};base64,${fs.readFileSync(path.join(root,'public',rel)).toString('base64')}`;
const head=dataUri('assets/copybara-head.webp','image/webp'),body=dataUri('assets/copybara.webp','image/webp'),favicon=dataUri('assets/favicon.png','image/png');
css=css.replaceAll('/assets/copybara-head.webp',head).replaceAll('/assets/copybara.webp',body);
html=html.replace('<link rel="icon" type="image/png" href="/assets/favicon.png" />',`<link rel="icon" type="image/png" href="${favicon}" />`)
  .replace('<link rel="stylesheet" href="/styles.css" />',()=>`<style>${css}</style>`)
  .replace('<script src="/bootstrap-state.js"></script>',()=>`<script>${bootstrap}</script>`)
  .replace('<script type="module" src="/app.js"></script>',()=>`<script>window.__COPY_STATE__=${JSON.stringify(st.public()).replace(/</g,'\\u003c')}</script><script>${js}</script>`);
fs.writeFileSync(path.join(root,'preview-standalone.html'),html);console.log('preview generated',samples.map(x=>x.handle).join(', '));
