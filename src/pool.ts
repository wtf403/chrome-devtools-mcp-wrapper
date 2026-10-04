/**
 * BackendPool manages one chrome-devtools-mcp child process per browserUrl.
 * Processes are spawned on first use and reused for subsequent calls.
 * Idle processes are cleaned up after IDLE_TIMEOUT_MS.
 *
 * Protocol: chrome-devtools-mcp speaks JSON-RPC 2.0 over stdio.
 * We must initiate the MCP handshake (initialize → notifications/initialized)
 * before sending any tool requests.
 */

import {spawn, type ChildProcess} from 'node:child_process';
import {createInterface} from 'node:readline';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;   // 5 minutes
const HANDSHAKE_TIMEOUT_MS = 60 * 1000;  // 60s — npx may need to download

type PendingMap = Map<
  number | string,
  {resolve: (v: unknown) => void; reject: (e: Error) => void}
>;

export interface BackendEntry {
  proc: ChildProcess;
  /** Resolves once the MCP handshake is complete. */
  ready: Promise<void>;
  idleTimer: ReturnType<typeof setTimeout> | null;
  browserUrl: string;
  /** Send a JSON-RPC request to this backend. */
  request(method: string, params: unknown): Promise<unknown>;
}

function normalizeBrowserUrl(raw: string): string {
  return /^\d+$/.test(raw.trim())
    ? `http://127.0.0.1:${raw.trim()}`
    : raw.trim();
}

/**
 * Resolve how to spawn an upstream backend.
 *
 * Default (unchanged): `npx -y chrome-devtools-mcp@latest`.
 *
 * Opt-in: set CHROME_DEVTOOLS_MCP_BIN to the absolute path of a local
 * chrome-devtools-mcp entry script (e.g. a vendored upstream build at
 * `upstream/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js`).
 * The local file is spawned with `node` instead of going through npx —
 * useful to run fixes that have not been released to npm yet.
 */
function backendSpawn(): {command: string; prefixArgs: string[]} {
  const localBin = (process.env['CHROME_DEVTOOLS_MCP_BIN'] ?? '').trim();
  if (localBin) {
    process.stderr.write(`[wrapper] Using local backend: ${localBin}\n`);
    return {command: process.execPath, prefixArgs: [localBin]};
  }
  return {command: 'npx', prefixArgs: ['-y', 'chrome-devtools-mcp@latest']};
}

export class BackendPool {
  private backends = new Map<string, BackendEntry>();
  private defaultUrl: string;

  constructor(defaultUrl = 'http://127.0.0.1:9222') {
    this.defaultUrl = defaultUrl;
  }

  setDefault(url: string): void {
    this.defaultUrl = normalizeBrowserUrl(url);
  }

  getDefault(): string {
    return this.defaultUrl;
  }

  /** Returns (or spawns + handshakes) a backend for the given browserUrl. */
  async get(rawUrl?: string): Promise<BackendEntry> {
    const browserUrl = normalizeBrowserUrl(rawUrl ?? this.defaultUrl);
    const existing = this.backends.get(browserUrl);
    if (existing) {
      this.resetIdle(existing);
      return existing;
    }
    return this.spawnBackend(browserUrl);
  }

  private spawnBackend(browserUrl: string): BackendEntry {
    const {command, prefixArgs} = backendSpawn();
    const proc = spawn(
      command,
      [
        ...prefixArgs,
        `--browserUrl=${browserUrl}`,
        '--no-usage-statistics',
      ],
      {stdio: ['pipe', 'pipe', 'pipe'], env: {...process.env}},
    );

    const pending: PendingMap = new Map();
    let nextId = 1;

    // stdout → line parser → route response to pending handler
    const rl = createInterface({input: proc.stdout!, crlfDelay: Infinity});
    rl.on('line', (line) => {
      if (!line.trim()) return;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(line) as Record<string, unknown>;
      } catch {
        return; // non-JSON (npx progress, disclaimers)
      }
      const id = msg['id'] as number | string | undefined;
      if (id !== undefined) {
        const handler = pending.get(id);
        if (handler) {
          pending.delete(id);
          if (msg['error']) handler.reject(new Error(JSON.stringify(msg['error'])));
          else handler.resolve(msg['result']);
        }
      }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      process.stderr.write(`[backend:${browserUrl}] ${chunk.toString()}`);
    });

    const failAll = (err: Error): void => {
      for (const h of pending.values()) h.reject(err);
      pending.clear();
      this.backends.delete(browserUrl);
    };

    proc.on('error', failAll);
    proc.on('exit', (code) => {
      failAll(new Error(`Backend for ${browserUrl} exited with code ${code}`));
    });

    /** Send a JSON-RPC request; returns a promise for the result. */
    const sendRequest = (method: string, params: unknown): Promise<unknown> => {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, {resolve, reject});
        proc.stdin!.write(
          JSON.stringify({jsonrpc: '2.0', id, method, params}) + '\n',
        );
      });
    };

    /** Send a JSON-RPC notification (fire-and-forget). */
    const sendNotify = (method: string): void => {
      proc.stdin!.write(JSON.stringify({jsonrpc: '2.0', method}) + '\n');
    };

    // Perform MCP handshake with a timeout
    const ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            `Backend for ${browserUrl} did not complete handshake within ` +
              `${HANDSHAKE_TIMEOUT_MS}ms. Is Chrome running at that address?`,
          ),
        );
        proc.kill();
        this.backends.delete(browserUrl);
      }, HANDSHAKE_TIMEOUT_MS);

      sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {name: 'chrome-devtools-mcp-wrapper', version: '0.2.0'},
      })
        .then(() => {
          sendNotify('notifications/initialized');
          clearTimeout(timer);
          resolve();
        })
        .catch((err: Error) => {
          clearTimeout(timer);
          reject(err);
        });
    });

    const entry: BackendEntry = {
      proc,
      ready,
      idleTimer: null,
      browserUrl,
      request: sendRequest,
    };

    this.backends.set(browserUrl, entry);
    this.resetIdle(entry);
    return entry;
  }

  private resetIdle(entry: BackendEntry): void {
    if (entry.idleTimer) clearTimeout(entry.idleTimer);
    entry.idleTimer = setTimeout(() => {
      this.kill(entry.browserUrl);
    }, IDLE_TIMEOUT_MS);
  }

  kill(browserUrl: string): void {
    const entry = this.backends.get(browserUrl);
    if (!entry) return;
    if (entry.idleTimer) clearTimeout(entry.idleTimer);
    entry.proc.kill();
    this.backends.delete(browserUrl);
  }

  killAll(): void {
    for (const key of [...this.backends.keys()]) this.kill(key);
  }

  listActive(): string[] {
    return [...this.backends.keys()];
  }

  /**
   * Send a JSON-RPC request to a backend, waiting for handshake first.
   * Resets the idle timer on each use.
   */
  async request(entry: BackendEntry, method: string, params: unknown): Promise<unknown> {
    await entry.ready;
    this.resetIdle(entry);
    return entry.request(method, params);
  }
}
