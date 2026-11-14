/** Read-only environment checks followed by isolated plugin regressions. */
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const flags = new Set(process.argv.slice(2))
if ([...flags].some(flag => flag !== '--doctor')) {
  console.error('用法：node tools/check.mjs [--doctor]')
  process.exit(1)
}
let env
try { env = await import('./test-environment.mjs') }
catch (error) { console.error('FAIL ' + error.message); process.exit(1) }
let failures = 0
function check(label, run) {
  try { console.log('PASS ' + label + ': ' + run()) }
  catch (error) { failures++; console.error('FAIL ' + label + ': ' + error.message) }
}
check('Node', () => {
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (major < 24 || (major === 24 && minor < 9)) throw new Error('需要 Node >=24.9；当前 ' + process.version)
  return process.version
})
console.log('DSH_SOURCE=' + env.harnessRoot)
for (const name of ['react', 'react-dom/client', 'jsdom', 'playwright', 'tsx/esm']) check(name, () => env.dependencyPath(name))
check('React UMD', () => env.dependencyPath('react/umd/react.development.js'))
check('ReactDOM UMD', () => env.dependencyPath('react-dom/umd/react-dom.development.js'))
check('浏览器', () => env.browserOptions().executablePath)
for (const file of ['vendor/cordis/lib/index.js', 'packages/client/connection/lib/index.js', 'packages/core/system-prompt/lib/index.js', 'packages/core/agent-loop/lib/index.js']) check(file, () => {
  if (!existsSync(join(env.harnessRoot, file))) throw new Error('缺少构建产物；请在 DSH 源码目录运行 pnpm run build:artifacts，再运行 pnpm run build:check。')
  return '存在'
})
console.log('提示：检查不读取凭据，不验证远端网络、手机真机或客户端所有插槽。')
if (failures || flags.has('--doctor')) process.exit(failures ? 1 : 0)
const tools = fileURLToPath(new URL('./', import.meta.url))
// Only reviewed isolated tests run here; local diagnostic files may target live profiles.
const scripts = [
  'aurum-actions-browser-test.mjs', 'aurum-history-browser.mjs', 'aurum-navigation-browser.mjs', 'aurum-navigation-test.mjs', 'aurum-theme-smoke.mjs',
  'choice-pilot-test.mjs', 'choice-pilot-visual-test.mjs', 'compatibility-test.mjs',
  'context-library-client-test.mjs', 'context-library-core-test.mjs', 'context-library-import-test.mjs', 'context-library-integration-test.mjs',
  'local-vault-client-test.mjs', 'local-vault-connection-test.mjs', 'local-vault-host-test.mjs',
  'mobile-deck-client-test.mjs', 'mobile-deck-host-test.mjs', 'mobile-deck-startup-test.mjs', 'mobile-deck-visual-test.mjs',
  'shared-features-host-test.mjs', 'remote-access-native-test.mjs',
  'session-reaper-client-test.mjs', 'session-reaper-lifecycle-test.mjs', 'suite-experience-visual-test.mjs',
]
for (const script of scripts) {
  console.log('\nRUN ' + script)
  const code = await new Promise(resolve => {
    const child = spawn(process.execPath, [join(tools, script)], {
      cwd: env.harnessRoot, env: { ...process.env, DSH_SOURCE: env.harnessRoot }, stdio: 'inherit',
    })
    child.on('error', error => { console.error(error.message); resolve(1) })
    child.on('close', (code, signal) => { if (signal) console.error('测试终止：' + signal); resolve(code ?? 1) })
  })
  if (code !== 0) failures++
  console.log((code === 0 ? 'PASS ' : 'FAIL ') + script)
}
console.log('\n检查完成：' + scripts.length + ' 个脚本，' + failures + ' 个失败。')
process.exitCode = failures ? 1 : 0
