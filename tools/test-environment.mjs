/** Resolve test dependencies from a DSH checkout without fixed drive or pnpm versions. */
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

/**
 * Find the checkout; an explicit DSH_SOURCE is authoritative and must be valid.
 * @param source - Optional checkout path overriding automatic ancestor discovery.
 * @returns Absolute checkout directory; throws with setup instructions if absent.
 */
export function resolveHarnessRoot(source = process.env.DSH_SOURCE) {
  const valid = root => {
    try { return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name === '@deepseek-ai/dsh-root' }
    catch (error) { if (error.code === 'ENOENT' || error instanceof SyntaxError) return false; throw error }
  }
  if (source) {
    const root = resolve(source)
    if (valid(root)) return root
    throw new Error('DSH_SOURCE 不是 DSH 源码目录：' + root + '；请指向包含 @deepseek-ai/dsh-root package.json 的目录。')
  }
  for (const start of [process.cwd(), dirname(fileURLToPath(import.meta.url))]) {
    let root = start
    while (true) {
      if (valid(root)) return root
      const parent = dirname(root)
      if (parent === root) break
      root = parent
    }
  }
  throw new Error('未找到 DSH 源码；请设置 DSH_SOURCE 为源码绝对路径，并先在该目录安装依赖。')
}
/** Selected checkout shared by all test imports and child processes. */
export const harnessRoot = resolveHarnessRoot()
const resolvers = ['package.json', 'apps/web/package.json', 'packages/client/ui-commands/package.json', 'packages/bundle/base/package.json']
  .map(path => createRequire(join(harnessRoot, path)))

/**
 * Resolve an installed dependency through Node, including package subpaths.
 * @param spec - Package name or exported subpath; React 18 UMD assets are also supported.
 * @returns Absolute filename; throws an actionable error for missing dependencies.
 */
export function dependencyPath(spec) {
  if (/^(react|react-dom)\/umd\//.test(spec)) {
    const [name, ...parts] = spec.split('/')
    const path = join(dirname(dependencyPath(name + '/package.json')), ...parts)
    if (existsSync(path)) return path
    throw new Error('测试需要 React 18 UMD 文件：' + spec + '；请核对 DSH 依赖版本。')
  }
  for (const req of resolvers) {
    try { return req.resolve(spec) }
    catch (error) { if (!['MODULE_NOT_FOUND', 'ERR_PACKAGE_PATH_NOT_EXPORTED'].includes(error.code)) throw error }
  }
  throw new Error('DSH 测试依赖不可用：' + spec + '；请在 ' + harnessRoot + ' 执行 pnpm install，并核对依赖版本。')
}
/**
 * Load a CommonJS-compatible dependency from the selected checkout.
 * @param spec - Package name or supported subpath.
 * @returns Loaded module exports.
 */
export const harnessRequire = spec => createRequire(import.meta.url)(dependencyPath(spec))
/**
 * Encode a checkout-relative module path for dynamic import.
 * @param path - Module path relative to the selected checkout.
 * @returns File URL preserving spaces, Unicode, and Windows drive letters.
 */
export const harnessUrl = path => pathToFileURL(join(harnessRoot, path)).href

/**
 * Use an explicit executable, local Edge, or installed Playwright Chromium.
 * @returns Headless launch options; throws setup instructions if no browser exists.
 */
export function browserOptions() {
  const configured = process.env.DSH_BROWSER_PATH
  if (configured) {
    if (!existsSync(configured)) throw new Error('DSH_BROWSER_PATH 不存在：' + configured)
    return { executablePath: resolve(configured), headless: true }
  }
  const edge = process.platform === 'win32' ? [process.env['PROGRAMFILES(X86)'], process.env.PROGRAMFILES, process.env.LOCALAPPDATA]
    .filter(Boolean).map(root => join(root, 'Microsoft/Edge/Application/msedge.exe')).find(existsSync) : undefined
  if (edge) return { executablePath: edge, headless: true }
  const executablePath = harnessRequire('playwright').chromium.executablePath()
  if (!existsSync(executablePath)) throw new Error('没有可用的测试浏览器；请设置 DSH_BROWSER_PATH，或在 DSH 源码目录显式安装 Playwright Chromium。')
  return { executablePath, headless: true }
}
