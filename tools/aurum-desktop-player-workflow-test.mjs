import assert from 'node:assert/strict'
import { playNativeFullscreen } from '../aurum-desktop/mcp/player-workflow.mjs'

const args = { elementId: 'player', nativeWindowHandle: 1, timeoutMs: 5000 }
const fixture = ({ paused = true, missingFullscreen = false, ambiguous = false, frozen = false, unknownPlay = false } = {}) => {
  const calls = []
  let playing = !paused, fullscreen = false, time = 0
  const run = async (action, input) => {
    calls.push([action, input])
    if (action === 'click') {
      if (input.elementId === 'play') playing = true
      else if (input.elementId === 'full') fullscreen = true
      else assert.fail('Unexpected control')
    }
    if (action !== 'tree') return { ok: true }
    if (playing && !frozen) time++
    const controls = [{ id:'time', name:`00:${String(time).padStart(2,'0')} / 05:00` }]
    if (!playing) controls.push({ id:'play', controlType:'Button', name:unknownPlay?'播放/暂停':'播放' })
    if (!missingFullscreen) controls.push({ id:'full', controlType:'Button', name:fullscreen?'退出全屏':'全屏' })
    controls.push({ id:'web', controlType:'Button', name:'网页全屏' })
    if (ambiguous) controls.push({ id:'full2', controlType:'Button', name:'全屏' })
    const player = { id:'player', name:'视频播放器', controlType:'Pane', boundingBox:fullscreen?{x:0,y:0,width:1920,height:1080}:{x:200,y:200,width:900,height:500}, children:controls }
    return { tree:{id:'window',name:'Fixture video',children:[player]},displayBounds:{x:0,y:0,width:1920,height:1080} }
  }
  return { run, calls }
}
for (const paused of [true, false]) {
  const { run, calls } = fixture({ paused })
  const result = await playNativeFullscreen(args, run, {})
  assert.equal(result.verification, 'observed')
  assert.deepEqual(calls.filter(([action])=>action==='click').map(([,input])=>input.elementId), paused?['play','full']:['full'])
  assert(!calls.some(([action])=>action==='keypress'))
  assert(calls.filter(([action])=>action==='click').every(([,input])=>input.activate===true))
}
for (const [options,error] of [[{missingFullscreen:true},/VIDEO_FULLSCREEN_CONTROL_MISSING/],[{ambiguous:true},/VIDEO_CONTROL_AMBIGUOUS/],[{frozen:true},/VIDEO_WORKFLOW_TIMEOUT/]]) {
  const { run, calls } = fixture(options)
  await assert.rejects(playNativeFullscreen({...args,timeoutMs:1000},run,{}),error)
  assert(calls.filter(([action,input])=>action==='click'&&input.elementId==='full').length<=1)
  assert(!calls.some(([action])=>action==='keypress'))
}
const unknown=fixture({unknownPlay:true,frozen:true})
await assert.rejects(playNativeFullscreen({...args,timeoutMs:1000},unknown.run,{}),/VIDEO_WORKFLOW_TIMEOUT/)
assert(!unknown.calls.some(([action])=>action==='click'))
await assert.rejects(playNativeFullscreen({...args,nativeWindowHandle:undefined,windowTitle:' '},async()=>assert.fail('Missing target must send no actions'),{}),/VIDEO_TARGET_REQUIRED/)
const changed=fixture({paused:false})
let reads=0
await assert.rejects(playNativeFullscreen(args,async(action,input)=>{
  const result=await changed.run(action,input)
  if(action==='tree'&&++reads>1)result.tree.name='Different video'
  return result
},{}),/VIDEO_TARGET_CHANGED/)
assert(!changed.calls.some(([action,input])=>action==='click'&&input.elementId==='full'))
const interrupted={cancelled:false}
const midway=fixture()
await assert.rejects(playNativeFullscreen(args,async(action,input)=>{
  const value=await midway.run(action,input)
  if(action==='click'&&input.elementId==='play')interrupted.cancelled=true
  return value
},interrupted),/COMPUTER_USE_CANCELLED/)
assert(!midway.calls.some(([action,input])=>action==='click'&&input.elementId==='full'))
const cancelled={cancelled:true}
await assert.rejects(playNativeFullscreen(args,async()=>assert.fail('Cancelled workflow must send no action'),cancelled),/COMPUTER_USE_CANCELLED/)
console.log('PASS: activate → play once if paused → player fullscreen once → advancing progress; ambiguity, failure and cancellation stop dependent actions')
