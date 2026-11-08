/** Offline, locked downgrade of only the browser-session record after private backup. */
import { createRequire } from 'node:module'
import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { recordDigest } from '../local-vault/maintenance.js'

/** Pure document transform; unrelated mappings and comments remain in the YAML AST. */
export function downgradeDocument(text, yaml, expectedDigest) {
  const document = yaml.parseDocument(text)
  if (document.errors.length) throw new Error('Cannot migrate malformed credentials YAML')
  if (document.get('version') !== 1) throw new Error('Unsupported credentials document version')
  const record = document.getIn(['records', 'client-connection/browser-session'])?.toJSON()
  if (recordDigest(record) !== expectedDigest) throw new Error('Browser credential changed since shutdown request')
  if (!record) return text
  const payload = record.payload
  if (record.kind !== 'grant' || !payload || ![1, 2].includes(payload.version)) throw new Error('Unsupported browser credential format')
  if (payload.version === 1) return text
  if (typeof payload.secret !== 'string' || Buffer.from(payload.secret, 'base64url').length !== 32
    || !Number.isSafeInteger(payload.epoch) || payload.epoch < 0
    || Object.keys(payload).some(key => !['version', 'secret', 'epoch', 'launchToken', 'rotatedAt'].includes(key))) throw new Error('Invalid browser credential format')
  // A fresh key revokes old cookies; the private backup retains the old token and state.
  document.setIn(['records', 'client-connection/browser-session', 'payload'], { version: 1, secret: randomBytes(32).toString('base64url') })
  return document.toString()
}

export async function downgradeBrowserAuth(root, home, expectedDigest) {
  if (!/^[a-f0-9]{64}$/.test(expectedDigest || '')) throw new Error('Missing runtime browser credential fingerprint')
  const require = createRequire(join(root, 'packages/credentials/credentials-local/package.json'))
  const yaml = require('yaml')
  const { withFileLock, writeFileAtomic } = await import(pathToFileURL(join(root, 'packages/util/atomic-write/lib/index.js')).href)
  const filename = join(home, '.credentials.yaml')
  return withFileLock(filename, async () => {
    let text
    try { text = await readFile(filename, 'utf8') }
    catch (error) {
      if (error.code === 'ENOENT' && expectedDigest === recordDigest(null)) return
      throw error
    }
    const updated = downgradeDocument(text, yaml, expectedDigest)
    if (updated !== text) await writeFileAtomic(filename, updated, { mode: 0o600, dirMode: 0o700 })
  })
}
