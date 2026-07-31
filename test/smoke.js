/**
 * Smoke test: verifies the wrapper speaks correct MCP JSON-RPC.
 *
 * Spawns the wrapper binary, sends an initialize + tools/list request,
 * and checks that:
 *   1. initialize returns a valid MCP result
 *   2. tools/list includes switch_browser and list_browsers
 *
 * No real browser needed — the wrapper gracefully handles a missing
 * upstream backend (it logs a warning and still registers the two
 * wrapper-native tools).
 *
 * Run: node test/smoke.js
 */

import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, '../dist/bin.js');

const TIMEOUT_MS = 30_000;

function fail(msg) {
  console.error(`\n✗ FAIL: ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

const proc = spawn('node', [BIN], {
  stdio: ['pipe', 'pipe', 'inherit'],
  env: {
    ...process.env,
    // Point to a port we know is not running — wrapper should still start
    // and expose its native tools
  },
});

const timer = setTimeout(() => {
  proc.kill();
  fail('Timed out waiting for response');
}, TIMEOUT_MS);

const rl = createInterface({input: proc.stdout, crlfDelay: Infinity});
const pending = new Map();
let nextId = 1;
let initialized = false;

rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return; // ignore non-JSON (npx progress output etc.)
  }

  if (!initialized) {
    initialized = true;
  }

  const handler = pending.get(msg.id);
  if (handler) {
    pending.delete(msg.id);
    if (msg.error) handler.reject(new Error(JSON.stringify(msg.error)));
    else handler.resolve(msg.result);
  }
});

function send(method, params) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, {resolve, reject});
    proc.stdin.write(JSON.stringify({jsonrpc: '2.0', id, method, params}) + '\n');
  });
}

async function run() {
  console.log('Running MCP wrapper smoke test…\n');

  // 1. Initialize
  const initResult = await send('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {name: 'smoke-test', version: '0.0.1'},
  });

  if (!initResult?.protocolVersion) fail('initialize did not return protocolVersion');
  pass(`initialize → protocolVersion: ${initResult.protocolVersion}`);
  pass(`server name: ${initResult.serverInfo?.name}`);

  // Send initialized notification
  proc.stdin.write(
    JSON.stringify({jsonrpc: '2.0', method: 'notifications/initialized'}) + '\n',
  );

  // 2. List tools
  const toolsResult = await send('tools/list', {});
  const tools = toolsResult?.tools ?? [];

  if (!Array.isArray(tools)) fail('tools/list did not return an array');
  pass(`tools/list returned ${tools.length} tools`);

  const toolNames = new Set(tools.map((t) => t.name));
  if (!toolNames.has('switch_browser')) fail('switch_browser tool missing');
  pass('switch_browser tool present');

  if (!toolNames.has('list_browsers')) fail('list_browsers tool missing');
  pass('list_browsers tool present');

  // 3. Call list_browsers (no browser needed)
  const lbResult = await send('tools/call', {name: 'list_browsers', arguments: {}});
  if (!lbResult?.content?.[0]?.text) fail('list_browsers returned no content');
  pass(`list_browsers: "${lbResult.content[0].text}"`);

  console.log('\n✓ All smoke tests passed.');
  clearTimeout(timer);
  proc.kill();
  process.exit(0);
}

run().catch((err) => {
  fail(err.message);
});
