/** Host discovery for the vault. Installation stays owned by PluginManager. */
import { readFile, readdir, stat, realpath, mkdir, writeFile, rename } from 'node:fs/promises'
import { resolve, join, relative, isAbsolute } from 'node:path'
import { randomUUID } from 'node:crypto'

// Exact Fetch routes share Connection's authenticated /api carrier.
export const inject = ['connection', 'pluginManager', 'profileContext']
const ROUTE = '/api/local-vault/'
const ENDPOINTS = ['settings', 'scan', 'save', 'install']
const IGNORED = new Set(['node_modules', '.git', '.dsh', '.codex', '.agents', 'dist', 'build'])
const inside = (root, path) => { const value = relative(root, path); return value === '' || (!value.startsWith('..') && !isAbsolute(value)) }
const message = error => error instanceof Error ? error.message : String(error)

/** Root plus two directory levels; never follow directory symlinks/junctions. */
export async function scanDirectory(directory, bundles = []) {
  if (typeof directory !== 'string' || !isAbsolute(directory.trim())) throw new Error('请输入 dsh 所在设备上的绝对目录路径')
  const root = await realpath(directory.trim())
  if (!(await stat(root)).isDirectory()) throw new Error('指定路径不是目录')
  const found = []
  const warnings = []
  let visited = 0
  async function walk(path, depth) {
    if (++visited > 500) throw new Error('目录过大：最多扫描 500 个目录，请选择更具体的插件目录')
    let manifest
    try {
      const file = join(path, 'package.json')
      if ((await stat(file)).size > 1024 * 1024) throw new Error('package.json 超过 1 MB')
      manifest = JSON.parse(await readFile(file, 'utf8'))
    } catch (error) {
      if (error.code !== 'ENOENT') warnings.push({ path, message: message(error) })
    }
    if (manifest?.dsh?.bundle) {
      const name = manifest.name
      const patch = manifest.dsh.bundle.patch
      try {
        if (typeof name !== 'string' || !/^(?:@[a-z0-9._~-]+\/)?[a-z0-9._~-]+$/.test(name)) throw new Error('无效的插件包名')
        if (typeof patch !== 'string' || !patch || isAbsolute(patch)) throw new Error('dsh.bundle.patch 必须是包内相对路径')
        const canonical = await realpath(path)
        const patchPath = await realpath(resolve(path, patch))
        if (!inside(root, canonical) || !inside(canonical, patchPath) || !(await stat(patchPath)).isFile()) throw new Error('插件 patch 必须是包内文件')
        found.push({ name, version: typeof manifest.version === 'string' ? manifest.version : '', path: canonical })
      } catch (error) { warnings.push({ path, message: message(error) }) }
      return
    }
    if (depth === 2) return
    let entries
    try { entries = await readdir(path, { withFileTypes: true }) }
    catch (error) { warnings.push({ path, message: message(error) }); return }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory() && !entry.isSymbolicLink() && !IGNORED.has(entry.name) && !entry.name.startsWith('.')) {
        await walk(join(path, entry.name), depth + 1)
      }
    }
  }
  await walk(root, 0)
  const counts = new Map()
  for (const item of found) counts.set(item.name, (counts.get(item.name) || 0) + 1)
  return { directory: root, warnings, candidates: found.map(item => {
    const existing = bundles.find(bundle => bundle.name === item.name && (bundle.installed || bundle.official || bundle.availability === 'installation'))
    return { ...item, status: counts.get(item.name) > 1 ? 'conflict' : existing ? 'installed' : 'ready' }
  }) }
}

export function apply(ctx) {
  const settingsFile = join(ctx.profileContext.dir, 'local-vault.json')
  let locked = false
  async function settings() {
    try {
      const value = JSON.parse(await readFile(settingsFile, 'utf8'))
      return { directory: typeof value.directory === 'string' ? value.directory : '' }
    } catch (error) {
      if (error.code === 'ENOENT') return { directory: '' }
      throw new Error('读取行囊目录配置失败：' + message(error))
    }
  }
  const scan = async directory => scanDirectory(directory, await ctx.pluginManager.listBundles())
  async function handle(endpoint, payload, signal) {
    try {
      if (endpoint === 'settings') return { ok: true, value: await settings() }
      if (endpoint === 'scan') {
        const { directory } = await settings()
        return { ok: true, value: directory ? await scan(directory) : { directory: '', candidates: [], warnings: [] } }
      }
      if (endpoint !== 'save' && endpoint !== 'install') throw new Error('未知的行囊操作')
      if (locked) throw new Error('正在处理其他行囊操作，请稍后再试')
      locked = true
      try {
        signal?.throwIfAborted()
        if (endpoint === 'save') {
          const result = await scan(payload?.directory)
          await mkdir(ctx.profileContext.dir, { recursive: true })
          const temporary = settingsFile + '.' + randomUUID() + '.tmp'
          await writeFile(temporary, JSON.stringify({ version: 1, directory: result.directory }, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' })
          await rename(temporary, settingsFile)
          return { ok: true, value: result }
        }
        const { directory } = await settings()
        if (!directory) throw new Error('请先保存插件目录')
        // Re-scan at the mutation boundary: stale client paths are never accepted.
        const result = await scan(directory)
        const item = result.candidates.find(candidate => candidate.path === payload?.path)
        if (!item) throw new Error('插件已不在保存的目录中，请重新扫描')
        if (item.status === 'conflict') throw new Error('同名插件存在多个目录，请先解决冲突')
        if (item.status === 'installed') return { ok: true, value: { skipped: true, application: 'applied' } }
        signal?.throwIfAborted()
        const installed = await ctx.pluginManager.installBundle(item.path, { enabled: true })
        return { ok: true, value: installed }
      } finally { locked = false }
    } catch (error) {
      return { ok: false, error: { code: 'local-vault/operation-failed', message: message(error), details: {} } }
    }
  }
  for (const endpoint of ENDPOINTS) {
    ctx.effect(() => ctx.connection.fetch.register({
      path: ROUTE + endpoint, methods: ['POST'], requestBody: 'buffered',
      // Connection admits only owner Peers to exact routes and handles auth,
      // request caps and transport; this adapter supplies the RPC envelope.
      fetch: async request => {
        let body
        try { body = await request.json() }
        catch { return new Response('Invalid JSON', { status: 400 }) }
        if (!body || body.type !== 'client-request' || typeof body.rpcId !== 'string'
          || body.method !== 'local-vault/' + endpoint) return new Response('Invalid RPC envelope', { status: 400 })
        const result = await handle(endpoint, body.payload, request.signal)
        return Response.json({ type: 'server-response', rpcId: body.rpcId, result })
      },
    }), 'local-vault: ' + endpoint + ' authenticated route')
  }
}
