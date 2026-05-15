# mcp-obsidian

[English](./README.en.md) · **中文**

一个用 Python 实现的 MCP（Model Context Protocol）server，把 Obsidian 仓库通过 [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) 插件暴露给任何兼容 MCP 的客户端（Claude Desktop、Claude Code、Cursor 等），让 AI 可以读写你的笔记。

## 前置条件

1. **Obsidian** 已安装并打开了你要操作的 Vault
2. 在 Obsidian 里安装并启用社区插件 **Local REST API**
   - 设置 → Community plugins → Browse → 搜 "Local REST API" → Install → Enable
   - 启用后在插件设置里看到 **API Key**，记一下
   - 默认地址：`http://127.0.0.1:27123`（HTTP）或 `https://127.0.0.1:27124`（HTTPS）
3. **Python 3.12+** 和 [`uv`](https://github.com/astral-sh/uv)（推荐）

## 接入 MCP 客户端

不需要 clone 仓库，`uv` 会自动从 GitHub 拉取并缓存。

### Claude Desktop

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

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
        "OBSIDIAN_API_KEY": "你的 API Key",
        "OBSIDIAN_HOST": "127.0.0.1",
        "OBSIDIAN_PORT": "27300",
        "OBSIDIAN_USE_HTTPS": "false"
      }
    }
  }
}
```

改完重启 Claude Desktop。

### Claude Code

```bash
claude mcp add obsidian \
  --env OBSIDIAN_API_KEY=你的key \
  --env OBSIDIAN_HOST=127.0.0.1 \
  --env OBSIDIAN_PORT=27300 \
  --env OBSIDIAN_USE_HTTPS=false \
  -- uvx --from git+https://github.com/Valen-akm/obsidian-mcp.git mcp-obsidian
```

### 环境变量

| 变量 | 说明 | 默认 |
|---|---|---|
| `OBSIDIAN_API_KEY` | Local REST API 插件里的 key | `not-used-yet` |
| `OBSIDIAN_HOST` | 主机 | `127.0.0.1` |
| `OBSIDIAN_PORT` | 端口（看插件设置） | `27300` |
| `OBSIDIAN_USE_HTTPS` | 是否走 HTTPS | `false` |

> ⚠️ 插件默认端口是 `27123`（HTTP）/ `27124`（HTTPS），按你实际监听的填。

## 可用工具

| 工具 | 说明 |
|---|---|
| `list_files(dir_path="")` | 列出 vault 或子目录下的 markdown 文件 |
| `get_file(file_path)` | 读取笔记原文 |
| `search_text(query, context_length=100)` | 全文搜索，返回匹配上下文 |
| `search_dataview(dql)` | 执行 Dataview DQL 查询 |
| `get_backlinks(file_path)` | 列出反向链接（谁引用了这篇） |
| `get_outgoing_links(file_path)` | 列出这篇引用了谁 |
| `list_tags()` | 列出所有标签及使用次数 |
| `files_by_tag(tag)` | 按标签筛选文件 |
| `append_note(file_path, content)` | 追加内容到笔记末尾（不存在则创建） |
| `write_note(file_path, content)` | 创建或覆盖笔记 |

所有 `file_path` 都是**相对于 vault 根目录**的路径，例如 `经验-跨域-2026-05-09.md` 或 `子目录/笔记.md`。

## 本地开发

想改代码：

```bash
git clone https://github.com/Valen-akm/obsidian-mcp.git
cd obsidian-mcp
uv sync
cp .env.example .env       # 然后编辑填入你的 API Key
uv run mcp-obsidian        # 直接跑（stdio，会阻塞等 MCP 客户端连入）
```

把 MCP 客户端的 `command` 临时改成 `uv` + `args` 指向本地路径，就能边改边试：

```json
{
  "command": "uv",
  "args": ["--directory", "/绝对路径/到/obsidian-mcp", "run", "mcp-obsidian"]
}
```

## 常见问题

**连不上 / 403**：检查 `OBSIDIAN_API_KEY` 是不是插件里那一串，端口对不对。

**HTTPS 报证书错误**：Local REST API 用的是自签名证书，本项目里 `httpx` 已经关掉了证书校验（`verify=False`），仅本地使用安全。

**改完代码 Claude 没反应**：MCP server 由客户端拉起，改完代码要重启 Claude Desktop 或在 Claude Code 里 reload MCP server。如果用的是 `uvx --from git+...` 的方式，`uvx` 会缓存 git 版本，加 `--refresh` 或推 git 后重启即可。

## License

MIT
