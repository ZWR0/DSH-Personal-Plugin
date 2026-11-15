import { harnessUrl } from './test-environment.mjs'
import assert from 'node:assert/strict'
const { Context } = await import(harnessUrl('vendor/cordis/lib/index.js'))
import * as reaper from '../session-reaper/index.js'
import { mkdtemp, rm, access } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
const { HostConnectionService } = await import(harnessUrl('packages/client/connection/lib/index.js'))
import { lifecycleDisposer } from '../session-reaper/index.js'
const temporary = await mkdtemp(join(tmpdir(), 'dsh-reaper-test-'))
const oldHome = process.env.DSH_HOME
process.env.DSH_HOME = temporary
const ctx = new Context()
const persistence = await import(harnessUrl('packages/session/session-persistence-jsonl/lib/index.js'))
await ctx.plugin(persistence, {root:join(temporary,'sessions')})
for (const [path,config] of [ ['llm/llm',undefined], ['core/session',undefined], ['session/session-projection',undefined], ['core/system-prompt',{personaPrefix:'Test'}], ['core/tools',undefined], ['core/tool-executor-native',undefined], ['core/agent',undefined], ['core/agent-loop',{agents:[]}] ]) {
 const mod=await import(harnessUrl('packages/'+path+'/lib/index.js'))
 await ctx.plugin(mod.default ?? mod,config)
}
try {
 const handle=await ctx.agents.create({sessionId:'reaper-lifecycle-fixture'})
 const other=await ctx.agents.create({sessionId:'reaper-lifecycle-other'})
 const dispose=lifecycleDisposer(handle.agent)
 await dispose()
 assert.equal(ctx.agents.get(handle.agent.id),undefined)
 assert.equal(ctx.sessions.get(handle.agent.id),undefined)
 assert.equal(ctx.agents.get(other.agent.id),other.agent)
 await other.dispose()
 let listingMode='normal'
 ctx.provide('sessionController', { list:async()=>{if(listingMode==='error')throw Error('lookup failed');return {items:ctx.agents.list().map(a=>({sessionId:a.id,running:listingMode==='running'||a.status==='running'}))}} })
 ctx.provide('workspaceRegistry', {create:async()=>({id:'recycle'})})
 ctx.provide('webServer', {register(){return ()=>{}}})
 let connection
 await ctx.plugin(c=>{connection=new HostConnectionService(c,[],{})})
 const fiber=await ctx.plugin(reaper)
 const shared=connection.createSharedFetchHandler('/api')
 const request=(sessionId,method='session-reaper/delete',extra={})=>new Request('http://localhost/api/'+(method==='wrong'?'session-reaper/delete':method),{method:'POST',body:JSON.stringify({type:'client-request',rpcId:'test',method,payload:{sessionId,...extra}})})
 const call=async (id,method,extra)=>(await (await shared.fetch(request(id,method,extra),{principal:{kind:'owner'}})).json()).result
 assert.equal((await shared.fetch(request('bad'),{principal:{kind:'guest'}})).status,403)
 assert.equal((await shared.fetch(request('bad','wrong'),{principal:{kind:'owner'}})).status,400)
 assert.equal((await call('../escape')).ok,false)
 const target=await ctx.agents.create({sessionId:'reaper-current-fixture',meta:{cwd:temporary}})
 await ctx.sessionPersistence.flush()
 const snapshot=await ctx.sessionPersistence.stat(target.agent.id)
 const directory=dirname(snapshot.location.path)
 listingMode='running'
 assert.equal((await call(target.agent.id)).ok,false)
 await access(directory)
 assert.equal(ctx.agents.get(target.agent.id),target.agent)
 listingMode='error'
 assert.equal((await call(target.agent.id)).ok,false)
 await access(directory)
 listingMode='normal'
 const deletion=await call(target.agent.id)
 assert.equal(deletion.ok,true,JSON.stringify(deletion))
 assert.equal(ctx.agents.get(target.agent.id),undefined)
 await assert.rejects(access(directory))
 assert.equal(await ctx.sessionPersistence.stat(target.agent.id),undefined)
 const { partition, directoryKey }=deletion.value
 await access(join(temporary,'session-reaper-trash',partition,directoryKey))
 const restored=await call(target.agent.id,'session-reaper/restore',{partition,directoryKey})
 assert.equal(restored.ok,true,JSON.stringify(restored))
 await access(directory)
 assert.equal((await ctx.sessionPersistence.stat(target.agent.id)).header.id,target.agent.id)
 await fiber.dispose()
 assert.equal((await shared.fetch(request('bad'),{principal:{kind:'owner'}})).status,404)
 console.log('REAPER HOST OK: real Agent teardown, sibling isolation, JSONL removal and restoration, authenticated route, envelope and uninstall')
} finally {
 await ctx.fiber.dispose()
 if(oldHome===undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME=oldHome
 assert(temporary.startsWith(join(tmpdir(), 'dsh-reaper-test-')))
 await rm(temporary,{recursive:true,force:true})
}
