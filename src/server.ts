/**
 * MCP wrapper server.
 *
 * Exposes all tools from chrome-devtools-mcp@latest, adding:
 *   - An optional `browserUrl` argument on every proxied tool for per-call routing
 *   - A `switch_browser` tool to change the default connection at runtime
 *   - A `list_browsers` tool to inspect active backends
 *
 * Startup is non-blocking: the server starts immediately and proxies upstream
 * tools as soon as a backend is available. Upstream tools are fetched lazily
 * on the first tools/list or tools/call from the client.
 */

import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
import {BackendPool} from './pool.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, {type?: string; description?: string}>;
    required?: string[];
  };
}

function textContent(text: string): {type: 'text'; text: string} {
  return {type: 'text', text};
}

// ---------------------------------------------------------------------------
// Build a raw Zod shape from an upstream JSON Schema properties map
// ---------------------------------------------------------------------------

function buildShape(
  properties: Record<string, {type?: string; description?: string}> = {},
  required: string[] = [],
): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, def] of Object.entries(properties)) {
    let base: z.ZodTypeAny;
    switch (def.type) {
      case 'number':
        base = z.number();
        break;
      case 'integer':
        base = z.number().int();
        break;
      case 'boolean':
        base = z.boolean();
        break;
      case 'array':
        base = z.array(z.unknown());
        break;
      case 'object':
        base = z.record(z.string(), z.unknown());
        break;
      default:
        base = z.string();
    }
    if (def.description) base = base.describe(def.description);
    shape[key] = required.includes(key) ? base : base.optional();
  }

  return shape;
}

// ---------------------------------------------------------------------------
// Register all proxied upstream tools on an already-running server
// ---------------------------------------------------------------------------

function registerUpstreamTools(
  server: McpServer,
  pool: BackendPool,
  tools: McpTool[],
): void {
  for (const tool of tools) {
    const upstreamName = tool.name;
    const properties = tool.inputSchema?.properties ?? {};
    const required = tool.inputSchema?.required ?? [];

    const shape: Record<string, z.ZodTypeAny> = {
      ...buildShape(properties, required),
      browserUrl: z
        .string()
        .optional()
        .describe(
          'Route this call to a specific browser. Accepts a full URL or bare port (e.g. "9222"). ' +
            'Omit to use the current default.',
        ),
    };

    server.registerTool(
      upstreamName,
      {
        description:
          (tool.description ?? '') +
          '\n\n_Wrapper: pass `browserUrl` to route to a specific browser._',
        inputSchema: shape,
      },
      async (params) => {
        const allParams = params as Record<string, unknown>;
        const rawUrl = allParams['browserUrl'] as string | undefined;
        const {browserUrl: _removed, ...upstreamParams} = allParams;
        void _removed;

        let entry;
        try {
          entry = await pool.get(rawUrl);
        } catch (err) {
          return {
            content: [
              textContent(
                `Could not get backend for ${rawUrl ?? pool.getDefault()}: ${(err as Error).message}`,
              ),
            ],
            isError: true,
          };
        }

        try {
          const result = (await pool.request(entry, 'tools/call', {
            name: upstreamName,
            arguments: upstreamParams,
          })) as {content?: Array<{type: string; text?: string}>; isError?: boolean} | null;

          if (!result) {
            return {content: [textContent('No response from backend.')], isError: true};
          }

          const content = (result.content ?? []).map((c) =>
            c.type === 'text'
              ? textContent(c.text ?? '')
              : (c as {type: 'text'; text: string}),
          );
          return {content, isError: result.isError};
        } catch (err) {
          return {
            content: [
              textContent(
                `Error forwarding "${upstreamName}" to ${entry.browserUrl}: ${(err as Error).message}`,
              ),
            ],
            isError: true,
          };
        }
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Main server factory
// ---------------------------------------------------------------------------

export async function createWrapperServer(opts: {
  defaultBrowserUrl?: string;
}): Promise<void> {
  const pool = new BackendPool(opts.defaultBrowserUrl ?? 'http://127.0.0.1:9222');

  const server = new McpServer({
    name: 'chrome-devtools-mcp-wrapper',
    version: '0.1.0',
  });

  // Track whether upstream tools have been registered yet
  let upstreamRegistered = false;

  // ------------------------------------------------------------------
  // Wrapper-native tools (always available, no browser needed)
  // ------------------------------------------------------------------

  server.registerTool(
    'switch_browser',
    {
      description:
        'Connect to a different browser instance and set it as the new default. ' +
        'Accepts a full URL (http://127.0.0.1:9222 or ws://…) or a bare port number (e.g. "9222"). ' +
        'Also triggers lazy registration of all upstream browser tools.',
      inputSchema: {
        url: z
          .string()
          .describe(
            'Browser URL or bare port (e.g. "9222"). Will become the new default.',
          ),
      },
    },
    async ({url}) => {
      const normalised = /^\d+$/.test(url.trim())
        ? `http://127.0.0.1:${url.trim()}`
        : url.trim();
      pool.setDefault(normalised);

      try {
        const backend = await pool.get(normalised);
        await backend.ready;

        // Lazily register upstream tools now that we have a live backend
        if (!upstreamRegistered) {
          const result = (await pool.request(backend, 'tools/list', {})) as {
            tools?: McpTool[];
          };
          const tools = result?.tools ?? [];
          registerUpstreamTools(server, pool, tools);
          upstreamRegistered = true;
          process.stderr.write(
            `[wrapper] Registered ${tools.length} upstream tools from ${normalised}.\n`,
          );
        }

        return {
          content: [
            textContent(
              `✓ Default browser set to ${normalised}. Backend running (pid ${backend.proc.pid}).`,
            ),
          ],
        };
      } catch (err) {
        return {
          content: [
            textContent(`✗ Could not connect to ${normalised}: ${(err as Error).message}`),
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    'list_browsers',
    {
      description: 'List all currently active browser backends managed by the wrapper.',
      inputSchema: {},
    },
    async () => {
      const active = pool.listActive();
      const def = pool.getDefault();
      if (active.length === 0) {
        return {
          content: [
            textContent(
              `No active backends. Default URL: ${def}\n\n` +
                'Tip: Call switch_browser to connect and register all browser tools.',
            ),
          ],
        };
      }
      const lines = active.map((u) => `• ${u}${u === def ? ' (default)' : ''}`);
      return {
        content: [textContent(`Active browser backends:\n${lines.join('\n')}`)],
      };
    },
  );

  // ------------------------------------------------------------------
  // Try to eagerly register upstream tools if a browser is already
  // running at startup. We do this non-blockingly in the background
  // so the server starts immediately regardless.
  // ------------------------------------------------------------------

  void (async () => {
    try {
      const backend = await pool.get();
      // Give the backend process a moment to be ready (it needs to download/start)
      await backend.ready;
      const result = (await pool.request(backend, 'tools/list', {})) as {
        tools?: McpTool[];
      };
      const tools = result?.tools ?? [];
      if (tools.length > 0 && !upstreamRegistered) {
        registerUpstreamTools(server, pool, tools);
        upstreamRegistered = true;
        process.stderr.write(
          `[wrapper] Eagerly registered ${tools.length} upstream tools from ${pool.getDefault()}.\n`,
        );
      }
    } catch {
      process.stderr.write(
        `[wrapper] No browser at ${pool.getDefault()} — upstream tools will register after switch_browser.\n`,
      );
    }
  })();

  // ------------------------------------------------------------------
  // Start transport (non-blocking: runs while background init continues)
  // ------------------------------------------------------------------

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on('SIGINT', () => {
    pool.killAll();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    pool.killAll();
    process.exit(0);
  });
}
