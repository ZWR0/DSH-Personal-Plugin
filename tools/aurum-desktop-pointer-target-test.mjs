import assert from 'node:assert/strict'
import { TakeoverControl } from '../aurum-desktop/mcp/takeover.mjs'

const control = new TakeoverControl({ testMode: true })
const until = async predicate => {
  const deadline = Date.now() + 4000
  while (Date.now() < deadline) {
    const value = await control.command('status')
    if (predicate(value)) return value
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  assert.fail('Pointer did not reach its expected state')
}
try {
  const initial = await control.command('begin', { cursorIndicatorEnabled: true, indicatorEnabled: false })
  assert.equal(initial.pointerVisible, false, 'No agent target means no duplicate of the user cursor')
  await control.command('target_config', { cursorIndicatorEnabled: true, pointerAnimationMs: 600, indicatorIdleMs: 800 })
  const first = await control.command('pointer_target', { x: 200, y: 200 })
  assert.equal(first.pointerSource, 'agent-target')
  assert.equal(first.pointerX, 200)
  assert.equal(first.pointerY, 200)
  await control.command('pointer_target', { x: 600, y: 400 })
  const moving = await until(value => value.pointerX > 200 && value.pointerX < 600)
  assert(moving.pointerY > 200 && moving.pointerY < 400)
  const arrived = await until(value => value.pointerX === 600 && value.pointerY === 400)
  assert.equal(arrived.pointerClickThrough, true)
  const clicked = await control.command('pointer_target', { x: 600, y: 400, click: true })
  assert.equal(clicked.targetPhase, 'click')
  await until(value => !value.pointerVisible)
  await control.command('configure', { cursorIndicatorEnabled: false })
  const hidden = await control.command('pointer_target', { x: 800, y: 500 })
  assert.equal(hidden.pointerVisible, false)
  console.log('PASS: explicit target coordinates, intermediate movement, click feedback, idle expiry, disabled marker and click-through')
} finally { await control.close() }
