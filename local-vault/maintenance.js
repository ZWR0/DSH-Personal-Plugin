/** Owner-only IPC bridge to the optional external Host supervisor. */
import { randomUUID } from 'node:crypto'

export const patchCatalog = {
  'patches/dsh-persistent-web-token.patch': { title: '远行之钥 · 固定登录', plugin: '@local/dsh-remote-access', fallback: '保留插件包与地址设置；固定 Token、二维码登录不可用。旧登录 Cookie 失效，需从启动终端重新登录。凭据文件将私下备份。' },
  'patches/dsh-compaction-token-budget.patch': { title: '文脉护航 · 压缩预算', plugin: '@local/dsh-context-guard', fallback: '保留请求前预算检查与一次历史压缩补救；额外预留量和摘要输出限制恢复官方预设。' },
}

export function maintenanceBridge(ctx, proc = process) {
  const nonce = proc.env.DSH_MANAGED_NONCE
  const exit = ctx.get?.('appExit')
  const supported = Boolean(nonce && proc.connected && typeof proc.send === 'function' && typeof exit === 'function')
  let stopping = false
  const requests = new Map()
  const listener = message => {
    if (message?.type !== 'vault-maintenance-result' || message.nonce !== nonce) return
    const pending = requests.get(message.id)
    if (!pending) return
    requests.delete(message.id); clearTimeout(pending.timer)
    if (message.error) pending.reject(new Error(message.error))
    else pending.resolve(message.value)
  }
  if (supported) ctx.effect(() => {
    proc.on('message', listener)
    return () => {
      proc.off('message', listener)
      for (const pending of requests.values()) { clearTimeout(pending.timer); pending.reject(new Error('Host is shutting down')) }
      requests.clear()
    }
  }, 'local-vault: maintenance IPC')
  const request = (action, patch) => new Promise((resolve, reject) => {
    const id = randomUUID()
    const timer = setTimeout(() => { requests.delete(id); reject(new Error('Maintenance supervisor timed out')) }, 15000)
    requests.set(id, { resolve, reject, timer })
    proc.send({ type: 'vault-maintenance', nonce, id, action, patch }, error => {
      if (!error) return
      const pending = requests.get(id)
      if (pending) { requests.delete(id); clearTimeout(timer); reject(error) }
    })
  })
  return {
    async status() {
      if (!supported) return { managed: false, patches: Object.entries(patchCatalog).map(([file, entry]) => ({ file, ...entry, state: 'unmanaged', removable: false })), message: '请使用 tools/managed-host.mjs 启动原 profile 后管理宿主补丁。普通启动不允许页面修改宿主源码。' }
      return request('status')
    },
    async remove(patch) {
      if (!supported) throw new Error('当前 Host 未由受管启动器启动')
      if (stopping) throw new Error('正在停机维护')
      const agents = ctx.get?.('agents')
      if (!agents || typeof agents.list !== 'function') throw new Error('无法确认运行中会话，禁止停机')
      if (agents.list().some(agent => agent.status !== 'idle')) throw new Error('请先停止所有运行或收尾中的任务')
      stopping = true
      try {
        const result = await request('remove', patch)
        // Supervisor has checked the plan; block new turns before acknowledging shutdown.
        ctx.on('agent/pre-step', () => { throw new Error('宿主正在停机维护，请等待重启') }, { prepend: true })
        setTimeout(() => exit(0), 500)
        return result
      } catch (error) { stopping = false; throw error }
    },
  }
}
