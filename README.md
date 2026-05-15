# mcp-obsidian

[English](./README.en.md) · **中文**

通过 [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) 插件将 Obsidian 仓库暴露为 MCP server，供 Claude Desktop、Claude Code 等 MCP 客户端调用。

## 前置条件

- Obsidian 已启用 [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) 插件，记录其 API Key 与监听端口
- [`uv`](https://github.com/astral-sh/uv)：`brew install uv` 或 `curl -LsSf https://astral.sh/uv/install.sh | sh`

## 快速启动

无需 clone 仓库，一行命令直接拉起 server：

```bash
OBSIDIAN_API_KEY=你的key \
OBSIDIAN_HOST=127.0.0.1 \
OBSIDIAN_PORT=27123 \
OBSIDIAN_USE_HTTPS=false \
uvx --from git+https://github.com/Valen-akm/obsidian-mcp.git mcp-obsidian
```

首次运行 `uvx` 会拉取仓库并安装依赖，之后走缓存。MCP server 通过 stdio 通信，进程会**阻塞**等待客户端连入 —— 这是正常状态，按 `Ctrl+C` 退出。该命令主要用于验证安装可用；日常使用走下面的客户端配置。

## 接入

**Claude Desktop** — 编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

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

**Claude Code**：

```bash
claude mcp add obsidian \
  --env OBSIDIAN_API_KEY=... \
  --env OBSIDIAN_PORT=27123 \
  -- uvx --from git+https://github.com/Valen-akm/obsidian-mcp.git mcp-obsidian
```

包从本仓库直接分发，未发布至 PyPI。`uvx` 首次运行时会缓存到 `~/.cache/uv/`。锁定版本：`git+...@v0.1.0` 或 `git+...@<sha>`；强制更新：`uvx --refresh ...`。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `OBSIDIAN_API_KEY` | — | 插件中的 API Key（必填） |
| `OBSIDIAN_HOST` | `127.0.0.1` | 主机 |
| `OBSIDIAN_PORT` | `27300` | 端口；插件默认 `27123`（HTTP）/ `27124`（HTTPS） |
| `OBSIDIAN_USE_HTTPS` | `false` | 是否走 HTTPS |

## 工具

| 工具 | 说明 |
|---|---|
| `list_files(dir_path="")` | 列出 vault 或子目录下的 markdown 文件 |
| `get_file(file_path)` | 读取笔记原文 |
| `search_text(query, context_length=100)` | 全文搜索 |
| `search_dataview(dql)` | 执行 Dataview DQL 查询 |
| `get_backlinks(file_path)` | 反向链接 |
| `get_outgoing_links(file_path)` | 外向链接 |
| `list_tags()` | 列出所有标签及使用次数 |
| `files_by_tag(tag)` | 按标签筛选文件 |
| `append_note(file_path, content)` | 追加内容；文件不存在时创建 |
| `write_note(file_path, content)` | 创建或覆盖 |

所有 `file_path` 均相对于 vault 根目录。

## 本地开发

```bash
git clone https://github.com/Valen-akm/obsidian-mcp.git
cd obsidian-mcp
uv sync
cp .env.example .env   # 填入 API Key
uv run mcp-obsidian
```

将客户端配置切换至本地工作目录：

```json
{ "command": "uv", "args": ["--directory", "/abs/path/to/obsidian-mcp", "run", "mcp-obsidian"] }
```

## License

MIT
