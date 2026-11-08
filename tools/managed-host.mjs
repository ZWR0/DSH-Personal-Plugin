/** External owner of a DSH profile's stop, patch removal, rebuild and restart. */
import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFile, writeFile, mkdir, open, unlink, copyFile, chmod } from 'node:fs/promises'
import { resolve, join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectHost, manifest } from './prepare-host.mjs'
import { patchCatalog as descriptions } from '../local-vault/maintenance.js'
import { downgradeBrowserAuth } from './browser-auth-downgrade.mjs'


/** No forced merge or source replacement: an exact reverse check must succeed. */
export function removalPlan(root, patchFile) {
  const entry = manifest.patches.find(patch => patch.file === patchFile)
  if (!entry) throw new Error('Unknown managed patch')
  // New upstream revisions are inspected honestly; reverse applicability decides removal.
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) throw new Error('Cannot read Host revision')
  const state = inspectHost(root, { ...manifest, host: { ...manifest.host, commit: result.stdout.trim() } })
  if (state.unrelated.length) throw new Error('存在补丁范围以外的本地源码修改，请先保存或使用干净目录：' + state.unrelated.slice(0, 8).join(', '))
  const patch = state.patches.find(item => item.file === patchFile)
  if (patch.state !== 'applied') throw new Error('补丁未完整应用，不能自动撤销；请人工适配冲突')
  return { ...state, selected: patch }
}

/** Testable sequencing: after shutdown, recheck, back up, remove, rebuild, restart. */
export async function performRemoval(operations) {
  await operations.stopped()
  await operations.preflight()
  await operations.backup()
  await operations.remove()
  try { await operations.build(); await operations.prepareRestart?.() }
  catch (error) {
    await operations.restore()
    await operations.build()
    await operations.restart({ rolledBack: true, error: error.message })
    return { rolledBack: true }
  }
  await operations.restart({ rolledBack: false })
  return { rolledBack: false }
}

function command(program, args, root) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(program, args, { cwd: root, stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', code => code === 0 ? resolvePromise() : reject(new Error(`${program} exited ${code}`)))
  })
}

async function main() {
  const args = process.argv.slice(2)
  const separator = args.indexOf('--')
  const options = separator === -1 ? args : args.slice(0, separator)
  const profileArgs = separator === -1 ? [] : args.slice(separator + 1)
  let root, home, profile = 'web'
  for (let i = 0; i < options.length; i++) {
    const key = options[i], value = options[++i]
    if (!value || value.startsWith('--')) throw new Error('Expected value after ' + key)
    if (key === '--host') root = resolve(value)
    else if (key === '--home') home = resolve(value)
    else if (key === '--profile' && /^[a-zA-Z0-9_-]+$/.test(value)) profile = value
    else throw new Error('Usage: node tools/managed-host.mjs --host <source> --home <existing DSH_HOME> [--profile web] -- [web args]')
  }
  if (!root || !home) throw new Error('--host and --home are required; use the original DSH_HOME')
  const profileFile = join(home, 'profiles', profile, 'package.json')
  await readFile(profileFile) // Never create a new empty profile by accident.
  const stateDir = join(home, 'host-maintenance')
  await mkdir(stateDir, { recursive: true, mode: 0o700 })
  const lockPath = join(stateDir, 'supervisor.lock')
  const lock = await open(lockPath, 'wx', 0o600)
  await lock.writeFile(String(process.pid))
  const statePath = join(stateDir, 'state.json')
  let child, stopped, transaction = false, closing = false
  let state = { phase: 'starting', message: '' }
  try { state = JSON.parse(await readFile(statePath, 'utf8')) } catch { /* first launch */ }
  const publish = async (phase, message = '') => {
    state = { phase, message, updatedAt: new Date().toISOString() }
    await writeFile(statePath, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 })
    console.log('[maintenance] ' + phase + (message ? ': ' + message : ''))
  }
  const build = async () => {
    await publish('building')
    for (const name of ['build:artifacts', 'build:check']) {
      if (process.platform === 'win32') await command(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'pnpm run ' + name], root)
      else await command('pnpm', ['run', name], root)
    }
  }
  const status = () => {
    try {
      const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout?.trim()
      const inspection = inspectHost(root, { ...manifest, host: { ...manifest.host, commit: revision } })
      return { managed: true, revision, supported: revision === manifest.host.commit, job: state, patches: inspection.patches.map(patch => ({
        file: patch.file, ...descriptions[patch.file], state: patch.state,
        removable: !transaction && !inspection.unrelated.length && patch.state === 'applied',
      })), message: inspection.unrelated.length ? '存在其他源码修改，禁止自动撤销。' : '' }
    } catch (error) {
      return { managed: true, job: state, patches: manifest.patches.map(patch => ({ file: patch.file, ...descriptions[patch.file], state: 'conflict', removable: false })), message: error.message }
    }
  }
  const launch = () => {
    const nonce = randomUUID()
    child = spawn(process.execPath, ['--import', 'tsx/esm', 'apps/cli/src/bin.ts', '--profile', profile, ...profileArgs], {
      cwd: root, env: { ...process.env, DSH_HOME: home, DSH_MANAGED_NONCE: nonce }, stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    })
    stopped = new Promise(resolvePromise => {
      child.once('exit', (code, signal) => resolvePromise({ code, signal }))
      child.once('error', () => resolvePromise({ code: null }))
    })
    child.once('error', error => { void publish('failed', error.message) })
    const launched = child
    child.on('message', message => {
      if (message?.nonce !== nonce || message.type !== 'vault-maintenance' || child !== launched) return
      const reply = (value, error) => { if (launched.connected) launched.send({ type: 'vault-maintenance-result', nonce, id: message.id, value, error }) }
      if (message.action === 'status') { reply(status()); return }
      if (message.action !== 'remove' || transaction || closing) { reply(undefined, 'Maintenance busy or invalid operation'); return }
      let plan
      try { plan = removalPlan(root, message.patch) }
      catch (error) { reply(undefined, error.message); return }
      if (message.patch === 'patches/dsh-persistent-web-token.patch' && !/^[a-f0-9]{64}$/.test(message.credentialDigest || '')) {
        reply(undefined, '需要新版行囊宝匣提供浏览器凭据迁移检查'); return
      }
      transaction = true
      const shutdown = stopped
      reply({ accepted: true, message: '正在停止宿主、备份、撤销、重建并重启。连接将暂时断开；失败详情见受管启动终端。' })
      void (async () => {
        await publish('stopping')
        let timeout
        try {
          await performRemoval({
            stopped: async () => {
              const result = await Promise.race([shutdown, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Graceful shutdown timed out; no files changed')), 30000) })])
              clearTimeout(timeout)
              if (result.code !== 0) throw new Error('Host did not shut down cleanly; no files changed')
            },
            preflight: async () => { plan = removalPlan(root, message.patch) },
            backup: async () => {
              await publish('backing-up')
              const destination = join(stateDir, 'backups', new Date().toISOString().replaceAll(':', '-') + '-' + randomUUID())
              await mkdir(destination, { recursive: true, mode: 0o700 })
              await copyFile(plan.selected.path, join(destination, 'removed.patch'))
              try {
                await copyFile(join(home, '.credentials.yaml'), join(destination, '.credentials.yaml'))
                await chmod(join(destination, '.credentials.yaml'), 0o600)
              }
              catch (error) { if (error.code !== 'ENOENT') throw error }
              const patchText = await readFile(plan.selected.path, 'utf8')
              for (const match of patchText.matchAll(/^\+\+\+ b\/(.+)$/gm)) {
                const file = match[1].trim()
                const target = join(destination, 'source', file)
                await mkdir(dirname(target), { recursive: true, mode: 0o700 })
                await copyFile(join(root, file), target)
              }
              await writeFile(join(destination, 'metadata.json'), JSON.stringify({ revision: plan.revision, patch: message.patch }), { mode: 0o600 })
            },
            remove: async () => {
              await publish('removing')
              await command('git', ['apply', '--reverse', '--check', plan.selected.path], root)
              await command('git', ['apply', '--reverse', plan.selected.path], root)
            },
            build,
            prepareRestart: async () => {
              if (message.patch === 'patches/dsh-persistent-web-token.patch') {
                await publish('migrating-auth', '已备份；仅迁移浏览器登录记录，旧登录将失效。')
                await downgradeBrowserAuth(root, home, message.credentialDigest)
              }
            },
            restore: async () => {
              await publish('rolling-back', '撤销后构建失败，恢复补丁并重建；不恢复或覆盖凭据。')
              await command('git', ['apply', '--check', plan.selected.path], root)
              await command('git', ['apply', plan.selected.path], root)
            },
            restart: async result => {
              if (closing) return
              await publish(result.rolledBack ? 'restarted-with-patch' : 'restarted-without-patch', result.rolledBack ? result.error : '补丁已撤销，插件包和个人设置保留。请等待 Host 启动并刷新页面。')
              launch()
            },
          })
        } catch (error) { await publish('failed', error.message) }
        finally { clearTimeout(timeout); transaction = false }
      })()
    })
    return stopped
  }
  const cleanup = async () => { await lock.close(); await unlink(lockPath).catch(() => {}) }
  // Ctrl+C also reaches the inherited terminal child. Leave its native shutdown intact.
  process.on('SIGINT', () => { closing = true })
  try {
    await publish('running', '受管启动已启用；页面操作只接受当前子进程的认证 owner 请求。')
    let current = launch()
    while (true) {
      const result = await current
      // The transaction owns the old exit until it either starts a new child or fails.
      while (transaction) await new Promise(resolvePromise => setTimeout(resolvePromise, 100))
      if (current === stopped || closing) {
        if (!closing && !['failed', 'restarted-without-patch', 'restarted-with-patch'].includes(state.phase)) {
          await publish(result.code === 0 ? 'stopped' : 'failed', 'Host exited: ' + String(result.code ?? result.signal))
        }
        break
      }
      current = stopped
    }
  } finally { await cleanup() }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
