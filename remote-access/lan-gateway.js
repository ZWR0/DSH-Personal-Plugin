import { readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs'
import { createHash, randomBytes } from 'node:crypto'
import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { createServer as createHttpServer, request } from 'node:http'
import { createServer } from 'node:https'
import { networkInterfaces } from 'node:os'

const exec = promisify(execFile)
const tailscale = process.platform === 'win32'
  ? join(process.env.ProgramFiles || 'C:/Program Files', 'Tailscale', 'tailscale.exe')
  : 'tailscale'
const servePort = 8443

async function tailscaleCommand(args) {
  try {
    return (await exec(tailscale, args, { windowsHide: true, timeout: 5000 })).stdout
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error('请先安装并登录 Tailscale')
    if (/access is denied|permission denied/i.test(error.stderr || '')) {
      throw new Error('Windows 拒绝配置 Tailscale Serve。请以管理员身份重新打开 DSH。')
    }
    throw new Error('无法读取 Tailscale 状态，请确认 Tailscale 已连接。')
  }
}

// Serve started without --bg keeps its routes under the CLI session.
export function serveConfigs(config) {
  return config ? [config, ...Object.values(config.Foreground ?? {}).flatMap(serveConfigs)] : []
}

const secret = () => randomBytes(24).toString('base64url')
const digest = token => createHash('sha256').update(token).digest('hex')
const deviceLifetime = 30 * 24 * 60 * 60
const pairingPath = '/__remote_access_pair'
const MAX_DEVICES = 16
const deviceCookie = '__Host-dsh_remote_device'
const privateIp = /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/

export function lanAddresses() {
  return [...new Set(Object.values(networkInterfaces()).flat().filter(entry =>
    entry?.family === 'IPv4' && !entry.internal && privateIp.test(entry.address)).map(entry => entry.address))]
}

export function createLanGateway(connection, getOrigin, stateFile) {
  let saved = { devices: [] }
  let startupError
  let invalidState = false
  if (stateFile) {
    try {
      const value = JSON.parse(readFileSync(stateFile, 'utf8'))
      if (value.version !== 1 || !Array.isArray(value.devices)
        || value.devices.length > MAX_DEVICES
        || value.devices.some(device => !Number.isSafeInteger(device?.id)
          || typeof device.origin !== 'string' || !/^[a-f0-9]{64}$/.test(device.hash)
          || !Number.isSafeInteger(device.expires))
        || (value.nextDeviceId !== undefined && (!Number.isSafeInteger(value.nextDeviceId)
          || value.nextDeviceId <= Math.max(0, ...value.devices.map(device => device.id))))
        || (value.resume && !['lan', 'tailscale'].includes(value.resume.mode))) {
        throw new Error('Invalid state')
      }
      saved = value
    } catch (error) {
      if (error.code !== 'ENOENT') { invalidState = true; startupError = '无法读取配对记录，请检查插件配置文件。' }
    }
  }

  function persist(next) {
    if (invalidState) throw new Error(startupError)
    if (stateFile) {
      const temporary = stateFile + '.' + secret() + '.tmp'
      try {
        writeFileSync(temporary, JSON.stringify({ ...next, version: 1 }), { flag: 'wx', mode: 0o600 })
        renameSync(temporary, stateFile)
      } finally { rmSync(temporary, { force: true }) }
    }
    saved = { ...next, version: 1 }
  }

  let active
  let starting = false
  let generation = 0

  function stop() {
    generation++
    if (!active) return
    const { server, sockets, tunnel } = active
    active = undefined
    tunnel?.kill()
    server.close()
    for (const socket of sockets) socket.destroy()
  }

  function status() {
    const pair = active?.pair
    return {
      addresses: lanAddresses(),
      address: active?.ready ? active.origin : undefined,
      mode: active?.mode,
      startupError,
      connected: [...(active?.devices.values() ?? [])].some(device => device.expires > Date.now()),
      devices: saved.devices.filter(device => device.expires > Date.now()).map(({ id }) => ({ id })),
      pendingId: pair?.claim && !pair.approved && pair.expires > Date.now() ? pair.id : undefined,
      pending: Boolean(pair?.claim && !pair.approved && pair.expires > Date.now()),
    }
  }

  async function start(address, mode = 'lan') {
    if (invalidState) throw new Error(startupError)
    if (active?.mode === mode && (mode === 'tailscale' || active.address === address)) return status()
    if (starting) throw new Error('局域网连接正在启动')
    if (mode === 'lan' && !lanAddresses().includes(address)) throw new Error('请选择本机的局域网 IPv4 地址')
    const upstream = new URL(getOrigin())
    if (upstream.protocol !== 'http:' || !['127.0.0.1', '[::1]', 'localhost'].includes(upstream.hostname) || !upstream.port) {
      throw new Error('当前 DSH 未提供可用的本机 HTTP 监听地址')
    }
    stop()
    const attempt = generation
    starting = true
    try {
      let tls
      let tailnetOrigin
      if (mode === 'tailscale') {
        const info = JSON.parse(await tailscaleCommand(['status', '--json']))
        const dns = info.Self?.DNSName?.replace(/\.$/, '')
        if (info.BackendState !== 'Running' || !/^[a-z0-9.-]+\.ts\.net$/i.test(dns ?? '')) {
          throw new Error('请连接 Tailscale，并为本机启用 MagicDNS 和 HTTPS。')
        }
        tailnetOrigin = 'https://' + dns + ':' + servePort
        const config = JSON.parse(await tailscaleCommand(['serve', 'status', '--json']) || 'null')
        if (serveConfigs(config).some(entry => entry.TCP?.[servePort]
          || Object.keys(entry.Web ?? {}).some(key => key.endsWith(':' + servePort))
          || Object.entries(entry.AllowFunnel ?? {}).some(([key, enabled]) => enabled && key.endsWith(':' + servePort)))) {
          throw new Error('Tailscale 8443 已被其他服务占用，原配置已保留。')
        }
      } else {
        if (saved.lan?.address === address && saved.lan.tls && saved.lan.validUntil > Date.now()) {
          tls = saved.lan.tls
        } else {
          const { default: selfsigned } = await import('selfsigned')
          tls = await selfsigned.generate([{ name: 'commonName', value: address }], {
            algorithm: 'sha256',
            notAfterDate: new Date(Date.now() + deviceLifetime * 2000),
            extensions: [{ name: 'basicConstraints', cA: false },
              { name: 'subjectAltName', altNames: [{ type: 7, ip: address }] }],
          })
        }
      }
      if (attempt !== generation) throw new Error('启动已取消')
      const sockets = new Set()
      const gateway = { address, sockets, mode, devices: new Map() }
      const upstreamLogin = connection.authenticatedUrl(upstream.href)
      if (new URL(upstreamLogin).origin !== upstream.origin) throw new Error('DSH 启动链接与宿主地址不匹配')
      const login = await fetch(upstreamLogin, { redirect: 'manual', signal: AbortSignal.timeout(5000) })
      const cookie = login.headers.getSetCookie()[0]?.split(';')[0]
      await login.body?.cancel()
      if (login.status !== 303 || !cookie) throw new Error('DSH 宿主未接受浏览器登录')
      if (attempt !== generation) throw new Error('启动已取消')
      const handle = (req, res) => {
        res.setHeader('Cache-Control', 'no-store')
        if (!valid(req)) { res.writeHead(403).end(); return }
        const url = new URL(req.url, gateway.origin)
        if (url.pathname === pairingPath) { pairRequest(req, res, url, gateway, registerDevice); return }
        if (!authorized(req)) { res.writeHead(401, { 'content-type': 'text/plain; charset=utf-8' }).end('请从电脑上的远行之钥扫描完整配对二维码。直接打开根地址无法配对。'); return }
        if (url.pathname.startsWith('/api/remote-access/')) { res.writeHead(403).end(); return }
        const proxy = forward(req, cookie, upstream, response => {
          const headers = { ...response.headers, 'cache-control': 'no-store' }
          delete headers['set-cookie']
          res.writeHead(response.statusCode, headers)
          response.pipe(res)
        })
        proxy.on('error', () => {
          if (res.headersSent) res.destroy()
          else res.writeHead(502).end()
        })
        res.on('close', () => proxy.destroy())
        req.pipe(proxy)
      }
      const server = tls ? createServer({ key: tls.private, cert: tls.cert }, handle) : createHttpServer(handle)
      function valid(req) {
        return active === gateway && req.headers.host === new URL(gateway.origin).host
          && (!req.headers.origin || req.headers.origin === gateway.origin)
          && req.url.startsWith('/') && !req.url.startsWith('//') && !req.url.includes('\\')
      }
      function authorized(req) {
        const token = req.headers.cookie?.split(';').map(item => item.trim())
          .find(item => item.startsWith(deviceCookie + '='))?.slice(deviceCookie.length + 1)
        const device = token && gateway.devices.get(digest(token))
        if (!device || device.expires <= Date.now()) return false
        if (!device.sockets.has(req.socket)) {
          device.sockets.add(req.socket)
          req.socket.once('close', () => device.sockets.delete(req.socket))
        }
        return true
      }
      gateway.server = server
      server.on('connection', socket => {
        sockets.add(socket)
        socket.once('close', () => sockets.delete(socket))
      })
      server.on('upgrade', (req, socket, head) => {
        if (!valid(req) || req.headers.origin !== gateway.origin || !authorized(req)
          || new URL(req.url, gateway.origin).pathname.startsWith('/api/remote-access/')
          || req.headers.upgrade?.toLowerCase() !== 'websocket') { socket.destroy(); return }
        const proxy = forward(req, cookie, upstream)
        proxy.on('error', () => socket.destroy())
        proxy.on('response', response => { response.resume(); socket.destroy() })
        socket.once('close', () => proxy.destroy())
        proxy.on('upgrade', (response, peer, rest) => {
          socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
            Object.entries(response.headers).filter(([name]) => name !== 'set-cookie').map(([name, value]) => name + ': ' + value).join('\r\n') + '\r\n\r\n')
          if (head.length) peer.write(head)
          if (rest.length) socket.write(rest)
          peer.on('error', () => socket.destroy())
          socket.on('error', () => peer.destroy())
          socket.once('close', () => peer.destroy())
          peer.once('close', () => socket.destroy())
          peer.pipe(socket).pipe(peer)
        })
        proxy.end()
      })
      await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(!tailnetOrigin && saved.lan?.address === address ? saved.lan.port : 0, tailnetOrigin ? '127.0.0.1' : address, resolve)
      })
      if (attempt !== generation) { server.close(); throw new Error('启动已取消') }
      server.on('error', () => { if (active === gateway) stop() })
      gateway.origin = tailnetOrigin ?? ('https://' + address + ':' + server.address().port)
      gateway.ready = !tailnetOrigin
      active = gateway
      function rememberConnection() {
        const devices = saved.devices.filter(device => device.expires > Date.now())
        for (const device of devices.filter(device => device.origin === gateway.origin)) {
          gateway.devices.set(device.hash, { ...device, sockets: new Set() })
        }
        const lan = tls ? {
          address, port: server.address().port, tls: { private: tls.private, cert: tls.cert },
          validUntil: saved.lan?.tls?.cert === tls.cert ? saved.lan.validUntil : Date.now() + deviceLifetime * 1900,
        } : saved.lan
        persist({ ...saved, devices, lan, resume: { address, mode } })
        startupError = undefined
      }
      function registerDevice(token) {
        const devices = saved.devices.filter(device => device.expires > Date.now())
        if (devices.length >= MAX_DEVICES) throw new Error('已达到配对上限')
        const device = { id: saved.nextDeviceId ?? 1, hash: digest(token), origin: gateway.origin,
          expires: Date.now() + deviceLifetime * 1000 }
        persist({ ...saved, devices: [...devices, device], nextDeviceId: device.id + 1 })
        gateway.devices.set(device.hash, { ...device, sockets: new Set() })
      }
      if (tailnetOrigin) {
        const target = 'http://127.0.0.1:' + server.address().port
        const tunnel = spawn(tailscale, ['serve', '--yes', '--https=' + servePort, target], {
          windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
        })
        gateway.tunnel = tunnel
        let diagnostic = ''
        tunnel.stderr.on('data', chunk => { diagnostic = (diagnostic + chunk).slice(-2048) })
        tunnel.on('error', () => { if (active === gateway) stop() })
        tunnel.on('exit', () => { if (active === gateway) stop() })
        try {
          for (let count = 0; count < 15; count++) {
            await new Promise(resolve => setTimeout(resolve, 400))
            if (active !== gateway) throw new Error('Tailscale Serve 未启动。请检查本机 HTTPS 设置及权限。' + (diagnostic ? ' ' + diagnostic : ''))
            const config = JSON.parse(await tailscaleCommand(['serve', 'status', '--json']) || 'null')
            const host = new URL(tailnetOrigin).host
            const entries = serveConfigs(config)
            if (entries.some(entry => entry.AllowFunnel?.[host])) throw new Error('该入口启用了 Funnel，已关闭本次连接。')
            if (entries.some(entry => {
              const proxy = entry.Web?.[host]?.Handlers?.['/']?.Proxy
              return proxy === target || proxy === target + '/'
            })) {
              rememberConnection()
              gateway.ready = true
              return status()
            }
          }
          throw new Error('Tailscale 尚未确认 HTTPS 转发。请检查 MagicDNS 与证书设置。')
        } catch (error) {
          if (active === gateway) stop()
          throw error
        }
      }
      try { rememberConnection() } catch (error) { stop(); throw error }
      return status()
    } finally {
      starting = false
    }
  }

  return {
    start, stop, status,
    async restore() {
      if (!saved.resume || invalidState) return
      try { await start(saved.resume.address, saved.resume.mode) }
      catch (error) { startupError = error.message }
    },
    pause() {
      persist({ ...saved, resume: null })
      stop()
      startupError = undefined
      return status()
    },
    code() {
      if (!active?.ready) throw new Error('请先开启手机连接')
      if (saved.devices.filter(device => device.expires > Date.now()).length >= MAX_DEVICES) throw new Error('已达到配对上限，请先撤销一台设备')
      active.pair = { id: secret(), key: secret(), expires: Date.now() + 120000 }
      return { url: active.origin + pairingPath + '?code=' + active.pair.key }
    },
    approve(id) {
      const pair = active?.pair
      if (!pair?.claim || pair.id !== id || pair.expires <= Date.now()) throw new Error('没有待确认的配对')
      pair.approved = true
      return status()
    },
    revoke(id) {
      if (!saved.devices.some(device => device.id === id)) return status()
      persist({ ...saved, devices: saved.devices.filter(device => device.id !== id) })
      for (const [hash, device] of active?.devices ?? []) {
        if (device.id !== id) continue
        active.devices.delete(hash)
        for (const socket of device.sockets) socket.destroy()
        break
      }
      return status()
    },
  }
}

function forward(req, cookie, upstream, callback) {
  const headers = { host: upstream.host, cookie }
  for (const name of ['accept', 'accept-language', 'content-type', 'content-length',
    'upgrade', 'sec-websocket-key', 'sec-websocket-version', 'sec-websocket-protocol', 'sec-websocket-extensions']) {
    if (req.headers[name] !== undefined) headers[name] = req.headers[name]
  }
  if (headers.upgrade) headers.connection = 'Upgrade'
  if (req.headers.origin) headers.origin = upstream.origin
  return request(upstream, { method: req.method, path: req.url, headers }, callback)
}

function pairRequest(req, res, url, gateway, registerDevice) {
  const pair = gateway.pair
  if (req.method !== 'GET' || !pair || pair.expires <= Date.now()) { res.writeHead(404).end(); return }
  if (url.searchParams.get('code') === pair.key && !pair.claim) {
    pair.claim = secret()
    res.writeHead(303, {
      location: pairingPath,
      'set-cookie': '__Host-dsh_remote_claim=' + pair.claim + '; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=120',
      'referrer-policy': 'no-referrer',
    }).end()
    return
  }
  if (!pair.claim || !req.headers.cookie?.split(';').some(item => item.trim() === '__Host-dsh_remote_claim=' + pair.claim)) {
    res.writeHead(403).end(); return
  }
  if (pair.approved) {
    const token = secret()
    try { registerDevice(token) }
    catch { res.writeHead(503).end('无法保存配对，请在电脑上重试。'); return }
    gateway.pair = undefined
    res.writeHead(303, { location: '/', 'set-cookie': deviceCookie + '=' + token + '; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=' + deviceLifetime }).end()
    return
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'referrer-policy': 'no-referrer' })
    .end('<!doctype html><meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="2"><p>请在电脑上的「远行之钥」确认配对。</p>')
}
