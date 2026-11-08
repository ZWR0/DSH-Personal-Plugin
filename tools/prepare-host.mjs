/** Reproduce the supported source deployment without changing refs or profiles. */
import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const manifest = JSON.parse(readFileSync(join(repository, 'host-compatibility.json'), 'utf8'))

function execute(command, args, cwd, capture = false) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})${capture ? ': ' + result.stderr.trim() : ''}`)
  return capture ? result.stdout.trim() : ''
}

/** Inspect patch hashes, exact source revision, and forward/reverse applicability. */
export function inspectHost(root, contract = manifest) {
  const git = args => execute('git', args, root, true)
  const revision = git(['rev-parse', 'HEAD'])
  if (revision !== contract.host.commit) throw new Error(`DSH revision ${revision} is unsupported; required ${contract.host.commit}. No checkout or reset was performed.`)
  const allowed = new Set()
  const patches = contract.patches.map(entry => {
    const path = resolve(repository, entry.file)
    if (!path.startsWith(repository + '/') && !path.startsWith(repository + '\\')) throw new Error('Patch escapes repository')
    const content = readFileSync(path)
    if (createHash('sha256').update(content).digest('hex') !== entry.sha256) throw new Error(`Patch hash mismatch: ${entry.file}`)
    for (const match of content.toString('utf8').matchAll(/^\+\+\+ b\/(.+)$/gm)) allowed.add(match[1].trim())
    const check = reverse => spawnSync('git', ['apply', '--check', ...(reverse ? ['--reverse'] : []), path], { cwd: root, encoding: 'utf8' })
    const reverse = check(true)
    if (reverse.error) throw reverse.error
    if (reverse.status === 0) return { ...entry, path, state: 'applied' }
    const forward = check(false)
    if (forward.error) throw forward.error
    if (forward.status !== 0) throw new Error(`Patch conflict or partial application: ${entry.file}\n${forward.stderr.trim()}`)
    return { ...entry, path, state: 'pending' }
  })
  // Include untracked files: otherwise an unrelated local source could silently enter a build.
  const tracked = git(['diff', '--name-only', 'HEAD', '-z']).split('\0').filter(Boolean)
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)
  const pluginRelative = repository.startsWith(resolve(root) + '/') || repository.startsWith(resolve(root) + '\\')
    ? repository.slice(resolve(root).length + 1).replaceAll('\\', '/') + '/' : undefined
  const unrelated = [...tracked, ...untracked].filter(file => !allowed.has(file)
    && !file.startsWith('.dsh/') && !(pluginRelative && file.startsWith(pluginRelative)))
  return { revision, patches, unrelated }
}

/** Apply only after every patch and all local modifications have been checked. */
export function applyHost(root, inspection = inspectHost(root)) {
  if (inspection.unrelated.length) throw new Error('Unrelated local changes; preserve them and use a separate clean checkout:\n' + inspection.unrelated.slice(0, 30).join('\n'))
  const pending = inspection.patches.filter(patch => patch.state === 'pending')
  if (pending.length) execute('git', ['apply', '--check', ...pending.map(patch => patch.path)], root)
  if (pending.length) execute('git', ['apply', ...pending.map(patch => patch.path)], root)
}

/** Check emitted runtime capabilities without reading credentials or starting DSH. */
export async function verifyHost(root) {
  const { HostConnectionService } = await import(pathToFileURL(join(root, 'packages/client/connection/lib/index.js')).href)
  for (const method of manifest.capabilities.authentication) {
    if (typeof HostConnectionService.prototype[method] !== 'function') throw new Error('Built Host missing ' + method)
  }
  const { BasicCompactionEngine } = await import(pathToFileURL(join(root, 'packages/compaction/compaction-basic/lib/index.js')).href)
  if (typeof BasicCompactionEngine.prototype.tokenBudgetPolicy !== 'function') throw new Error('Built Host missing compaction/token-budget')
  console.log('PASS built authentication and compaction capabilities; restart the original Host to load them.')
}

function packageCommand(command, root) {
  // Commands are fixed strings, never interpolated paths, user input, or manifest code.
  if (process.platform === 'win32') execute(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], root)
  else {
    const [program, ...args] = command.split(' ')
    execute(program, args, root)
  }
}

async function main() {
  const args = process.argv.slice(2)
  let root = process.env.DSH_SOURCE
  let mode = '--check'
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--host') {
      root = args[++index]
      if (!root || root.startsWith('--')) throw new Error('--host requires a path')
    } else if (['--check', '--apply', '--prepare', '--verify'].includes(args[index])) mode = args[index]
    else throw new Error('Usage: node tools/prepare-host.mjs --host <DSH source> [--check|--apply|--prepare|--verify]')
  }
  if (!root || !existsSync(join(root, 'package.json'))) throw new Error('Set DSH_SOURCE or pass --host <DSH source>')
  root = resolve(root)
  const hostPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  if (hostPackage.name !== '@deepseek-ai/dsh-root' || hostPackage.version !== manifest.host.version
    || hostPackage.packageManager !== manifest.host.packageManager) throw new Error('Host package identity/version/packageManager differs from the pinned manifest')
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (major < 24 || major === 24 && minor < 9) throw new Error('Node >=24.9 required')
  const inspection = inspectHost(root)
  console.log('DSH ' + inspection.revision)
  for (const patch of inspection.patches) console.log(patch.state + ' ' + patch.file)
  if (inspection.unrelated.length) console.log('Local changes outside managed patches: ' + inspection.unrelated.length)
  if (mode === '--check') return
  if (mode === '--verify') return verifyHost(root)
  if (mode === '--prepare') {
    const result = process.platform === 'win32'
      ? execute(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'pnpm --version'], root, true)
      : execute('pnpm', ['--version'], root, true)
    if (result !== manifest.host.packageManager.split('@').at(-1)) throw new Error('Install the pinned package manager: ' + manifest.host.packageManager)
  }
  applyHost(root, inspection)
  if (mode === '--apply') return
  packageCommand('pnpm install --frozen-lockfile', root)
  packageCommand('pnpm run build:artifacts', root)
  execute(process.execPath, [join(root, 'node_modules/vitest/vitest.mjs'), 'run', ...manifest.tests], root)
  packageCommand('pnpm run build:check', root)
  await verifyHost(root)
  console.log('Ready. Install plugins into your original profile, then restart DSH and refresh the browser.')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1 })
}
