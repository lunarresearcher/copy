import assert from 'node:assert/strict';
import {CopyRuntime} from '../src/cli/runtime.mjs';
import {evaluate,DEFAULT_RULES} from '../src/cli/rules.mjs';

const rt=await new CopyRuntime({demo:true}).init();
assert.ok(rt.hunters.length>=50,'seed should contain many hunters');
assert.ok(rt.tokens.length>=50,'showcase should boot with a dense and growing token universe');
assert.ok(rt.candidates.length>=40,'candidates should build from the replay universe');
assert.ok(rt.events.length>=5,'terminal should boot with an event stream');
assert.ok(rt.shadowCopies.length>=20,'showcase should populate a dense replay shadow desk');

const beforePrices=new Map(rt.tokens.map(t=>[t.address,Number(t.price||0)]));
const tokensBefore=rt.tokens.length,eventsBefore=rt.events.length,pairsBefore=rt.demoMirrors.map(x=>`${x.handle}:${x.address}`).join('|');
rt.demoTick();
rt.demoTick(); // every second demo tick adds a genuinely new replay market
rt.demoTick(); // every third tick rotates at least one wallet pair
rt.heartbeat();
const moved=rt.tokens.some(t=>beforePrices.has(t.address)&&Number(t.price||0)!==beforePrices.get(t.address));
assert.ok(moved,'replay ticks should visibly move market prices');
assert.ok(rt.tokens.length>tokensBefore,'replay universe should keep adding new token rows beyond its initial size');
assert.ok(rt.events.length>eventsBefore,'replay/scanner should append new terminal events');
assert.notEqual(rt.demoMirrors.map(x=>`${x.handle}:${x.address}`).join('|'),pairsBefore,'wallet mirror pairs should rotate');
assert.ok(rt.shadowCopies.some(x=>Math.abs(Number(x.deltaPct||0))>.005),'mirror PnL should receive visible fast marks');

const ok=evaluate({token:{price:1,marketCap:1_000_000,liquidity:50_000,volume24h:80_000,change24h:8},trader:{name:'x',score:80},rules:DEFAULT_RULES,openPositions:0,spentEth:0});
assert.equal(ok.verdict,'FIRE');
const bad=evaluate({token:{price:0,marketCap:100_000_000,liquidity:1_000,volume24h:100,change24h:90},trader:null,rules:DEFAULT_RULES,openPositions:5,spentEth:.08});
assert.equal(bad.verdict,'SKIP');assert.ok(bad.reasons.length>=6);
console.log(`cli ok · ${rt.hunters.length} hunters · ${rt.tokens.length} markets and growing · ${rt.candidates.length} candidates · ${rt.events.length} stream events · ${rt.shadowCopies.length} rotating mirrors`);
