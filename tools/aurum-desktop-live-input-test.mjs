import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline'

// Interactive Windows acceptance: uses only its own disposable window.
const fixture = spawn('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', fileURLToPath(new URL('./fixtures/aurum-desktop-pointer.ps1', import.meta.url))], { windowsHide: false })
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
  const hwnd = state.windowHandle
  for (const [index, dispatch] of ['auto', 'foreground'].entries()) {
    for (const [name, key] of [['左侧目标', 'left'], ['右侧目标', 'right']]) {
      const found = await call('find', { query: name, nativeWindowHandle: hwnd, activate: true })
      const element = found.results.find(item => item.name === name)
      assert(element, 'Find the real button before clicking')
      const result = await call('click', { elementId: element.id, nativeWindowHandle: hwnd, dispatch })
      assert.equal(result.agentTarget.x, state[key + 'Center'].x)
      assert.equal(result.agentTarget.y, state[key + 'Center'].y)
      await until(() => state[key] >= index + 1)
      assert.equal(state[key], index + 1, 'One tool call produces one click')
    }
  }
  const left = state.leftCenter, right = state.rightCenter
  const result = await call('drag', { nativeWindowHandle: hwnd, path: [{ x: left.x, y: left.y + 120 }, { x: left.x + 250, y: left.y + 140 }, { x: right.x, y: right.y - 120 }] })
  assert.equal(result.agentTarget.x, right.x)
  assert.equal(result.agentTarget.y, right.y - 120)
  assert.equal(state.left, 2)
  assert.equal(state.right, 2)
  console.log('PASS: real MCP background and foreground clicks (2/2), exact control targets, three-point drag and release')
} finally {
  fixture.kill()
  await Promise.all([stop(fixture), stop(server)])
  fixtureLines.close(); serverLines.close()
}
