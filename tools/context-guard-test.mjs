import { harnessUrl } from './test-environment.mjs'
import * as plugin from '../context-guard/index.js'
/** Isolated safety-hook tests: stop before a model request, retain native decisions and cancellation. */
import assert from 'node:assert/strict'
import { apply, resolveConfig } from '../context-guard/index.js'
let listener, registration, available = true
let pressure = 74000, queued = 0, compactError, calls = 0, nextCalls = 0, capacity = 128000, output = 8192
const controller = new AbortController()
const payload = { agent: {session: {requestHeader:()=>({config:{provider:'test',model:'test',maxTokens:output}})}}, signal:controller.signal, messages:[], modelSelection:{provider:'test',model:'test'} }
const decision = {kind:'enter',messages:[],startsRequestSeries:true}
const next = async()=>{nextCalls++;return decision}
apply({
  on(event, fn, options){assert.equal(event,'agent/pre-step');listener=fn;registration=options},
  agentPresets:{serviceFor(agent,name){assert.equal(agent,payload.agent);assert.equal(name,'compaction');if(!available)return undefined;return {async compactIfNeeded(agent,trigger,signal){assert.equal(trigger,'pressure');assert.equal(signal,controller.signal);calls++;if(compactError)throw compactError}}}},
  tokenMeter:{measure:()=>({totalTokens:pressure}),estimateMessage:()=>queued},
  llm:{async resolveModelInfo(){return {context:{contextWindow:capacity},defaultMaxTokens:8192}}},
}, {maxPressureRatio:0.9,reserveTokens:8192})
assert.deepEqual(registration,{prepend:true})
assert.equal(await listener(payload,next),decision)
assert.equal(calls,1);assert.equal(nextCalls,1)
compactError=Error('summary unavailable')
await assert.rejects(listener(payload,next),error=>error.code==='CONTEXT_COMPACTION_FAILED' && error.cause===compactError)
assert.equal(nextCalls,1,'failed compaction never reaches the ordinary fail-open listener or model request')
compactError=undefined
pressure=115200
await assert.rejects(listener(payload,next),error=>error.code==='CONTEXT_BUDGET_EXCEEDED')
assert.equal(nextCalls,1)
pressure=50000;queued=65000;payload.messages=[{role:'user',content:[]}]
await assert.rejects(listener(payload,next),error=>error.code==='CONTEXT_BUDGET_EXCEEDED')
pressure=50000;queued=0;output=80000
await assert.rejects(listener(payload,next),error=>error.code==='CONTEXT_BUDGET_EXCEEDED')
output=8192;capacity=undefined
await assert.rejects(listener(payload,next),error=>error.code==='CONTEXT_CAPACITY_UNKNOWN')
available=false
await assert.rejects(listener(payload,next),error=>error.code==='CONTEXT_COMPACTION_UNAVAILABLE')
available=true;capacity=128000;output=80000;payload.modelSelection.model='other-model'
assert.equal(await listener(payload,next),decision,'a new route uses its own output default rather than the previous route cap')
controller.abort()
await assert.rejects(listener(payload,next),{name:'AbortError'})
for(const config of [null, {typo:1}, {maxPressureRatio:1},{maxPressureRatio:0},{maxPressureRatio:'0.8'},{reserveTokens:-1},{reserveTokens:1.5}])assert.throws(()=>resolveConfig(config))
assert.deepEqual(resolveConfig({maxPressureRatio:0.85,reserveTokens:4096}),{maxPressureRatio:0.85,reserveTokens:4096})
console.log('CONTEXT GUARD OK: delegation, failed summary, residual pressure, queued input, output reservation, missing capacity, cancellation and config validation')

const { Context } = await import(harnessUrl('vendor/cordis/lib/index.js'))
const ctx = new Context()
let fallbackCalls = 0, nativeCalls = 0
ctx.provide('agentPresets',{serviceFor(agent,name){assert.equal(name,'compaction');if(!available)return undefined;return {async compactIfNeeded(){throw Error('empty summary')}}}})
ctx.provide('tokenMeter',{measure(){return {totalTokens:0}},estimateMessage(){return 0}})
ctx.provide('llm',{async resolveModelInfo(){return {context:{contextWindow:128000}}}})
ctx.on('agent/pre-step',async (payload,next)=>{nativeCalls++;return next()})
const fiber = ctx.plugin(plugin,{maxPressureRatio:0.9,reserveTokens:8192})
try {
 await fiber
 const request={...payload,signal:new AbortController().signal}
 await assert.rejects(ctx.waterfall('agent/pre-step',request,async()=>{fallbackCalls++;return decision}),error=>error.code==='CONTEXT_COMPACTION_FAILED')
 assert.equal(nativeCalls,0);assert.equal(fallbackCalls,0)
 await fiber.dispose()
 assert.equal(await ctx.waterfall('agent/pre-step',request,async()=>{fallbackCalls++;return decision}),decision)
 assert.equal(nativeCalls,1);assert.equal(fallbackCalls,1)
 console.log('CONTEXT GUARD CORDIS OK: prepend runs before native continuation; unload removes the guard')
}finally{await ctx.fiber.dispose()}
