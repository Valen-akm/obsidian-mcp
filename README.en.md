# mcp-obsidian

**English** · [中文](./README.md)

A Python implementation of an MCP (Model Context Protocol) server that exposes your Obsidian vault — via the [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin — to any MCP-compatible client (Claude Desktop, Claude Code, Cursor, etc.), letting an AI read and write your notes.

## Where the package comes from

This package is **distributed directly from this GitHub repo**. It is not on PyPI (yet).

All the client configs below invoke it via `uvx --from git+https://github.com/Valen-akm/obsidian-mcp.git mcp-obsidian`. Under the hood, `uvx` will:

1. Clone the repo into a cache location under `~/.cache/uv/` (only on first run; subsequent runs hit the cache)
2. Create an ephemeral virtual environment and install the declared dependencies (`httpx`, `mcp[cli]`)
3. Execute the registered entry point `mcp-obsidian` (= `mcp_obsidian.server:main`)

**End users don't need to `git clone` anything** or run `pip install` manually — they just need [`uv`](https://github.com/astral-sh/uv):

```bash
# macOS
brew install uv
# or cross-platform
curl -LsSf https://astral.sh/uv/install.sh | sh
```

To pin to a specific version, append a git ref to the URL:

```
git+https://github.com/Valen-akm/obsidian-mcp.git@v0.1.0
git+https://github.com/Valen-akm/obsidian-mcp.git@<commit-sha>
```

To force an update, add `--refresh`: `uvx --refresh --from git+... mcp-obsidian`.

## Prerequisites

1. **Obsidian** installed, with the vault you want to expose currently open.
2. The **Local REST API** community plugin installed and enabled:
   - Settings → Community plugins → Browse → search "Local REST API" → Install → Enable
   - Note the **API Key** shown in the plugin settings
   - Defaults to `http://127.0.0.1:27123` (HTTP) or `https://127.0.0.1:27124` (HTTPS)
3. **Python 3.12+** and [`uv`](https://github.com/astral-sh/uv) (recommended)

## Wire it into an MCP client

No need to clone the repo — `uv` will fetch and cache from GitHub automatically.

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "uvx",
      "args": [
        "--from",
        "git+https://github.com/Valen-akm/obsidian-mcp.git",
        "mcp-obsidian"
      ],
      "env": {
        "OBSIDIAN_API_KEY": "your-api-key",
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
claude mcp add obsidian \
  --env OBSIDIAN_API_KEY=your-key \
  --env OBSIDIAN_HOST=127.0.0.1 \
  --env OBSIDIAN_PORT=27300 \
  --env OBSIDIAN_USE_HTTPS=false \
  -- uvx --from git+https://github.com/Valen-akm/obsidian-mcp.git mcp-obsidian
```

### Environment variables

| Variable | Description | Default |
|---|---|---|
| `OBSIDIAN_API_KEY` | API key from the Local REST API plugin | `not-used-yet` |
| `OBSIDIAN_HOST` | Host | `127.0.0.1` |
| `OBSIDIAN_PORT` | Port (check plugin settings) | `27300` |
| `OBSIDIAN_USE_HTTPS` | Use HTTPS | `false` |

> ⚠️ Plugin defaults are `27123` (HTTP) / `27124` (HTTPS). Match whatever it's actually listening on.

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

## Local development

To hack on the code:

```bash
git clone https://github.com/Valen-akm/obsidian-mcp.git
cd obsidian-mcp
uv sync
cp .env.example .env       # then fill in your API key
uv run mcp-obsidian        # runs over stdio, blocks waiting for an MCP client
```

To point your MCP client at your local checkout for live editing:

```json
{
  "command": "uv",
  "args": ["--directory", "/absolute/path/to/obsidian-mcp", "run", "mcp-obsidian"]
}
```

## Troubleshooting

**Can't connect / 403**: check that `OBSIDIAN_API_KEY` matches the plugin and the port is right.

**HTTPS certificate error**: Local REST API uses a self-signed cert. This project disables cert verification in `httpx` (`verify=False`) since traffic is local-only.

**Changes not picked up by Claude**: the MCP server is launched by the client. After editing code, restart Claude Desktop or reload the MCP server in Claude Code. If you're using `uvx --from git+...`, `uvx` caches by git ref — add `--refresh` or push to git and restart.

## License

MIT
