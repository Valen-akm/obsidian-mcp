# mcp-obsidian

**English** · [中文](./README.md)

MCP server that exposes an Obsidian vault to MCP clients (Claude Desktop, Claude Code, etc.) via the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin.

## Requirements

- Obsidian with the [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin enabled; note its API key and port
- [`uv`](https://github.com/astral-sh/uv): `brew install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`

## Configure

**Claude Desktop** — edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/Valen-akm/obsidian-mcp.git", "mcp-obsidian"],
      "env": {
        "OBSIDIAN_API_KEY": "...",
        "OBSIDIAN_HOST": "127.0.0.1",
        "OBSIDIAN_PORT": "27123",
        "OBSIDIAN_USE_HTTPS": "false"
      }
    }
  }
}
```

**Claude Code**:

```bash
claude mcp add obsidian \
  --env OBSIDIAN_API_KEY=... \
  --env OBSIDIAN_PORT=27123 \
  -- uvx --from git+https://github.com/Valen-akm/obsidian-mcp.git mcp-obsidian
```

Distributed directly from this repository; not published to PyPI. `uvx` caches the build under `~/.cache/uv/` after the first run. Pin a version with `git+...@v0.1.0` or `git+...@<sha>`; force a refresh with `uvx --refresh ...`.

## Environment

| Variable | Default | Notes |
|---|---|---|
| `OBSIDIAN_API_KEY` | — | Plugin API key (required) |
| `OBSIDIAN_HOST` | `127.0.0.1` | Host |
| `OBSIDIAN_PORT` | `27300` | Port; plugin defaults are `27123` (HTTP) / `27124` (HTTPS) |
| `OBSIDIAN_USE_HTTPS` | `false` | Use HTTPS |

## Tools

| Tool | Description |
|---|---|
| `list_files(dir_path="")` | List markdown files in the vault or a subdirectory |
| `get_file(file_path)` | Read the raw markdown of a note |
| `search_text(query, context_length=100)` | Full-text search |
| `search_dataview(dql)` | Run a Dataview DQL query |
| `get_backlinks(file_path)` | Incoming links |
| `get_outgoing_links(file_path)` | Outgoing links |
| `list_tags()` | All tags with usage counts |
| `files_by_tag(tag)` | Files carrying a given tag |
| `append_note(file_path, content)` | Append content; creates the file if missing |
| `write_note(file_path, content)` | Create or overwrite |

All `file_path` values are relative to the vault root.

## Development

```bash
git clone https://github.com/Valen-akm/obsidian-mcp.git
cd obsidian-mcp
uv sync
cp .env.example .env   # fill in your API key
uv run mcp-obsidian
```

Point a client at the local checkout:

```json
{ "command": "uv", "args": ["--directory", "/abs/path/to/obsidian-mcp", "run", "mcp-obsidian"] }
```

## License

MIT
