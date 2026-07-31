# chrome-devtools-mcp-wrapper

[![npm chrome-devtools-mcp-wrapper package](https://img.shields.io/npm/v/chrome-devtools-mcp-wrapper.svg)](https://npmjs.org/package/chrome-devtools-mcp-wrapper)

A dynamic multi-browser wrapper around [`chrome-devtools-mcp`](https://github.com/ChromeDevTools/chrome-devtools-mcp) that lets your AI coding agent connect to **multiple Chrome instances at once** and switch between them at runtime — without restarting the MCP server.

Implements the feature proposed in [ChromeDevTools/chrome-devtools-mcp#590](https://github.com/ChromeDevTools/chrome-devtools-mcp/issues/590).

## Key features

- **Dynamic browser routing**: connect to any number of Chrome instances and route each tool call to the right one via an optional `browserUrl` argument.
- **Runtime switching**: call `switch_browser` to change the active browser without restarting anything.
- **All upstream tools included**: every tool from `chrome-devtools-mcp` is proxied automatically, plus two wrapper-native tools (`switch_browser`, `list_browsers`).
- **No fork**: runs `npx chrome-devtools-mcp@latest` as a subprocess, so upstream updates are picked up automatically.

## Getting started

Add the following config to your MCP client:

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

> [!NOTE]
> Using `chrome-devtools-mcp-wrapper@latest` ensures your MCP client always uses the latest version.

### MCP client configuration

<details>
  <summary>Claude Code</summary>

```bash
claude mcp add chrome-devtools-wrapper --scope user -- npx -y chrome-devtools-mcp-wrapper@latest
```

Or add the config manually to your Claude Code settings.

</details>

<details>
  <summary>Cursor</summary>

Go to `Cursor Settings` → `MCP` → `New MCP Server` and paste the standard config above.

</details>

<details>
  <summary>Copilot / VS Code</summary>

**macOS / Linux:**

```bash
code --add-mcp '{"name":"chrome-devtools-wrapper","command":"npx","args":["-y","chrome-devtools-mcp-wrapper@latest"],"env":{}}'
```

**Windows (PowerShell):**

```powershell
code --add-mcp '{"""name""":"""chrome-devtools-wrapper""","""command""":"""npx""","""args""":["""-y""","""chrome-devtools-mcp-wrapper@latest"""]}'
```

Or follow the VS Code [MCP configuration guide](https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_add-an-mcp-server) and use the standard config above.

</details>

<details>
  <summary>Kiro</summary>

In **Kiro Settings**, go to `Configure MCP` → `Open Workspace or User MCP Config` and paste the standard config above.

Or from the IDE Activity Bar → `Kiro` → `MCP Servers` → `Open MCP Config`.

</details>

<details>
  <summary>JetBrains AI Assistant & Junie</summary>

Go to `Settings | Tools | AI Assistant | Model Context Protocol (MCP)` → `Add`. Use the standard config above.

For Junie: `Settings | Tools | Junie | MCP Settings` → `Add`.

</details>

<details>
  <summary>Claude Desktop</summary>

Config file locations:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Paste the standard config above.

</details>

<details>
  <summary>Cline</summary>

Follow https://docs.cline.bot/mcp/configuring-mcp-servers and use the standard config above.

</details>

<details>
  <summary>Gemini CLI</summary>

```bash
gemini mcp add chrome-devtools-wrapper npx chrome-devtools-mcp-wrapper@latest
```

</details>

## Requirements

- [Node.js](https://nodejs.org/) LTS version (20.19+ or 22.12+)
- [Chrome](https://www.google.com/chrome/) current stable version or newer
- [npm](https://www.npmjs.com/)

## Usage

### 1. Start Chrome with remote debugging

**macOS**

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-profile
```

**Linux**

```bash
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-profile
```

**Windows**

```bash
"C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-profile"
```

> [!WARNING]
> Enabling the remote debugging port exposes a debugging interface that any local application can connect to. Avoid browsing sensitive websites while the port is open.

### 2. Connect the wrapper to your browser

```
switch_browser(url: "9222")
```

Or with a full URL or WebSocket endpoint:

```
switch_browser(url: "http://127.0.0.1:9222")
switch_browser(url: "ws://127.0.0.1:9222/devtools/browser/abc123")
```

After connecting, all `chrome-devtools-mcp` tools become available.

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

## Wrapper-native tools

These two tools are always available, even before a browser connects:

| Tool | Description |
|------|-------------|
| `switch_browser(url)` | Connect to a browser and set it as the default. Accepts a full URL, WebSocket endpoint, or bare port number (e.g. `"9222"`). |
| `list_browsers()` | List all active browser backends and which is the current default. |

All other tools come from `chrome-devtools-mcp` and are registered once a browser connects.

## Configuration options

You can also run `npx chrome-devtools-mcp-wrapper@latest --help` to see all options.

### Multiple browsers

Start multiple Chrome instances on different ports, then route calls dynamically:

```
switch_browser(url: "9222")           # connects, sets default
navigate_page(url: "https://prod.example.com")

navigate_page(url: "https://staging.example.com", browserUrl: "9333")  # routes to port 9333
take_screenshot(browserUrl: "9333")
```

### WebSocket endpoint

If you know the exact WebSocket endpoint (from `http://127.0.0.1:9222/json/version` → `webSocketDebuggerUrl`):

```json
{
  "mcpServers": {
    "chrome-devtools-wrapper": {
      "command": "npx",
      "args": [
        "-y",
        "chrome-devtools-mcp-wrapper@latest",
        "--browser-url=ws://127.0.0.1:9222/devtools/browser/<id>"
      ]
    }
  }
}
```

## How it works

```
MCP client (Claude Code, Cursor, etc.)
    │
    ▼
chrome-devtools-mcp-wrapper
    ├── switch_browser / list_browsers  ← always available
    ├── navigate_page(browserUrl?)      ─┐
    ├── take_screenshot(browserUrl?)     ├─ proxied from chrome-devtools-mcp
    ├── evaluate_script(browserUrl?)     │  registered after first browser connects
    └── ... (50+ tools)                 ─┘
         │                    │
         ▼                    ▼
  backend [9222]        backend [9333]
  npx chrome-           npx chrome-
  devtools-mcp          devtools-mcp
  --browserUrl=         --browserUrl=
  ...9222               ...9333
```

- One `chrome-devtools-mcp` subprocess per browser URL, reused across calls
- Idle backends are killed after 5 minutes of inactivity
- The wrapper does not fork upstream — upstream updates are inherited automatically on restart

## Relation to upstream

This package wraps [`chrome-devtools-mcp`](https://github.com/ChromeDevTools/chrome-devtools-mcp) without forking it. It runs the official package as a subprocess via `npx chrome-devtools-mcp@latest`. All 50+ upstream tools are proxied transparently.

For single-browser use cases, the upstream package is the right choice. Use this wrapper when you need to connect to multiple Chrome instances or switch between them at runtime.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) (coming soon) or open an issue at [github.com/wtf403/chrome-devtools-mcp/issues](https://github.com/wtf403/chrome-devtools-mcp/issues).
