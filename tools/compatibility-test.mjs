/** Reject incompatible installs before any PluginManager mutation. */
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { compatibilityIssues, apply } from '../local-vault/index.js'
import { resolveHarnessRoot, harnessRoot, dependencyPath } from './test-environment.mjs'

const temporary = await mkdtemp(join(tmpdir(), 'dsh-compatibility-'))
try {
  const checkout = join(temporary, 'checkout 空 格')
  await mkdir(checkout)
  await writeFile(join(checkout, 'package.json'), JSON.stringify({ name: '@deepseek-ai/dsh-root' }))
  assert.equal(resolveHarnessRoot(checkout), checkout)
  assert.throws(() => resolveHarnessRoot(temporary), /DSH_SOURCE/)
  const invalid = spawnSync(process.execPath, [fileURLToPath(new URL('./check.mjs', import.meta.url)), '--doctor'], {
    env: { ...process.env, DSH_SOURCE: temporary }, encoding: 'utf8',
  })
  assert.equal(invalid.status, 1)
  assert.match(invalid.stderr, /FAIL.*DSH_SOURCE/)
  assert.equal(resolveHarnessRoot(harnessRoot), harnessRoot)
  assert(dependencyPath('react').includes('react'))
  assert.throws(() => dependencyPath('missing-dsh-test-dependency'), /pnpm install/)
  const calls = []
  let repair = false
  const routes = new Map()
  const connection = { fetch: { register(route) { routes.set(route.path, route.fetch); return () => {} } } }
  assert.deepEqual(compatibilityIssues('@local/dsh-remote-access', { connection }), [
    'connection.webAuthStatus', 'connection.webAuthToken', 'connection.setWebAuthToken', 'connection.clearWebAuthToken',
  ])
  const root = join(temporary, 'plugins')
  const remote = join(root, 'remote-access')
  await mkdir(remote, { recursive: true })
  await writeFile(join(remote, 'package.json'), JSON.stringify({ name: '@local/dsh-remote-access', version: '1.0.0', dsh: { bundle: { patch: './cordis.patch.yml' } } }))
  await writeFile(join(remote, 'cordis.patch.yml'), '- insert: []')
  const ctx = { connection, profileContext: { dir: join(temporary, 'profile') }, effect: fn => fn(), pluginManager: {
    listBundles: async () => repair ? [{ name: '@local/dsh-remote-access', installed: true, removable: true, source: join(temporary, 'missing-source'), enabled: false }] : [],
    removeBundle: async () => { calls.push('remove'); return { application: 'applied' } },
    installBundle: async () => { calls.push('install'); return { application: 'applied' } },
  } }
  apply(ctx)
  const call = async (endpoint, payload) => {
    const response = await routes.get('/api/local-vault/' + endpoint)(new Request('http://localhost/api/local-vault/' + endpoint, {
      method: 'POST', body: JSON.stringify({ type: 'client-request', rpcId: 'test', method: 'local-vault/' + endpoint, payload }),
    }))
    return (await response.json()).result
  }
  const scan = await call('save', { directory: root })
  assert.equal(scan.ok, true, JSON.stringify(scan))
  assert.equal(scan.value.candidates[0].compatibility.compatible, false)
  assert(scan.value.warnings[0].message.includes('webAuthStatus'))
  const rejected = await call('install', { path: remote })
  assert.equal(rejected.error.code, 'local-vault/incompatible-host')
  assert.deepEqual(calls, [])
  for (const name of ['webAuthStatus', 'webAuthToken', 'setWebAuthToken', 'clearWebAuthToken']) connection[name] = () => { throw new Error('Preflight must not invoke authentication methods') }
  assert.deepEqual(compatibilityIssues('@local/dsh-remote-access', ctx), [])
  assert.equal((await call('install', { path: remote })).ok, true)
  assert.deepEqual(calls, ['install'])
  delete connection.clearWebAuthToken
  repair = true
  assert.equal((await call('install', { path: remote })).ok, false)
  assert.deepEqual(calls, ['install'])
  assert.deepEqual(compatibilityIssues('@local/other', ctx), [])
  console.log('COMPATIBILITY OK: explicit checkout, paths with spaces and Unicode, missing dependency, scan diagnostics, blocked install, compatible install, recheck; no credential methods invoked')
} finally { await rm(temporary, { recursive: true, force: true }) }
