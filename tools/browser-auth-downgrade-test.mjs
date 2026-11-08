/** Synthetic credentials only; never opens a user's credential store. */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { harnessRoot } from './test-environment.mjs'
import { downgradeDocument } from './browser-auth-downgrade.mjs'
import { recordDigest } from '../local-vault/maintenance.js'
const yaml = createRequire(join(harnessRoot, 'packages/credentials/credentials-local/package.json'))('yaml')
const record = { kind: 'grant', payload: { version: 2, secret: Buffer.alloc(32, 1).toString('base64url'), epoch: 3, launchToken: 'fixture-token-'.repeat(4), rotatedAt: 1 } }
const source = '# fixture comment\n' + yaml.stringify({ version: 1, refs: { MODEL_KEY: 'fixture-model-key' }, records: {
  'client-connection/browser-session': record, 'another/provider': { kind: 'api-key', key: 'fixture-provider-key' },
} })
const updated = downgradeDocument(source, yaml, recordDigest(record))
const parsed = yaml.parse(updated)
const migrated = parsed.records['client-connection/browser-session']
assert.equal(migrated.payload.version, 1)
assert.equal(Buffer.from(migrated.payload.secret, 'base64url').length, 32)
assert.notEqual(migrated.payload.secret, record.payload.secret)
assert.equal(migrated.payload.launchToken, undefined)
assert.deepEqual(parsed.refs, yaml.parse(source).refs)
assert.deepEqual(parsed.records['another/provider'], yaml.parse(source).records['another/provider'])
assert(updated.startsWith('# fixture comment'))
assert.throws(() => downgradeDocument(source, yaml, recordDigest(null)), /changed since/)
assert.throws(() => downgradeDocument('version: 99\n', yaml, recordDigest(null)), /Unsupported/)
assert.equal(downgradeDocument(updated, yaml, recordDigest(migrated)), updated)
const { BrowserAuth } = await import(pathToFileURL(join(harnessRoot, 'packages/client/connection/lib/types/browser-auth.js')).href)
let current = migrated
await BrowserAuth.create({}, {
  readRecord: async () => current,
  modifyRecord: async (_, mutate) => current = await mutate(current) ?? current,
}, 7)
console.log('AUTH DOWNGRADE OK: single-record migration, fresh key, preserved model credentials/comments, mismatch rejection, idempotence and BrowserAuth startup')
