import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let html=fs.readFileSync(path.join(root,'public/terminal.html'),'utf8');
let css=fs.readFileSync(path.join(root,'public/terminal.css'),'utf8');
let js=fs.readFileSync(path.join(root,'public/terminal.js'),'utf8');
const bootstrap=fs.readFileSync(path.join(root,'public/bootstrap-state.js'),'utf8');
const capy=`data:image/webp;base64,${fs.readFileSync(path.join(root,'public/assets/copybara-terminal.webp')).toString('base64')}`;
css=css.replaceAll('/assets/copybara-terminal.webp',capy);
html=html.replace('<link rel="stylesheet" href="/terminal.css" />',`<style>${css}</style>`)
  .replace('<script src="/bootstrap-state.js"></script>',`<script>${bootstrap}</script>`)
  .replace('<script src="/terminal.js"></script>',`<script>${js}</script>`)
  .replaceAll('src="/assets/copybara-terminal.webp"',`src="${capy}"`)
  .replace('href="/"','href="#"');
fs.writeFileSync(path.join(root,'terminal-preview-standalone.html'),html);
console.log('terminal preview generated');
