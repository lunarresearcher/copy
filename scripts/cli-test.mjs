import assert from 'node:assert/strict';
import {CopyRuntime} from '../src/cli/runtime.mjs';
import {evaluate,DEFAULT_RULES} from '../src/cli/rules.mjs';

const rt=await new CopyRuntime({demo:true}).init();
assert.ok(rt.hunters.length>=50,'seed should contain many hunters');
assert.ok(rt.tokens.length>=5,'seed should contain RH tokens');
assert.ok(rt.candidates.length>=5,'candidates should build');
assert.ok(rt.events.length>=5,'terminal should boot with an event stream');
assert.ok(rt.shadowCopies.length>=8,'showcase should populate a dense replay shadow desk');

const cash=rt.tokens.find(x=>x.symbol==='CASHCAT');
const before=Number(cash?.price||0),eventsBefore=rt.events.length;
rt.demoTick();rt.heartbeat();
assert.ok(Number(cash?.price||0)!==before,'replay tick should visibly move a priced bootstrap token');
assert.ok(rt.events.length>eventsBefore,'replay/scanner should append new terminal events');

const ok=evaluate({token:{price:1,marketCap:1_000_000,liquidity:50_000,volume24h:80_000,change24h:8},trader:{name:'x',score:80},rules:DEFAULT_RULES,openPositions:0,spentEth:0});
assert.equal(ok.verdict,'FIRE');
const bad=evaluate({token:{price:0,marketCap:100_000_000,liquidity:1_000,volume24h:100,change24h:90},trader:null,rules:DEFAULT_RULES,openPositions:5,spentEth:.08});
assert.equal(bad.verdict,'SKIP');assert.ok(bad.reasons.length>=6);
console.log(`cli ok · ${rt.hunters.length} hunters · ${rt.tokens.length} RH tokens · ${rt.candidates.length} candidates · ${rt.events.length} stream events · ${rt.shadowCopies.length} shadow copies`);
