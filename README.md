# mcp-obsidian

[English](./README.en.md) · **中文**

自带 Obsidian 桥接插件的 MCP server。一条命令装好插件，另一条命令拉起 server，供 Claude Desktop、Claude Code 等 MCP 客户端调用。无需第三方依赖。

## 前置条件

- Obsidian（≥ 1.5.0，桌面版）
- [`uv`](https://github.com/astral-sh/uv)：`brew install uv` 或 `curl -LsSf https://astral.sh/uv/install.sh | sh`

## 安装

将 MCP Bridge 插件装进你的 Vault：

```bash
uvx --from git+https://github.com/Valen-akm/obsidian-mcp.git \
    mcp-obsidian-install /path/to/your/vault
```

然后在 Obsidian 中：

1. 设置 → Community plugins，关闭 Restricted mode
2. 在 Installed plugins 列表点刷新图标
3. 启用 **MCP Bridge**
4. 看到通知 `MCP bridge online: 127.0.0.1:27300` 即就绪

重装或升级插件加 `--force` 覆盖。

## 启动

```bash
uvx --from git+https://github.com/Valen-akm/obsidian-mcp.git mcp-obsidian
```

## 接入

**Claude Desktop** — 编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

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

**Claude Code**：

```bash
claude mcp add obsidian -- uvx --from git+https://github.com/Valen-akm/obsidian-mcp.git mcp-obsidian
```

包从本仓库直接分发，未发布至 PyPI。`uvx` 首次运行时会缓存至 `~/.cache/uv/`。锁定版本：`git+...@v0.1.0` 或 `git+...@<sha>`；强制更新：`uvx --refresh ...`。

## 环境变量

仅在你修改了桥接插件默认监听地址时才需要：

| 变量 | 默认 | 说明 |
|---|---|---|
| `OBSIDIAN_HOST` | `127.0.0.1` | 主机 |
| `OBSIDIAN_PORT` | `27300` | 端口 |
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

Python 端（MCP server）：

```bash
git clone https://github.com/Valen-akm/obsidian-mcp.git
cd obsidian-mcp
uv sync
uv run mcp-obsidian
```

将客户端 `command` 切换至本地：

```json
{ "command": "uv", "args": ["--directory", "/abs/path/to/obsidian-mcp", "run", "mcp-obsidian"] }
```

Bridge 插件（TypeScript）：

```bash
cd plugin-src
npm install
npm run build     # 产物输出到 main.js，需手动复制到 src/mcp_obsidian/plugin_dist/
```

## License

MIT
