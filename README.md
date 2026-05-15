# mcp-obsidian

一个用 Python 实现的 MCP（Model Context Protocol）server，把 Obsidian 仓库通过 [Obsidian Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) 插件暴露给任何兼容 MCP 的客户端（Claude Desktop、Claude Code、Cursor 等），让 AI 可以读写你的笔记。

## 前置条件

1. **Obsidian** 已安装并打开了你要操作的 Vault
2. 在 Obsidian 里安装并启用社区插件 **Local REST API**
   - 设置 → Community plugins → Browse → 搜 "Local REST API" → Install → Enable
   - 启用后在插件设置里看到 **API Key**，记一下
   - 默认地址：`http://127.0.0.1:27123`（HTTP）或 `https://127.0.0.1:27124`（HTTPS）
3. **Python 3.12+** 和 [`uv`](https://github.com/astral-sh/uv)（推荐）或 `pip`

## 安装

```bash
git clone https://github.com/Valen-akm/obsidian-mcp.git
cd obsidian-mcp
uv sync
```

或者用 pip：

```bash
pip install -e .
```

## 配置

复制环境变量模板：

```bash
cp .env.example .env
```

编辑 `.env`，填入你的 Obsidian Local REST API 信息：

```env
OBSIDIAN_API_KEY=你在插件设置里看到的 API Key
OBSIDIAN_HOST=127.0.0.1
OBSIDIAN_PORT=27300       # 看插件设置里实际监听的端口
OBSIDIAN_USE_HTTPS=false  # 用 HTTPS 改成 true
```

> ⚠️ 默认端口是 `27123`（HTTP）/ `27124`（HTTPS），如果你改过插件设置，按实际填。

## 接入 MCP 客户端

### Claude Desktop

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "uv",
      "args": [
        "--directory",
        "/绝对路径/到/obsidian-mcp",
        "run",
        "python",
        "main.py"
      ],
      "env": {
        "OBSIDIAN_API_KEY": "你的 key",
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
claude mcp add obsidian -- uv --directory /绝对路径/到/obsidian-mcp run python main.py
```

环境变量从 shell 继承，或者在 `~/.claude/settings.json` 里通过 `env` 注入。

### 手动调试

直接跑：

```bash
uv run python main.py
```

server 通过 stdio 通信，单独跑会阻塞等待 MCP 客户端连接，正常现象。

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

## 常见问题

**连不上 / 403**：检查 `OBSIDIAN_API_KEY` 是不是插件里那一串，端口对不对。

**HTTPS 报证书错误**：Local REST API 用的是自签名证书，本项目里 `httpx` 已经关掉了证书校验（`verify=False`），仅本地使用安全。

**修改后 Claude 那边没反应**：MCP server 是在客户端启动时拉起的，改完代码要重启 Claude Desktop / 重新加载 MCP server。

## License

MIT
