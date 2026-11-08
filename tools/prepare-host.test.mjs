import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { inspectHost, applyHost } from './prepare-host.mjs'

const repository = dirname(dirname(fileURLToPath(import.meta.url)))
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'dsh host 测试 '))
  const patchesRoot = join(repository, 'tools/.test-tmp')
  mkdirSync(patchesRoot, { recursive: true })
  const patchDir = mkdtempSync(join(patchesRoot, 'prepare-'))
  t.after(() => { rmSync(root, { recursive: true, force: true }); rmSync(patchDir, { recursive: true, force: true }) })
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  git('init', '-q')
  git('config', 'core.autocrlf', 'false')
  writeFileSync(join(root, 'host.txt'), 'base\n')
  git('add', 'host.txt')
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'base')
  writeFileSync(join(root, 'host.txt'), 'patched\n')
  const patch = execFileSync('git', ['diff', '--binary'], { cwd: root, encoding: 'utf8' })
  git('checkout', '--', 'host.txt')
  const file = join(patchDir, 'fixture.patch')
  writeFileSync(file, patch)
  const contract = { host: { commit: git('rev-parse', 'HEAD') }, patches: [{ file: relative(repository, file), sha256: createHash('sha256').update(patch).digest('hex') }] }
  return { root, git, file, contract }
}

test('checks without mutation; applies once; recognizes applied patch', t => {
  const f = fixture(t)
  let state = inspectHost(f.root, f.contract)
  assert.equal(state.patches[0].state, 'pending')
  assert.equal(readFileSync(join(f.root, 'host.txt'), 'utf8'), 'base\n')
  applyHost(f.root, state)
  state = inspectHost(f.root, f.contract)
  assert.equal(state.patches[0].state, 'applied')
  applyHost(f.root, state)
  assert.equal(readFileSync(join(f.root, 'host.txt'), 'utf8'), 'patched\n')
})
test('rejects unsupported revision and corrupted patch', t => {
  const f = fixture(t)
  assert.throws(() => inspectHost(f.root, { ...f.contract, host: { commit: '0'.repeat(40) } }), /unsupported/)
  writeFileSync(f.file, 'corrupt')
  assert.throws(() => inspectHost(f.root, f.contract), /hash mismatch/)
})
test('preserves unrelated local files and refuses mutation', t => {
  const f = fixture(t)
  writeFileSync(join(f.root, 'personal.yaml'), 'personal: true\n')
  assert.throws(() => applyHost(f.root, inspectHost(f.root, f.contract)), /Unrelated local changes/)
  assert.equal(readFileSync(join(f.root, 'host.txt'), 'utf8'), 'base\n')
  assert.equal(readFileSync(join(f.root, 'personal.yaml'), 'utf8'), 'personal: true\n')
})
test('refuses conflicting managed files', t => {
  const f = fixture(t)
  writeFileSync(join(f.root, 'host.txt'), 'personal change\n')
  assert.throws(() => inspectHost(f.root, f.contract), /conflict or partial/)
})
