from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import FastMCP

from obsidian_client import from_env

mcp = FastMCP("obsidian")
_client = None


def client():
    global _client
    if _client is None:
        _client = from_env()
    return _client


@mcp.tool()
async def list_files(dir_path: str = "") -> list[str]:
    """List markdown files in the vault. Pass a sub-directory path to scope listing; leave empty for vault root."""
    return await client().list_files(dir_path)


@mcp.tool()
async def get_file(file_path: str) -> str:
    """Read the raw markdown content of a note. Path is relative to vault root, e.g. '经验-跨域与CORS-2026-05-09.md'."""
    return await client().get_file(file_path)


@mcp.tool()
async def search_text(query: str, context_length: int = 100) -> list[dict[str, Any]]:
    """Full-text search across the vault. Returns matched files with surrounding context snippets."""
    return await client().search_simple(query, context_length)


@mcp.tool()
async def search_dataview(dql: str) -> list[dict[str, Any]]:
    """Run a Dataview DQL query against the vault. Use for tag/link/frontmatter compound queries. Example DQL: 'LIST FROM #跨域'."""
    return await client().search_dataview(dql)


@mcp.tool()
async def get_backlinks(file_path: str) -> list[str]:
    """List notes that link TO the given note (incoming references). Path is relative to vault root."""
    return await client().backlinks(file_path)


@mcp.tool()
async def get_outgoing_links(file_path: str) -> list[str]:
    """List notes that the given note links TO (outgoing references)."""
    return await client().outgoing_links(file_path)


@mcp.tool()
async def list_tags() -> list[dict[str, Any]]:
    """List all tags in the vault with their usage counts."""
    return await client().list_tags()


@mcp.tool()
async def files_by_tag(tag: str) -> list[dict[str, Any]]:
    """List all files that carry the given tag. Strip leading '#'."""
    return await client().files_by_tag(tag)


@mcp.tool()
async def append_note(file_path: str, content: str) -> str:
    """Append markdown content to an existing note. Creates the file if it doesn't exist."""
    await client().append_to_file(file_path, content)
    return f"Appended to {file_path}"


@mcp.tool()
async def write_note(file_path: str, content: str) -> str:
    """Create or overwrite a note with the given content. Path is relative to vault root."""
    await client().put_file(file_path, content)
    return f"Wrote {file_path}"


if __name__ == "__main__":
    mcp.run()
