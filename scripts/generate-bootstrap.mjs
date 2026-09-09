import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { State } from '../src/services/state.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const seed=JSON.parse(fs.readFileSync(path.join(root,'data/seed.json'),'utf8'));
const st=new State('/tmp/copy-bootstrap-cache.json',seed);
st.recompute();
st.data.status={fomo:'snapshot',chain:'snapshot',dex:'snapshot',fomoStream:'idle'};
st.data.sources={
  fomo:{fresh:false,provider:'last-known-good',lastSync:seed.capturedAt||null},
  chain:{fresh:false,provider:'last-known-good',lastSync:seed.capturedAt||null},
  dex:{fresh:false,provider:'last-known-good',lastSync:seed.capturedAt||null}
};
st.data.updatedAt=seed.capturedAt||new Date().toISOString();
const json=JSON.stringify(st.public()).replace(/</g,'\\u003c');
fs.writeFileSync(path.join(root,'public/bootstrap-state.js'),`window.__COPY_BOOTSTRAP__=${json};\n`);
console.log(`bootstrap generated · ${st.data.hunters.length} hunters · ${st.data.alpha.length} tokens`);
