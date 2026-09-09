import fs from 'node:fs';
if(fs.existsSync('.env')){
  for(const line of fs.readFileSync('.env','utf8').split(/\r?\n/)){
    const s=line.trim();if(!s||s.startsWith('#'))continue;const i=s.indexOf('=');if(i<1)continue;const k=s.slice(0,i).trim(),v=s.slice(i+1).trim().replace(/^['"]|['"]$/g,'');if(process.env[k]==null)process.env[k]=v;
  }
}
export const config={port:Number(process.env.PORT||8787),fomoPollMs:Number(process.env.POLL_FOMO_MS||15000),chainPollMs:Number(process.env.POLL_CHAIN_MS||5000),dexPollMs:Number(process.env.POLL_DEX_MS||15000),cacheFile:process.env.CACHE_FILE||'./data/cache.json',replyNodesKey:process.env.REPLYNODES_API_KEY||'',replyNodesChain:process.env.REPLYNODES_FOMO_CHAIN||'robinhood',fomoBearer:process.env.FOMO_BEARER_TOKEN||'',rpcUrl:process.env.RH_RPC_URL||'https://rpc.mainnet.chain.robinhood.com',rpcFallback:process.env.RH_RPC_FALLBACK||'https://rpc.mainnet.chain.robinhood.com',gmgnKey:process.env.GMGN_API_KEY||'',rhInitialLookback:Number(process.env.RH_INITIAL_LOOKBACK||24000),nativeExecutorWebhook:process.env.NATIVE_EXECUTOR_WEBHOOK||'',nativeExecutorToken:process.env.NATIVE_EXECUTOR_TOKEN||'',nativeExecutorPollMs:Number(process.env.NATIVE_EXECUTOR_POLL_MS||1500)};
