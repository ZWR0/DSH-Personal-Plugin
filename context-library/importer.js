/** Convert user-selected Markdown into reviewed library entries; never read source paths. */
import { createHash } from 'node:crypto'
import * as lib from './library.js'

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const fail = text => { throw new lib.LibraryError('import/invalid', text) }

export function previewImport(root, documents) {
  if (!Array.isArray(documents) || !documents.length || documents.length > 64) fail('每次请选择 1–64 个 Markdown 文件。')
  const axiomLayout = documents.some(doc => typeof doc?.path === 'string' && /(?:^|[\\/])(?:identity[\\/](?:identity|principles|personality)\.md|prompts[\\/]system\.md)$/i.test(doc.path))
  const seen = new Set()
  let bytes = 0
  const groups = new Map()
  const identities = new Map()
  const ignored = []
  for (const doc of documents) {
    if (!doc || typeof doc.path !== 'string' || typeof doc.content !== 'string') fail('导入文件必须包含名称和文本。')
    const path = doc.path.replaceAll('\\', '/').replace(/^\.\//, '')
    if (path.length > 500 || path.startsWith('/') || path.split('/').some(part => part === '..') || /^[a-z]:/i.test(path)) fail('导入名称必须是相对路径。')
    if (seen.has(path.toLowerCase())) fail('导入文件名称重复：' + path)
    seen.add(path.toLowerCase())
    bytes += Buffer.byteLength(doc.content, 'utf8')
    if (bytes > 768 * 1024) fail('每次导入最多 768 KB，请分批选择。')
    if (Buffer.byteLength(doc.content, 'utf8') > 128 * 1024) fail('单个文件最多 128 KB：' + path)
    const parts = path.toLowerCase().split('/')
    const name = parts.at(-1)
    if (!name.endsWith('.md') || /^(readme|_template)\.md$/.test(name)) { ignored.push(path); continue }
    const body = doc.content.replace(/^\uFEFF/, '').replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '').trim()
    if (!body) { ignored.push(path); continue }
    const identityName = ['identity.md', 'principles.md', 'personality.md'].includes(name)
    const known = identityName || ['owner.md', 'user_profile.md', 'owner-profile.md'].includes(name) || parts.includes('memory')
    // Selecting an entire Axiom directory imports personal assets, not runtime prompts or developer docs.
    if (axiomLayout && parts.length > 1 && !known && !parts.some(p => ['long_term', 'projects', 'decisions'].includes(p))) { ignored.push(path); continue }
    if (lib.findCredential(body)) fail('文件可能包含凭据，请先移除：' + path)
    if (identityName) {
      if (identities.has(name)) fail('检测到多套身份，请分批导入。')
      identities.set(name, { path, body })
      continue
    }
    const owner = ['owner.md', 'user_profile.md', 'owner-profile.md'].includes(name)
    const type = parts.includes('projects') ? 'projects' : parts.includes('decisions') ? 'decisions' : 'long_term'
    const stem = name.slice(0, -3)
    const id = owner ? 'owner-profile' : (stem.replace(/[^a-z0-9._-]/g, '-').replace(/^-+/, '').slice(0, 42) || 'note') + '-' + digest(path).slice(0, 8)
    if (groups.has(type + '/' + id)) fail('多个文件映射到同一条目，请分批导入。')
    const heading = /^#\s+(.+)$/m.exec(body)?.[1]?.trim()
    groups.set(type + '/' + id, { id, type, title: (owner ? '我的资料（Owner）' : heading || stem).slice(0, 120), body, sources: [path], enabled: type === 'long_term', scope: 'global', status: 'active', key: true })
  }
  if (identities.size) groups.set('identity/identity', {
    id: 'identity', type: 'identity', title: 'Agent 身份', scope: 'global', status: 'active', enabled: true, key: true,
    body: ['identity.md', 'principles.md', 'personality.md'].flatMap(name => identities.has(name) ? [identities.get(name).body] : []).join('\n\n'),
    sources: [...identities.values()].map(item => item.path),
  })
  const existing = lib.listEntries(root).entries
  const items = [...groups.values()].map(item => {
    if (item.body.length > lib.MAX_BODY) fail('合并后的身份过长，请精简后再导入。')
    const current = existing.find(row => row.type === item.type && row.id === item.id)
    if (current?.error) fail('目标条目格式错误，请先选择其他书库或修复：' + item.id)
    return { ...item, expectedVersion: current?.version ?? null, action: current ? 'update' : 'create' }
  })
  return { planId: digest({ root, items, ignored }), items, ignored }
}

export async function applyImport(root, documents, expectedPlanId) {
  const plan = previewImport(root, documents)
  if (plan.planId !== expectedPlanId) throw new lib.LibraryError('import/conflict', '书库已变化，请重新预览后导入。')
  const saved = []
  const failed = []
  for (const item of plan.items) {
    try {
      await lib.saveEntry({ root, ...item, createOnly: item.action === 'create', actor: 'user', reason: '用户确认 Markdown 导入' })
      saved.push({ id: item.id, type: item.type })
    } catch (error) { failed.push({ id: item.id, message: error.message }) }
  }
  return { saved, failed, ignored: plan.ignored }
}
