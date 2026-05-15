# mcp-obsidian

**English** · [中文](./README.md)

A Python implementation of an MCP (Model Context Protocol) server that exposes your Obsidian vault — via the [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin — to any MCP-compatible client (Claude Desktop, Claude Code, Cursor, etc.), letting an AI read and write your notes.

## Prerequisites

1. **Obsidian** installed, with the vault you want to expose currently open.
2. The **Local REST API** community plugin installed and enabled:
   - Settings → Community plugins → Browse → search "Local REST API" → Install → Enable
   - Note the **API Key** shown in the plugin settings
   - Defaults to `http://127.0.0.1:27123` (HTTP) or `https://127.0.0.1:27124` (HTTPS)
3. **Python 3.12+** and [`uv`](https://github.com/astral-sh/uv) (recommended) or `pip`

## Install

```bash
git clone https://github.com/Valen-akm/obsidian-mcp.git
cd obsidian-mcp
uv sync
```

Or with pip:

```bash
pip install -e .
```

## Configure

Copy the env template:

```bash
cp .env.example .env
```

Edit `.env` with your Local REST API details:

```env
OBSIDIAN_API_KEY=the key shown in the plugin settings
OBSIDIAN_HOST=127.0.0.1
OBSIDIAN_PORT=27300       # match the port the plugin is actually listening on
OBSIDIAN_USE_HTTPS=false  # set to true if you use HTTPS
```

> ⚠️ The plugin's defaults are `27123` (HTTP) / `27124` (HTTPS). Adjust to whatever you've configured.

## Wire it into an MCP client

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "uv",
      "args": [
        "--directory",
        "/absolute/path/to/obsidian-mcp",
        "run",
        "python",
        "main.py"
      ],
      "env": {
        "OBSIDIAN_API_KEY": "your key",
        "OBSIDIAN_HOST": "127.0.0.1",
        "OBSIDIAN_PORT": "27300",
        "OBSIDIAN_USE_HTTPS": "false"
      }
    }
  }
}
```

Restart Claude Desktop.

### Claude Code

```bash
claude mcp add obsidian -- uv --directory /absolute/path/to/obsidian-mcp run python main.py
```

Env vars are inherited from your shell, or you can inject them via `env` in `~/.claude/settings.json`.

### Manual / debugging

Run directly:

```bash
uv run python main.py
```

The server talks over stdio, so running it standalone will block waiting for an MCP client — that's expected.

## Available tools

| Tool | Description |
|---|---|
| `list_files(dir_path="")` | List markdown files in the vault root or a subdirectory |
| `get_file(file_path)` | Read the raw markdown of a note |
| `search_text(query, context_length=100)` | Full-text search, returns matches with surrounding context |
| `search_dataview(dql)` | Run a Dataview DQL query |
| `get_backlinks(file_path)` | List notes that link TO this note (incoming) |
| `get_outgoing_links(file_path)` | List notes this note links TO (outgoing) |
| `list_tags()` | List all tags with usage counts |
| `files_by_tag(tag)` | List files carrying a given tag |
| `append_note(file_path, content)` | Append to a note (creates the file if missing) |
| `write_note(file_path, content)` | Create or overwrite a note |

All `file_path` values are **relative to the vault root**, e.g. `notes/cors-2026-05-09.md`.

## Troubleshooting

**Can't connect / 403**: check that `OBSIDIAN_API_KEY` matches the plugin and the port is right.

**HTTPS certificate error**: Local REST API uses a self-signed cert. This project disables cert verification in `httpx` (`verify=False`) since traffic is local-only.

**Changes not picked up by Claude**: the MCP server is launched by the client. After editing code, restart Claude Desktop or reload the MCP server in Claude Code.

## License

MIT
