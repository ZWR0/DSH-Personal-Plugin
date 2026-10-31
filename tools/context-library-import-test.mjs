import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { previewImport, applyImport } from '../context-library/importer.js'
import * as lib from '../context-library/library.js'

const root = await mkdtemp(join(tmpdir(), 'dsh-library-import-'))
try {
  const docs = [
    { path: 'Axiom/identity/identity.md', content: '# Axiom\nPersonal agent.' },
    { path: 'Axiom/identity/personality.md', content: '# Communication\nChinese first.' },
    { path: 'Axiom/identity/principles.md', content: '# Principles\nUse evidence.' },
    { path: 'Axiom/identity/user_profile.md', content: '# Owner\nA researcher.' },
    { path: 'Axiom/memory/long_term/preferences.md', content: '# Preferences\nConcise answers.' },
    { path: 'Axiom/memory/projects/research.md', content: '# Research\nPrivate project.' },
    { path: 'Axiom/memory/decisions/2026/database.md', content: '# Database\nPostgres.' },
    { path: 'Axiom/prompts/system.md', content: 'UNSUPPORTED RUNTIME PROTOCOL' },
    { path: 'Axiom/memory/README.md', content: 'NOT A MEMORY' },
  ]
  const plan = previewImport(root, docs)
  assert.equal(plan.items.length, 5)
  assert.equal(plan.ignored.length, 2)
  assert.match(plan.items.find(x => x.type === 'identity').body, /Use evidence/)
  assert.equal(plan.items.find(x => x.id === 'owner-profile').type, 'long_term')
  assert.ok(plan.items.filter(x => ['projects', 'decisions'].includes(x.type)).every(x => !x.enabled))
  assert.equal(lib.listEntries(root).entries.length, 0, 'preview does not save')
  const result = await applyImport(root, docs, plan.planId)
  assert.equal(result.saved.length, 5)
  assert.equal(result.failed.length, 0)
  assert.ok(lib.listEntries(root).entries.every(x => !x.error))
  await assert.rejects(applyImport(root, docs, plan.planId), /重新预览/)
  const refreshed = previewImport(root, docs)
  assert.ok(refreshed.items.every(x => x.action === 'update' && x.expectedVersion))
  const changed = docs.map(x => x.path.endsWith('/identity.md') ? { ...x, content: '# Axiom\nUpdated agent.' } : x)
  const update = previewImport(root, changed)
  assert.equal((await applyImport(root, changed, update.planId)).failed.length, 0)
  assert.match(await readFile(join(root, 'identity.md'), 'utf8'), /Updated agent/)
  assert.ok((await lib.listHistory({root, type:'identity', id:'identity'})).length > 0)
  assert.throws(() => previewImport(root, [{path:'../escape.md',content:'x'}]), /相对路径/)
  assert.throws(() => previewImport(root, [{path:'secret.md',content:'api_key=abcdefghijklmnop1234567890'}]), /凭据/)
  assert.throws(() => previewImport(root, [{path:'large.md',content:'x'.repeat(129 * 1024)}]), /128 KB/)
  assert.throws(() => previewImport(root, [docs[0],docs[0]]), /重复/)
  const generic = previewImport(root, [{path:'My notes/偏好.md',content:'# 偏好\n中文回答'}])
  assert.equal(generic.items[0].type, 'long_term')
  assert.equal(generic.items[0].enabled, true)
  console.log('IMPORT OK: classification, identity merge, nested decisions, owner separation, disabled projects, preview, version conflicts, history, traversal, credentials, limits, generic folders')
} finally {
  if (!root.startsWith(join(tmpdir(), 'dsh-library-import-'))) throw new Error('Unexpected test directory')
  await rm(root, { recursive: true, force: true })
}
