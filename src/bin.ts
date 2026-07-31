#!/usr/bin/env node
/**
 * CLI entry point for chrome-devtools-mcp-wrapper.
 *
 * Usage:
 *   node dist/bin.js [--browser-url=http://127.0.0.1:9222]
 *   node dist/bin.js [--port=9222]
 */

import {createWrapperServer} from './server.js';

const args = process.argv.slice(2);

function getArg(flags: string[]): string | undefined {
  for (const flag of flags) {
    for (const arg of args) {
      if (arg.startsWith(flag + '=')) return arg.slice(flag.length + 1);
      if (arg === flag) {
        const idx = args.indexOf(arg);
        return args[idx + 1];
      }
    }
  }
  return undefined;
}

const port = getArg(['--port', '-p']);
const browserUrl = getArg(['--browser-url', '--browserUrl', '-u']) ??
  (port ? `http://127.0.0.1:${port}` : undefined);

createWrapperServer({defaultBrowserUrl: browserUrl}).catch((err: unknown) => {
  process.stderr.write(`[wrapper] Fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
