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

To connect to an already-running Chrome instance at startup:

```json
{
  "mcpServers": {
    "chrome-devtools-wrapper": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp-wrapper@latest", "--browser-url=http://127.0.0.1:9222"]
    }
  }
}
```

> [!NOTE]
> Using `chrome-devtools-mcp-wrapper@latest` ensures your MCP client always uses the latest version.

### MCP client configuration

<details>
  <summary>Claude Code</summary>

**Install via CLI (MCP only)**

Use the Claude Code CLI to add the wrapper ([guide](https://code.claude.com/docs/en/mcp)):

```bash
claude mcp add chrome-devtools-wrapper --scope user -- npx -y chrome-devtools-mcp-wrapper@latest
```

</details>

<details>
  <summary>Copilot / VS Code</summary>

**Click the button to install:**

[<img src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF" alt="Install in VS Code">](https://vscode.dev/redirect/mcp/install?name=chrome-devtools-wrapper&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22chrome-devtools-mcp-wrapper%40latest%22%5D%2C%22env%22%3A%7B%7D%7D)

[<img src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5" alt="Install in VS Code Insiders">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522chrome-devtools-wrapper%2522%252C%2522config%2522%253A%257B%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522-y%2522%252C%2522chrome-devtools-mcp-wrapper%2540latest%2522%255D%252C%2522env%2522%253A%257B%257D%257D%257D)

**Or install manually:**

Follow the VS Code [MCP configuration guide](https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_add-an-mcp-server) and use the standard config above, or use the CLI:

For macOS and Linux:

```bash
code --add-mcp '{"name":"chrome-devtools-wrapper","command":"npx","args":["-y","chrome-devtools-mcp-wrapper@latest"],"env":{}}'
```

For Windows (PowerShell):

```powershell
code --add-mcp '{"""name""":"""chrome-devtools-wrapper""","""command""":"""npx""","""args""":["""-y""","""chrome-devtools-mcp-wrapper@latest"""]}'
```

</details>

<details>
  <summary>Cursor</summary>

**Click the button to install:**

[<img src="https://cursor.com/deeplink/mcp-install-dark.svg" alt="Install in Cursor">](https://cursor.com/en/install-mcp?name=chrome-devtools-wrapper&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImNocm9tZS1kZXZ0b29scy1tY3Atd3JhcHBlckBsYXRlc3QiXSwiZW52Ijp7fX0)

**Or install manually:**

Go to `Cursor Settings` → `MCP` → `New MCP Server` and paste the standard config above.

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

Or globally:

```bash
gemini mcp add -s user chrome-devtools-wrapper npx chrome-devtools-mcp-wrapper@latest
```

</details>

<details>
  <summary>Codex</summary>

Follow the [configure MCP guide](https://developers.openai.com/codex/mcp/#configure-with-the-cli) and use the standard config above.

**On Windows 11**, configure the Chrome install location and increase the startup timeout by updating `.codex/config.toml`:

```toml
[mcp_servers.chrome-devtools-wrapper]
command = "cmd"
args = ["/c", "npx", "-y", "chrome-devtools-mcp-wrapper@latest"]
env = { SystemRoot="C:\\Windows", PROGRAMFILES="C:\\Program Files" }
startup_timeout_ms = 20_000
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

### 2. Connect to your browser

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

### Multiple browsers

Start multiple Chrome instances on different ports, then route calls dynamically:

```
switch_browser(url: "9222")
navigate_page(url: "https://prod.example.com")

navigate_page(url: "https://staging.example.com", browserUrl: "9333")
take_screenshot(browserUrl: "9333")
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
- Upstream updates are inherited automatically on restart

## Relation to upstream

This package wraps [`chrome-devtools-mcp`](https://github.com/ChromeDevTools/chrome-devtools-mcp) without forking it. All 50+ upstream tools are proxied transparently.

For single-browser use cases, the upstream package is the right choice. Use this wrapper when you need to connect to multiple Chrome instances or switch between them at runtime.
