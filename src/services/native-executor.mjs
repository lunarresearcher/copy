const iso=()=>new Date().toISOString();
const shortTx=x=>String(x||'').length>14?`${String(x).slice(0,8)}…${String(x).slice(-6)}`:String(x||'');
export class NativeExecutor {
  constructor({webhook='',token=''}={},state){this.webhook=String(webhook||'').trim();this.token=String(token||'').trim();this.state=state;this.busy=false;this.mode=this.webhook?'webhook':'queue';this.updateStatus({ready:true})}
  updateStatus(extra={}){this.state.data.executor={...(this.state.data.executor||{}),mode:this.mode,ready:true,lastSync:iso(),...extra}}
  order(entry){return {version:1,chainId:4663,network:'robinhood',action:entry.action,tokenAddress:entry.tokenAddress,symbol:entry.symbol,sizeEth:entry.sizeEth,slippagePct:entry.slippagePct,maxTaxPct:entry.maxTaxPct,takeProfitPct:entry.takeProfitPct,stopLossPct:entry.stopLossPct,conviction:entry.conviction,source:{ruleId:entry.ruleId,tradeId:entry.tradeId,subject:entry.subject,subjectName:entry.subjectName,sourceTradeAt:entry.sourceTradeAt}}}
  async tick(){if(this.busy)return;this.busy=true;try{
    this.updateStatus({queueDepth:(this.state.data.copyActivity||[]).filter(x=>x.status==='ARMED').length});
    if(!this.webhook)return;
    const now=Date.now(),items=(this.state.data.copyActivity||[]).filter(x=>x.status==='ARMED'&&(!x.execution?.nextAttemptAt||new Date(x.execution.nextAttemptAt).getTime()<=now)).slice().reverse().slice(0,8);
    for(const entry of items){entry.status='DISPATCHING';entry.reason='native executor dispatch';entry.execution={...(entry.execution||{}),mode:this.mode,lastAttempt:iso()};this.state.broadcast('execution',{tradeId:entry.tradeId,status:entry.status});
      try{const headers={'content-type':'application/json'};if(this.token)headers.authorization=`Bearer ${this.token}`;const res=await fetch(this.webhook,{method:'POST',headers,body:JSON.stringify(this.order(entry)),signal:AbortSignal.timeout(12000)});let payload={};try{payload=await res.json()}catch{}if(!res.ok)throw new Error(payload.error||`executor ${res.status}`);const txHash=payload.txHash||payload.hash||payload.transactionHash||null,status=String(payload.status||'').toUpperCase();entry.status=txHash?'EXECUTED':(['EXECUTED','SENT','QUEUED','EXITED'].includes(status)?status:'SENT');entry.reason=txHash?`native broadcast · ${shortTx(txHash)}`:'native executor accepted';entry.execution={...entry.execution,acceptedAt:iso(),txHash,responseStatus:status||null,nextAttemptAt:null};this.updateStatus({lastSuccess:iso(),lastError:null})}
      catch(e){entry.status='ARMED';entry.reason='native executor retrying';entry.execution={...entry.execution,lastError:String(e.message||e),nextAttemptAt:new Date(Date.now()+10000).toISOString()};this.updateStatus({lastError:String(e.message||e)})}this.state.broadcast('execution',{tradeId:entry.tradeId,status:entry.status});
    }
    await this.state.save();
  }finally{this.busy=false}}
}
