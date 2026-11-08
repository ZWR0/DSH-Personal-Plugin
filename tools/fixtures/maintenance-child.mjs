/** Isolated IPC fixture; never opens a real DSH profile. */
import { maintenanceBridge } from '../../local-vault/maintenance.js'
const disposers = []
const ctx = {
  get: name => name === 'appExit' ? code => {
    process.send({ fixture: 'flushing' })
    setTimeout(() => { for (const dispose of disposers) dispose(); process.exit(code) }, 25)
  } : { list: () => [{ status: 'idle' }] },
  effect: fn => disposers.push(fn()), on() {},
}
const bridge = maintenanceBridge(ctx)
try {
  await bridge.status()
  await bridge.remove('fixture.patch')
} catch (error) { console.error(error.message); process.exitCode = 1; process.disconnect() }
