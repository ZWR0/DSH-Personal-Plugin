import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const server = fileURLToPath(new URL('../aurum-desktop/mcp/server.mjs', import.meta.url))
const run = (messages, selection) => {
  const child = spawnSync(process.execPath, [server], {
    env: { ...process.env, NODE_ENV: 'test', WCU_TEST_NO_TAKEOVER: '1', ...(selection ? { WCU_ENABLED_TOOLS: JSON.stringify(selection) } : {}) },
    input: messages.map(message => JSON.stringify({ jsonrpc: '2.0', ...message })).join('\n') + '\n',
    encoding: 'utf8', timeout: 20000, windowsHide: true,
  })
  assert.equal(child.error, undefined)
  assert.equal(child.status, 0, child.stderr)
  return child.stdout.trim().split('\n').filter(Boolean).map(line => JSON.parse(line))
}
const [listed] = run([{ id: 1, method: 'tools/list' }])
const tools = listed.result.tools
for (const name of ['click', 'double_click', 'move', 'element_info', 'focus', 'invoke', 'set_value']) {
  const schema = tools.find(tool => tool.name === 'windows_computer_use_' + name).inputSchema
  assert(schema.properties.browserTab, name + ' accepts a browser tab with a page element id')
}
for (const name of ['snapshot', 'accessibility_tree', 'find', 'screenshot', 'wait_for']) {
  assert(tools.find(tool => tool.name === 'windows_computer_use_' + name).inputSchema.properties.scope.enum.includes('browserTab'))
}
const open = tools.find(tool => tool.name === 'windows_computer_use_open_browser')
assert(open.inputSchema.properties.reuseExisting)
const [disabled] = run([{ id: 2, method: 'tools/call', params: { name: 'windows_computer_use_open_browser', arguments: { url: 'https://example.com' } } }], ['tools'])
assert.equal(disabled.result.isError, true)
assert.match(JSON.stringify(disabled), /TOOL_DISABLED_IN_SETTINGS/)
console.log('PASS: MCP page-action schemas, browser observation scope, existing-browser option and disabled-tool enforcement')
