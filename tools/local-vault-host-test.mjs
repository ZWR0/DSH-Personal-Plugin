import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { scanDirectory, apply } from '../local-vault/index.js'
const temporary = await mkdtemp(join(tmpdir(), 'dsh-vault-test-'))
try {
  const root = join(temporary, 'plugins with spaces')
  const profile = join(temporary, 'profile')
  await mkdir(root)
  async function bundle(path, name, patch = './cordis.patch.yml') {
    await mkdir(path, { recursive: true })
    await writeFile(join(path, 'package.json'), JSON.stringify({ name, version: '1.0.0', dsh: { bundle: { patch } } }))
    await writeFile(join(path, 'cordis.patch.yml'), '- insert: []')
  }
  await bundle(join(root, 'new'), '@local/new')
  await bundle(join(root, 'old'), '@local/old')
  await bundle(join(root, 'duplicate-a'), '@local/duplicate')
  await bundle(join(root, 'duplicate-b'), '@local/duplicate')
  await bundle(join(root, '@scope', 'nested'), '@local/nested')
  await bundle(join(root, 'node_modules', 'ignored'), '@local/ignored')
  await bundle(join(root, 'escape'), '@local/escape', '../../outside.yml')
  await writeFile(join(temporary, 'outside.yml'), '- insert: []')
  await mkdir(join(root, 'bad-json'))
  await writeFile(join(root, 'bad-json', 'package.json'), '{')
  const external = join(temporary, 'external')
  await bundle(external, '@local/external')
  try { await symlink(external, join(root, 'link'), process.platform === 'win32' ? 'junction' : 'dir') }
  catch (error) { if (error.code !== 'EPERM') throw error; console.log('SKIP: sandbox does not permit directory junctions') }
  let existing = [{ name: '@local/old', installed: true, enabled: false }]
  const first = await scanDirectory(root, existing)
  assert.equal(first.candidates.length, 5)
  assert.equal(first.candidates.find(item => item.name === '@local/old').status, 'installed')
  assert(first.candidates.filter(item => item.name === '@local/duplicate').every(item => item.status === 'conflict'))
  assert(first.warnings.some(item => item.path.endsWith('escape')))
  assert(first.warnings.some(item => item.path.endsWith('bad-json')))
  await assert.rejects(scanDirectory('relative/path'))
  assert.equal((await scanDirectory(join(root, 'new'))).candidates.length, 1)
  const routes = new Map()
  let disposeCount = 0
  const installs = []
  let waitForInstall
  apply({ profileContext: { dir: profile }, effect(fn) { this.dispose = fn() },
    connection: { fetch: { register(route) { routes.set(route.path, route.fetch); return () => { disposeCount++ } } } },
    pluginManager: { removeBundle: async name => { assert.equal(name, '@local/old'); return { application: 'applied' } }, listBundles: async () => existing, installBundle: async (path, options) => {
      installs.push({ path, options }); if (waitForInstall) await waitForInstall
      existing = [...existing, { name: '@local/new', installed: true }]
      return { changed: true, application: 'restart-required' }
    } },
  })
  const call = async (endpoint, payload = {}) => {
    const response = await routes.get('/api/local-vault/' + endpoint)(new Request('http://localhost/api/local-vault/' + endpoint, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'client-request', rpcId: 'test', method: 'local-vault/' + endpoint, payload }),
    }))
    return (await response.json()).result
  }
  assert.equal((await call('settings')).value.directory, '')
  assert.equal((await call('save', { directory: root })).ok, true)
  assert.equal(JSON.parse(await readFile(join(profile, 'local-vault.json'), 'utf8')).directory, first.directory)
  assert.equal((await call('install', { path: external })).ok, false)
  assert.equal((await call('install', { path: join(root, 'duplicate-a') })).ok, false)
  assert.equal((await call('install', { path: join(root, 'old') })).value.skipped, true)
  assert.equal(installs.length, 0)
  let release
  waitForInstall = new Promise(resolve => { release = resolve })
  const installing = call('install', { path: join(root, 'new') })
  // Wait until the installation mock is entered.
  while (!installs.length) await new Promise(resolve => setTimeout(resolve, 5))
  assert.equal((await call('save', { directory: root })).ok, false)
  release()
  assert.equal((await installing).value.application, 'restart-required')
  assert.deepEqual(installs[0], { path: join(root, 'new'), options: { enabled: true } })
  assert.equal((await call('install', { path: join(root, 'new') })).value.skipped, true)
  assert.equal(installs.length, 1)
  existing = [{ name: '@local/old', installed: true, enabled: false, removable: true, source: 'link:' + join(temporary, 'deleted-source') }]
  assert.equal((await scanDirectory(root, existing)).candidates.find(item => item.name === '@local/old').status, 'repair')
  existing[0].source = 'file:' + join(root, 'old')
  assert.equal((await scanDirectory(root, existing)).candidates.find(item => item.name === '@local/old').status, 'installed')
  existing[0].source = 'link:' + join(temporary, 'deleted-source')
  waitForInstall = null
  assert.equal((await call('install', { path: join(root, 'old') })).ok, true)
  assert.deepEqual(installs.at(-1), { path: join(root, 'old'), options: { enabled: false } })
  await writeFile(join(profile, 'local-vault.json'), JSON.stringify({ directory: join(temporary, 'gone') }))
  const unavailable = await call('scan')
  assert.equal(unavailable.ok, true)
  assert.equal(unavailable.value.warnings.length, 1)
  console.log('VAULT HOST OK: discovery, scoped folders, validation, symlink exclusion, duplicate names, persisted directory, owner access, stale paths, skip installed, install lock')
} finally {
  const prefix = join(tmpdir(), 'dsh-vault-test-')
  assert(temporary.startsWith(prefix) && temporary.length > prefix.length)
  await rm(temporary, { recursive: true, force: true })
}
