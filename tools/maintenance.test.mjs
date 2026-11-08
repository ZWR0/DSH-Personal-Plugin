import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { fork } from 'node:child_process'
import { once } from 'node:events'
import { performRemoval } from './managed-host.mjs'
import { maintenanceBridge } from '../local-vault/maintenance.js'

function operations(failure) {
  const calls = []
  let builds = 0
  const ops = Object.fromEntries(['stopped', 'preflight', 'backup', 'remove', 'restore', 'restart'].map(name => [name, async () => {
    calls.push(name)
    if (failure === name) throw new Error(name + ' failed')
  }]))
  ops.build = async () => { calls.push('build'); if (++builds === 1 && failure === 'build') throw new Error('build failed') }
  return { ops, calls }
}
test('stops before checking or mutating; only restarts after a successful build', async () => {
  const { ops, calls } = operations()
  assert.deepEqual(await performRemoval(ops), { rolledBack: false })
  assert.deepEqual(calls, ['stopped', 'preflight', 'backup', 'remove', 'build', 'restart'])
})
test('failed stop or changed source never mutates files', async () => {
  for (const failure of ['stopped', 'preflight', 'backup']) {
    const { ops, calls } = operations(failure)
    await assert.rejects(performRemoval(ops), /failed/)
    assert(!calls.includes('remove')); assert(!calls.includes('restart'))
  }
})
test('failed build restores and rebuilds before restarting', async () => {
  const { ops, calls } = operations('build')
  assert.deepEqual(await performRemoval(ops), { rolledBack: true })
  assert.deepEqual(calls, ['stopped', 'preflight', 'backup', 'remove', 'build', 'restore', 'build', 'restart'])
})
test('failed restoration leaves the Host stopped', async () => {
  const { ops, calls } = operations('build')
  ops.restore = async () => { calls.push('restore'); throw new Error('restore conflict') }
  await assert.rejects(performRemoval(ops), /restore conflict/)
  assert(!calls.includes('restart'))
})
test('failed credential migration restores the patch before restart', async () => {
  const { ops, calls } = operations()
  ops.prepareRestart = async () => { calls.push('migration'); throw new Error('credential changed') }
  assert.deepEqual(await performRemoval(ops), { rolledBack: true })
  assert.deepEqual(calls, ['stopped', 'preflight', 'backup', 'remove', 'build', 'migration', 'restore', 'build', 'restart'])
})
test('ordinary startup cannot trigger patch removal', async () => {
  const bridge = maintenanceBridge({}, { env: {} })
  assert.equal((await bridge.status()).managed, false)
  await assert.rejects(bridge.remove('patch'), /未由受管/)
})
test('authentication removal refuses unknown credential backends before sending IPC', async () => {
  const proc = new EventEmitter()
  proc.env = { DSH_MANAGED_NONCE: 'fixture' }; proc.connected = true
  proc.send = () => assert.fail('must not request removal')
  const disposers = []
  const ctx = { profileContext: { home: '/fixture' }, get: name => name === 'appExit' ? () => assert.fail('must not exit') : name === 'agents' ? { list: () => [] } : {}, effect: fn => disposers.push(fn()) }
  const bridge = maintenanceBridge(ctx, proc)
  try { await assert.rejects(bridge.remove('patches/dsh-persistent-web-token.patch'), /默认本地凭据/) }
  finally { for (const dispose of disposers) dispose() }
})
test('bridge rejects active tasks, validates IPC replies, and removes listeners', async () => {
  const proc = new EventEmitter()
  proc.env = { DSH_MANAGED_NONCE: 'fixture' }; proc.connected = true
  const disposers = []
  let messages = 0
  proc.send = (message, done) => {
    messages++; done()
    proc.emit('message', { type: 'vault-maintenance-result', nonce: 'wrong', id: message.id, value: { managed: false } })
    proc.emit('message', { type: 'vault-maintenance-result', nonce: 'fixture', id: message.id, value: { managed: true } })
  }
  const ctx = { get: name => name === 'appExit' ? () => assert.fail('must not exit') : { list: () => [{ status: 'running' }] }, effect: fn => disposers.push(fn()) }
  const bridge = maintenanceBridge(ctx, proc)
  assert.equal((await bridge.status()).managed, true)
  await assert.rejects(bridge.remove('patch'), /停止所有/)
  assert.equal(messages, 1)
  for (const dispose of disposers) dispose()
  assert.equal(proc.listenerCount('message'), 0)
})
test('accepted removal returns before requesting native graceful exit and blocks duplicates', async () => {
  const proc = new EventEmitter()
  proc.env = { DSH_MANAGED_NONCE: 'fixture' }; proc.connected = true
  const disposers = []
  let exitCalls = 0, guard
  const exited = new Promise(resolve => {
    proc.send = (message, done) => {
      done()
      proc.emit('message', { type: 'vault-maintenance-result', nonce: 'fixture', id: message.id, value: { accepted: true } })
    }
    const ctx = {
      get: name => name === 'appExit' ? code => { assert.equal(code, 0); exitCalls++; resolve() } : { list: () => [{ status: 'idle' }] },
      effect: fn => disposers.push(fn()), on: (_, fn) => { guard = fn },
    }
    const bridge = maintenanceBridge(ctx, proc)
    void (async () => {
      assert.equal((await bridge.remove('patch')).accepted, true)
      assert.equal(exitCalls, 0)
      assert.throws(guard, /停机维护/)
      await assert.rejects(bridge.remove('patch'), /正在停机/)
    })().catch(resolve)
  })
  const result = await exited
  if (result instanceof Error) throw result
  assert.equal(exitCalls, 1)
  for (const dispose of disposers) dispose()
})
test('real child IPC shuts down before the external owner mutates and rebuilds', { timeout: 10000 }, async t => {
  const child = fork(new URL('./fixtures/maintenance-child.mjs', import.meta.url), [], {
    env: { ...process.env, DSH_MANAGED_NONCE: 'isolated' }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
  })
  t.after(() => { if (child.exitCode === null) child.kill() })
  const events = []
  const exited = once(child, 'exit')
  let accepted
  const request = new Promise(resolve => { accepted = resolve })
  child.on('message', message => {
    if (message.fixture === 'flushing') { events.push('flush'); return }
    if (message.type !== 'vault-maintenance') return
    child.send({ type: 'vault-maintenance-result', nonce: 'isolated', id: message.id, value: { managed: true, accepted: true } })
    if (message.action === 'remove') accepted()
  })
  await request
  await performRemoval({
    stopped: async () => { const [code] = await exited; assert.equal(code, 0); events.push('stopped') },
    preflight: async () => events.push('checked'), backup: async () => events.push('backed-up'),
    remove: async () => events.push('removed'), build: async () => events.push('built'), restart: async () => events.push('restarted'),
  })
  assert.deepEqual(events, ['flush', 'stopped', 'checked', 'backed-up', 'removed', 'built', 'restarted'])
})
