import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
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
  const cursor = () => execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position | ConvertTo-Json -Compress'], {windowsHide:true,encoding:'utf8'}).trim()
  const before = cursor()
  for (const point of [{x:200,y:200},{x:600,y:400},{x:300,y:500}]) {
    const moved = await call('move', point)
    assert.equal(moved.pointerMode,'virtual')
    assert.equal(moved.systemCursorMoved,false)
    assert.equal(moved.hoverDispatched,false)
    assert.equal(cursor(),before,'Virtual desktop moves must not reposition the system cursor')
  }
  const found = await call('find',{nativeWindowHandle,query:'播放'})
  const play = found.results.find(item=>item.name==='播放')
  assert(play)
  const clicked = await call('click',{nativeWindowHandle,x:play.boundingBox.centerX,y:play.boundingBox.centerY})
  assert.match(clicked.method,/^background:/)
  await until(()=>state.plays===1)
  assert.equal(cursor(),before,'Coordinate auto click must prefer UIA without repositioning the user cursor')
  assert.equal(state.plays,1,'UIA coordinate resolution must not duplicate the click')
  console.log('PASS: real MCP virtual moves and coordinate-to-UIA click preserve system cursor, with exactly one delivered click')
} finally {
  fixture.kill()
  await Promise.all([stop(fixture), stop(server)])
  fixtureLines.close(); serverLines.close()
}
