import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'

// Interactive Windows acceptance: uses only its own disposable window.
const fixture = spawn('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', fileURLToPath(new URL('./fixtures/aurum-video-player.ps1', import.meta.url))], { windowsHide: false })
const server = spawn(process.execPath, [fileURLToPath(new URL('../aurum-desktop/mcp/server.mjs', import.meta.url))], { windowsHide: true })
let state, nextId = 0
const pending = new Map()
const fixtureLines = createInterface({ input: fixture.stdout })
const serverLines = createInterface({ input: server.stdout })
fixtureLines.on('line', line => { state = JSON.parse(line.replace(/^\uFEFF/, '')) })
serverLines.on('line', line => {
  const message = JSON.parse(line)
  pending.get(message.id)?.(message)
})
const until = async predicate => {
  const deadline = Date.now() + 10000
  while (Date.now() < deadline) {
    if (predicate()) return
    assert.equal(fixture.exitCode, null, 'Fixture must remain open')
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  assert.fail('Timed out waiting for fixture state')
}
const call = async (name, args) => {
  const id = ++nextId
  let timer
  const response = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(Error(`Timed out: ${name}`)), 25000)
    pending.set(id, resolve)
  })
  try {
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: `windows_computer_use_${name}`, arguments: args } }) + '\n')
    const message = await response
    assert(!message.result.isError, JSON.stringify(message.result))
    return JSON.parse(message.result.content.find(item => item.type === 'text').text)
  } finally { clearTimeout(timer); pending.delete(id) }
}
const stop = async child => {
  if (child.exitCode !== null || child.signalCode !== null) return
  const exited = once(child, 'exit')
  const timer = setTimeout(() => child.kill(), 3000)
  child.stdin.end()
  try { await exited } finally { clearTimeout(timer) }
}
try {
  await until(() => !!state)
  const nativeWindowHandle=state.windowHandle
  const found=await call('find',{nativeWindowHandle,query:'验收视频播放器',activate:true})
  const player=found.results.find(item=>item.name==='验收视频播放器')
  assert(player)
  const args={nativeWindowHandle,elementId:player.id,action:'play_fullscreen',timeoutMs:15000}
  const result=await call('invoke',args)
  assert.equal(result.verification,'observed')
  assert.deepEqual(result.steps,['activated','play-clicked','playback-observed','fullscreen-clicked'])
  assert.equal(state.plays,1);assert.equal(state.fulls,1);assert.equal(state.webs,0)
  const again=await call('invoke',args)
  assert.equal(again.verification,'observed')
  assert.equal(state.plays,1);assert.equal(state.fulls,1);assert.equal(state.webs,0)
  console.log('PASS: real MCP/UIA player workflow activates window, plays once, clicks player fullscreen once, observes progress and monitor bounds, and does not toggle on repeat')
} finally {
  fixture.kill()
  await Promise.all([stop(fixture), stop(server)])
  fixtureLines.close(); serverLines.close()
}
