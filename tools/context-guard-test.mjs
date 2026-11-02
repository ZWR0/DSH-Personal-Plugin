/** Isolated post-compaction admission and Cordis lifecycle regressions; no model API calls. */
import assert from 'node:assert/strict'
import { harnessUrl } from './test-environment.mjs'
import * as plugin from '../context-guard/index.js'
const { apply, resolveConfig } = plugin
let listener, registration, headroomListener, available = true
let pressure = 32789, queued = 0, capacity = 131072, output = 32768, directCalls = 0, recoveryPressure, recoveryFailure, cancelRecovery
const controller = new AbortController()
const payload = { agent: {session: {requestHeader:()=>({config:{provider:'test',model:'test',maxTokens:output}})}}, signal:controller.signal, messages:[], modelSelection:{provider:'test',model:'test'} }
const decision = {kind:'enter',messages:[],startsRequestSeries:true}
const services = {
  agentPresets:{serviceFor(agent,name){assert.equal(agent,payload.agent);assert.equal(name,'compaction');if(!available)return undefined;return {async compactIfNeeded(agent,trigger,signal){assert.equal(agent,payload.agent);assert.equal(trigger,'context-overflow');signal.throwIfAborted();directCalls++;if(cancelRecovery)cancelRecovery();if(recoveryFailure)throw recoveryFailure;if(recoveryPressure!==undefined)pressure=recoveryPressure;return null}}}},
  tokenMeter:{measure:()=>({totalTokens:pressure}),estimateMessage:()=>queued},
  llm:{async resolveModelInfo(){return {context:{contextWindow:capacity},defaultMaxTokens:8192}}},
}
apply({...services,on(event, fn, options){if(event==='compaction/token-budget'){headroomListener=fn;return}assert.equal(event,'agent/pre-step');listener=fn;registration=options}}, {})
assert.deepEqual(registration,{prepend:true})
assert.deepEqual(headroomListener({},()=>({headroomTokens:65536,maxTokens:65536})),{headroomTokens:8192,maxTokens:8192})
assert.deepEqual(headroomListener({},()=>({headroomTokens:4096,maxTokens:2048})),{headroomTokens:4096,maxTokens:2048},'preserve smaller explicit budgets')
assert.equal(await listener(payload,async()=>decision),decision,'32789 tokens above the early 32768 target still fit the actual request budget')
assert.equal(directCalls,0,'guard must not invoke a second compaction pass')
pressure=120000
assert.equal(await listener(payload,async()=>{pressure=32789;return decision}),decision,'measurement follows native compaction')
await assert.rejects(listener(payload,async()=>{throw Error('native failure')}),/native failure/,'uncontained downstream failures propagate')
pressure=91326;recoveryPressure=40000
assert.equal(await listener(payload,async()=>decision),decision,'automatically reduces history before rejecting the screenshot request')
assert.equal(directCalls,1)
pressure=50000;queued=41000;decision.messages=[{role:'user',content:[]}]
recoveryPressure=30000
assert.equal(await listener(payload,async()=>decision),decision,'queued messages crossing the ceiling trigger recovery')
assert.equal(directCalls,2)
recoveryPressure=undefined;queued=0;decision.messages=[]
pressure=91326;recoveryFailure=Error('summary failed')
await assert.rejects(listener(payload,async()=>decision),/summary failed/,'summary failure stops the request')
recoveryFailure=undefined
const duringRecovery=new AbortController()
cancelRecovery=()=>duringRecovery.abort()
await assert.rejects(listener({...payload,signal:duringRecovery.signal},async()=>decision),{name:'AbortError'})
cancelRecovery=undefined
pressure=90112
await assert.rejects(listener(payload,async()=>decision),error=>error.code==='CONTEXT_BUDGET_EXCEEDED')
pressure=50000;queued=90112;decision.messages=[{role:'user',content:[]}]
const beforeOversized=directCalls
await assert.rejects(listener(payload,async()=>decision),error=>error.code==='CONTEXT_BUDGET_EXCEEDED')
assert.equal(directCalls,beforeOversized,'oversized pending message cannot be repaired by history compaction')
pressure=50000;queued=41000;decision.messages=[{role:'user',content:[]}]
await assert.rejects(listener(payload,async()=>decision),error=>error.code==='CONTEXT_BUDGET_EXCEEDED','includes final admitted messages even when the payload batch is empty')
pressure=50000;queued=0;output=80000
await assert.rejects(listener(payload,async()=>decision),error=>error.code==='CONTEXT_BUDGET_EXCEEDED')
output=32768;capacity=undefined
await assert.rejects(listener(payload,async()=>decision),error=>error.code==='CONTEXT_CAPACITY_UNKNOWN')
const rejected={kind:'reject'}
assert.equal(await listener(payload,async()=>rejected),rejected,'rejected steps require no model capacity')
available=false
await assert.rejects(listener(payload,async()=>{assert.fail('missing service must stop delegation')}),error=>error.code==='CONTEXT_COMPACTION_UNAVAILABLE')
available=true;capacity=131072;output=80000;payload.modelSelection.model='other-model'
assert.equal(await listener(payload,async()=>decision),decision,'new model uses its own output default')
controller.abort()
await assert.rejects(listener(payload,async()=>decision),{name:'AbortError'})
const cancelled=new AbortController()
await assert.rejects(listener({...payload,signal:cancelled.signal},async()=>{cancelled.abort();return decision}),{name:'AbortError'})
for(const config of [null,{typo:1},{maxPressureRatio:1},{maxPressureRatio:0},{maxPressureRatio:'0.8'},{reserveTokens:-1},{reserveTokens:1.5},{summaryMaxTokens:0},{summaryMaxTokens:1.5}])assert.throws(()=>resolveConfig(config))
assert.deepEqual(resolveConfig({maxPressureRatio:0.85,reserveTokens:4096}),{maxPressureRatio:0.85,reserveTokens:4096,summaryMaxTokens:8192})
console.log('CONTEXT GUARD OK: screenshot boundary, post-compaction metering, final messages, output reservation, capacity, cancellation and config')

const { Context } = await import(harnessUrl('vendor/cordis/lib/index.js'))
const ctx = new Context()
let fallbackCalls=0, nativeCalls=0, recordedWarnings=0
ctx.provide('agentPresets',services.agentPresets)
ctx.provide('tokenMeter',services.tokenMeter)
ctx.provide('llm',services.llm)
// Model the native listener: exhausted early-target retries are logged, and
// the already-committed history remains available for the next request.
ctx.on('agent/pre-step',async (payload,next)=>{
 nativeCalls++
 try {throw Error('compaction still above threshold after 2 compaction attempts (32789 estimated tokens >= threshold 32768)')}
 catch(error){assert.match(error.message,/still above threshold/);recordedWarnings++}
 return next()
})
const fiber=ctx.plugin(plugin,{maxPressureRatio:0.9,reserveTokens:8192})
try {
 await fiber
 assert.deepEqual(ctx.waterfall('compaction/token-budget',{agent:payload.agent},()=>({headroomTokens:65536,maxTokens:65536})),{headroomTokens:8192,maxTokens:8192})
 const request={...payload,signal:new AbortController().signal}
 const next=async()=>{fallbackCalls++;return decision}
 pressure=32789
 assert.equal(await ctx.waterfall('agent/pre-step',request,next),decision)
 assert.equal(nativeCalls,1);assert.equal(recordedWarnings,1);assert.equal(fallbackCalls,1);const callsBeforeUnsafe=directCalls
 pressure=120000
 await assert.rejects(ctx.waterfall('agent/pre-step',request,next),error=>error.code==='CONTEXT_BUDGET_EXCEEDED')
 assert.equal(nativeCalls,2);assert.equal(directCalls,callsBeforeUnsafe+1,'one bounded recovery for unsafe requests')
 assert.equal(fallbackCalls,2,'pre-step terminal assembles a decision, never sends a model request')
 await fiber.dispose()
 assert.deepEqual(ctx.waterfall('compaction/token-budget',{agent:payload.agent},()=>({headroomTokens:65536,maxTokens:65536})),{headroomTokens:65536,maxTokens:65536},'unload restores native budgets')
 assert.equal(await ctx.waterfall('agent/pre-step',request,next),decision)
 assert.equal(nativeCalls,3);assert.equal(fallbackCalls,3)
 console.log('CONTEXT GUARD CORDIS OK: native retries run once, safe warning continues, unsafe request blocked, unload removes guard')
}finally{await ctx.fiber.dispose()}
