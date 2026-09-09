import fs from 'node:fs/promises';
import path from 'node:path';
const FILE=path.resolve(process.env.COPY_RUNTIME_FILE||'./data/runtime.json');
const EMPTY={rules:null,tracked:[],positions:[],closed:[],spentEth:0,events:[]};
export async function loadStore(){try{return{...EMPTY,...JSON.parse(await fs.readFile(FILE,'utf8'))}}catch{return structuredClone(EMPTY)}}
export async function saveStore(s){await fs.mkdir(path.dirname(FILE),{recursive:true});await fs.writeFile(FILE,JSON.stringify(s,null,2))}
