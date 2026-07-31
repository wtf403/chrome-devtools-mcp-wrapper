# chrome-devtools-mcp-wrapper

An MCP wrapper around [`chrome-devtools-mcp`](https://github.com/ChromeDevTools/chrome-devtools-mcp) that adds **dynamic multi-browser routing** — connect to multiple Chrome instances and switch between them at runtime, without restarting the MCP server.

Implements the feature proposed in [ChromeDevTools/chrome-devtools-mcp#590](https://github.com/ChromeDevTools/chrome-devtools-mcp/issues/590).

---

## Installation

### Claude Code

```bash
claude mcp add chrome-devtools-wrapper --scope user -- npx -y chrome-devtools-mcp-wrapper@latest
```

Or add to your config manually (see below).

### Standard config (all MCP clients)

```json
{
  "mcpServers": {
    "chrome-devtools-wrapper": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp-wrapper@latest"]
    }
  }
}
```

### With a default browser URL

```json
{
  "mcpServers": {
    "chrome-devtools-wrapper": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp-wrapper@latest",
        "--browser-url=http://127.0.0.1:9222"
      ]
    }
  }
}
```

### Cursor

Go to **Cursor Settings → MCP → New MCP Server** and paste the standard config above.

### VS Code / GitHub Copilot

```bash
code --add-mcp '{"name":"chrome-devtools-wrapper","command":"npx","args":["-y","chrome-devtools-mcp-wrapper@latest"],"env":{}}'
```

### Kiro

Go to **Kiro Settings → Configure MCP → Open Workspace or User MCP Config** and paste the standard config above.

### Claude Desktop

Config file locations:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "chrome-devtools-wrapper": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp-wrapper@latest"]
    }
  }
}
```

---

## Usage

### 1. Start Chrome with remote debugging

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222

# Linux
google-chrome --remote-debugging-port=9222

# Windows
chrome.exe --remote-debugging-port=9222
```

### 2. Connect the wrapper to your browser

```
switch_browser(url: "9222")
```

Or with a full URL:

```
switch_browser(url: "http://127.0.0.1:9222")
switch_browser(url: "ws://127.0.0.1:9222/devtools/browser/abc123")
```

After connecting, all 50+ `chrome-devtools-mcp` tools become available.

### 3. Use any browser tool

```
navigate_page(url: "https://example.com")
take_screenshot()
evaluate_script(expression: "document.title")
```

### 4. Route a single call to a specific browser

Every proxied tool accepts an optional `browserUrl` argument:

```
navigate_page(url: "https://staging.example.com", browserUrl: "9333")
take_screenshot(browserUrl: "9222")
```

### 5. Check active connections

```
list_browsers()
```

---

## Wrapper-native tools

These two tools are always available, even before a browser connects:

| Tool | Description |
|------|-------------|
| `switch_browser(url)` | Connect to a browser and set it as the default. Accepts a full URL or bare port number. |
| `list_browsers()` | List all active browser backends and which is the default. |

All other tools (navigation, screenshots, scripting, network, performance, memory, etc.) come from `chrome-devtools-mcp` and are registered once a browser connects.

---

## How it works

```
MCP client (Claude Code, Cursor, etc.)
    │
    ▼
chrome-devtools-mcp-wrapper
    ├── switch_browser / list_browsers  ← wrapper-native, always registered
    ├── [50+ upstream tools]            ← registered after first browser connects
    │     + optional browserUrl arg     ← routes call to a specific backend
    │
    ├── backend pool [9222]  →  npx chrome-devtools-mcp@latest --browserUrl=...9222
    ├── backend pool [9333]  →  npx chrome-devtools-mcp@latest --browserUrl=...9333
    └── ...
```

- One `chrome-devtools-mcp` subprocess per browser URL
- Subprocesses are reused across calls, idle-killed after 5 minutes
- The wrapper does not fork upstream — it runs it as an external process via `npx`, so upstream updates are picked up automatically

---

## CLI flags

```bash
npx chrome-devtools-mcp-wrapper@latest [options]
```

| Flag | Description |
|------|-------------|
| `--browser-url`, `-u` | Default browser URL at startup (e.g. `http://127.0.0.1:9222`) |
| `--port`, `-p` | Shorthand for `--browser-url=http://127.0.0.1:<port>` |

---

## Development

```bash
git clone https://github.com/wtf403/chrome-devtools-mcp
cd chrome-devtools-mcp-wrapper
npm install
npm run build
node test/smoke.js    # smoke test (no real browser needed)
```

### Publishing

Tagging a release triggers automatic publishing to npm:

```bash
npm version patch   # or minor / major
git push --follow-tags
```

See [.github/workflows/publish.yml](.github/workflows/publish.yml) for the workflow.
Required GitHub Actions secret: `NPM_TOKEN` (see below).

---

## GitHub Actions secrets

To enable automatic npm publishing, add one secret to your GitHub repository:

**Settings → Secrets and variables → Actions → New repository secret**

| Secret name | How to get it |
|-------------|---------------|
| `NPM_TOKEN` | Go to [npmjs.com](https://www.npmjs.com) → your account → **Access Tokens** → **Generate New Token** → choose **Automation** type → copy the token |

The workflow uses `--provenance` to publish with [npm provenance](https://docs.npmjs.com/generating-provenance-statements), which links the published package to its source commit. This requires the `id-token: write` permission already set in the workflow.

---

## Relation to upstream

This package wraps [`chrome-devtools-mcp`](https://github.com/ChromeDevTools/chrome-devtools-mcp) without forking it. The official package runs as a subprocess via `npx chrome-devtools-mcp@latest`, so upstream tool additions and bug fixes are inherited automatically on each wrapper restart.
