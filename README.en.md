# mcp-obsidian

**English** · [中文](./README.md)

Self-contained MCP server for Obsidian. One command installs the bundled bridge plugin into your vault; another launches the server for Claude Desktop, Claude Code, and other MCP clients. No third-party plugins required.

## Requirements

- Obsidian (≥ 1.5.0, desktop)
- [`uv`](https://github.com/astral-sh/uv): `brew install uv` or `curl -LsSf https://astral.sh/uv/install.sh | sh`

## Install

Drop the MCP Bridge plugin into your vault:

```bash
uvx --from git+https://github.com/Valen-akm/obsidian-mcp.git \
    mcp-obsidian-install /path/to/your/vault
```

Then in Obsidian:

1. Settings → Community plugins, turn off Restricted mode
2. Click the refresh icon under Installed plugins
3. Enable **MCP Bridge**
4. You should see the notice `MCP bridge online: 127.0.0.1:27300`

Add `--force` to overwrite an existing install.

## Run

```bash
uvx --from git+https://github.com/Valen-akm/obsidian-mcp.git mcp-obsidian
```

## Configure

**Claude Desktop** — edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "uvx",
      "args": ["--from", "git+https://github.com/Valen-akm/obsidian-mcp.git", "mcp-obsidian"]
    }
  }
}
```

**Claude Code**:

```bash
claude mcp add obsidian -- uvx --from git+https://github.com/Valen-akm/obsidian-mcp.git mcp-obsidian
```

Distributed directly from this repository; not published to PyPI. `uvx` caches the build under `~/.cache/uv/` after the first run. Pin a version with `git+...@v0.1.0` or `git+...@<sha>`; force a refresh with `uvx --refresh ...`.

## Environment

Only needed if you've changed the bridge plugin's default listening address:

| Variable | Default | Notes |
|---|---|---|
| `OBSIDIAN_HOST` | `127.0.0.1` | Host |
| `OBSIDIAN_PORT` | `27300` | Port |
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

Python side (MCP server):

```bash
git clone https://github.com/Valen-akm/obsidian-mcp.git
cd obsidian-mcp
uv sync
uv run mcp-obsidian
```

Point a client at the local checkout:

```json
{ "command": "uv", "args": ["--directory", "/abs/path/to/obsidian-mcp", "run", "mcp-obsidian"] }
```

Bridge plugin (TypeScript):

```bash
cd plugin-src
npm install
npm run build     # emits main.js; copy it to src/mcp_obsidian/plugin_dist/
```

## License

MIT
