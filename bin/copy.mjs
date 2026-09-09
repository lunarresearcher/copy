#!/usr/bin/env node
import {CopyRuntime} from '../src/cli/runtime.mjs';
import {terminal} from '../src/cli/terminal.mjs';
import {hunt} from '../src/cli/hunt.mjs';
import {paper} from '../src/cli/paper.mjs';
import {doctor,scan,trader,positions,rules} from '../src/cli/commands.mjs';
import {spawn} from 'node:child_process';
const args=process.argv.slice(2),cmd=(args[0]&&!args[0].startsWith('-'))?args.shift():'terminal';
const has=x=>args.includes(x);const val=(x,d=null)=>{const i=args.indexOf(x);return i>=0&&args[i+1]!=null?args[i+1]:d};
const rt=new CopyRuntime({demo:has('--demo')});
const help=()=>console.log(`COPY — Robinhood Chain copytrade terminal\n\nUsage:\n  copy terminal [--demo]       interactive two-pane TUI\n  copy hunt [--fire-only]      newest-first decision feed\n  copy paper [--for 300]       dry-run copy engine + exits\n  copy trader <handle>         read one Fomo profit hunter\n  copy scan <symbol|address>   read one Robinhood token\n  copy positions               paper positions + marks\n  copy rules                   current risk walls\n  copy doctor --probe          providers + chain check\n  copy web                     start the optional web wrapper\n\nKeys in terminal: p engine · f filter · ↑↓ select · space paper copy · c track · r sync · q quit`);
try{
  if(cmd==='terminal')await terminal(rt,{demo:has('--demo')});
  else if(cmd==='hunt')await hunt(rt,{fireOnly:has('--fire-only'),forSec:Number(val('--for',0)),json:has('--json')});
  else if(cmd==='paper')await paper(rt,{forSec:Number(val('--for',0))});
  else if(cmd==='doctor')await doctor(rt,{probe:has('--probe')});
  else if(cmd==='scan')await scan(rt,args[0]);
  else if(cmd==='trader')await trader(rt,args[0]);
  else if(cmd==='positions')await positions(rt);
  else if(cmd==='rules')await rules(rt);
  else if(cmd==='web'){const p=spawn(process.execPath,['server.mjs'],{stdio:'inherit',env:process.env});p.on('exit',code=>process.exit(code??0))}
  else if(cmd==='help'||cmd==='--help'||cmd==='-h')help();
  else{console.error(`unknown command: ${cmd}\n`);help();process.exitCode=1}
}catch(e){console.error(`COPY: ${e.message}`);process.exitCode=1}
