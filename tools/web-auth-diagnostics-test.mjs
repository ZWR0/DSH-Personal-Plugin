import { dependencyPath, harnessRoot } from './test-environment.mjs'
/** Check the optional patch against local DSH copies; never edit the running checkout. */
import { mkdtemp, mkdir, copyFile } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = harnessRoot
await mkdir(join(root, 'tools/.test-tmp'), { recursive: true })
const stage = await mkdtemp(join(root, 'tools/.test-tmp/web-auth-'))
const files = [
 'packages/client/connection/src/browser-auth.ts',
 'packages/client/connection/src/index.ts',
 'packages/host/webserver/src/index.ts',
 'packages/client/connection/src/connect-protocol.ts',
]
for (const file of files) {
 await mkdir(dirname(join(stage,file)), {recursive:true})
 await copyFile(join(source,file),join(stage,file))
}
await copyFile(join(source,'packages/client/connection/tests/browser-credentials.ts'),join(stage,'browser-credentials.ts'))
await copyFile(join(root,'tools/web-auth-diagnostics-fixture.mjs'),join(stage,'check.mjs'))
// git apply is scoped to disposable copies inside the plugin workspace.
const prefix = stage.slice(root.length + 1).replaceAll('\\','/')
// An already patched checkout is normalized only in disposable copies.
const patch = join(root,'patches/dsh-web-auth-diagnostics.patch')
const reverseCheck = spawnSync('git',['apply','--reverse','--check','--directory='+prefix,patch],{cwd:root,encoding:'utf8'})
if (reverseCheck.status === 0) {
 const result = spawnSync('git',['apply','--reverse','--directory='+prefix,patch],{cwd:root,encoding:'utf8'})
 if (result.status !== 0) throw new Error(result.stderr || 'temporary patch normalization failed')
}
for (const extra of [['--check'], []]) {
 const result = spawnSync('git',['apply',...extra,'--directory='+prefix,join(root,'patches/dsh-web-auth-diagnostics.patch')],{cwd:root,encoding:'utf8'})
 if(result.status !== 0) throw new Error(result.stderr || 'patch application failed')
}
const test = spawnSync(process.execPath,['--import',pathToFileURL(dependencyPath('tsx/esm')).href,join(stage,'check.mjs')],{cwd:root,encoding:'utf8'})
process.stdout.write(test.stdout)
process.stderr.write(test.stderr)
if(test.status !== 0) process.exitCode = 1
