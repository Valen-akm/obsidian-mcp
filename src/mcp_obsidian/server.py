from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import FastMCP

from .client import from_env

mcp = FastMCP("obsidian")
_client = None


def client():
    global _client
    if _client is None:
        _client = from_env()
    return _client


@mcp.tool()
async def list_files(dir_path: str = "", include_non_md: bool = False) -> list[str]:
    """List markdown files in the vault. Pass a sub-directory path to scope listing; leave empty for vault root. Set include_non_md=True to also list attachments (images, PDFs, canvas, etc.) so you don't miss non-markdown files."""
    return await client().list_files(dir_path, include_non_md)


@mcp.tool()
async def get_file(file_path: str) -> str:
    """Read the raw markdown content of a note. Path is relative to vault root, e.g. '经验-跨域与CORS-2026-05-09.md'."""
    return await client().get_file(file_path)


@mcp.tool()
async def search_text(query: str, context_length: int = 100) -> list[dict[str, Any]]:
    """Full-text search across the vault. Returns matched files with surrounding context snippets."""
    return await client().search_simple(query, context_length)


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
async def get_index() -> list[dict[str, Any]]:
    """Return a lightweight skeleton of EVERY note in the vault (no body text): path, title, tags, frontmatter, mtime, dir, and outgoing/backlink counts (nOut/nBack). Call this FIRST to get a global map of the vault before deciding what to read — it guarantees you never miss a note that keyword search wouldn't surface."""
    return await client().index()


@mcp.tool()
async def get_graph() -> dict[str, Any]:
    """Return the entire vault link graph in one call. 'resolved' is a weighted adjacency map {source: {target: refCount}}; 'unresolved' lists links pointing at notes that don't exist yet (broken/planned links). Use for multi-hop traversal, finding hubs, or spotting orphans without querying each note."""
    return await client().graph()


@mcp.tool()
async def get_metadata(file_path: str) -> dict[str, Any]:
    """Return structured metadata for one note without its body: frontmatter, tags, headings, outgoing links, and embeds. Use instead of parsing raw markdown from get_file."""
    return await client().metadata(file_path)


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


@mcp.tool()
async def rename_note(from_path: str, to_path: str) -> str:
    """Rename or move a note. Obsidian automatically updates all backlinks pointing to it, so prefer this over write_note when reorganizing the vault. Both paths are relative to vault root; moving = renaming into a different folder."""
    await client().rename(from_path, to_path)
    return f"Renamed {from_path} -> {to_path}"


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
