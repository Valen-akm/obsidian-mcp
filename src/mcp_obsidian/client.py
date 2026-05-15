from __future__ import annotations

import os
from typing import Any

import httpx


class ObsidianClient:
    def __init__(
        self,
        api_key: str,
        host: str = "127.0.0.1",
        port: int = 27300,
        use_https: bool = False,
    ) -> None:
        scheme = "https" if use_https else "http"
        self._base_url = f"{scheme}://{host}:{port}"
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            headers={"Authorization": f"Bearer {api_key}"},
            verify=False,
            timeout=httpx.Timeout(15.0),
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _get(self, path: str, **kwargs: Any) -> httpx.Response:
        resp = await self._client.get(path, **kwargs)
        resp.raise_for_status()
        return resp

    async def _post(self, path: str, **kwargs: Any) -> httpx.Response:
        resp = await self._client.post(path, **kwargs)
        resp.raise_for_status()
        return resp

    async def _put(self, path: str, **kwargs: Any) -> httpx.Response:
        resp = await self._client.put(path, **kwargs)
        resp.raise_for_status()
        return resp

    async def server_info(self) -> dict[str, Any]:
        resp = await self._get("/")
        return resp.json()

    async def list_files(self, dir_path: str = "") -> list[str]:
        path = f"/vault/{dir_path.lstrip('/')}" if dir_path else "/vault/"
        resp = await self._get(path)
        return resp.json().get("files", [])

    async def get_file(self, file_path: str) -> str:
        resp = await self._get(
            f"/vault/{file_path.lstrip('/')}",
            headers={"Accept": "text/markdown"},
        )
        return resp.text

    async def append_to_file(self, file_path: str, content: str) -> None:
        await self._post(
            f"/vault/{file_path.lstrip('/')}",
            content=content,
            headers={"Content-Type": "text/markdown"},
        )

    async def put_file(self, file_path: str, content: str) -> None:
        await self._put(
            f"/vault/{file_path.lstrip('/')}",
            content=content,
            headers={"Content-Type": "text/markdown"},
        )

    async def search_simple(self, query: str, context_length: int = 100) -> list[dict[str, Any]]:
        resp = await self._post(
            "/search/simple/",
            params={"query": query, "contextLength": context_length},
        )
        return resp.json()

    async def search_dataview(self, dql: str) -> list[dict[str, Any]]:
        resp = await self._post(
            "/search/",
            content=dql,
            headers={"Content-Type": "application/vnd.olrapi.dataview.dql+txt"},
        )
        return resp.json()

    async def list_tags(self) -> list[dict[str, Any]]:
        resp = await self._get("/tags/")
        return resp.json()

    async def files_by_tag(self, tag: str) -> list[dict[str, Any]]:
        resp = await self._get(f"/tags/{tag.lstrip('#')}/")
        return resp.json()

    async def backlinks(self, file_path: str) -> list[str]:
        resp = await self._get(f"/backlinks/{file_path.lstrip('/')}/")
        return resp.json().get("files", [])

    async def outgoing_links(self, file_path: str) -> list[str]:
        resp = await self._get(f"/links/{file_path.lstrip('/')}/")
        return resp.json().get("files", [])

    async def active_note(self) -> dict[str, Any]:
        resp = await self._get("/active/")
        return resp.json()


def from_env() -> ObsidianClient:
    return ObsidianClient(
        api_key=os.environ.get("OBSIDIAN_API_KEY", "not-used-yet"),
        host=os.environ.get("OBSIDIAN_HOST", "127.0.0.1"),
        port=int(os.environ.get("OBSIDIAN_PORT", "27300")),
        use_https=os.environ.get("OBSIDIAN_USE_HTTPS", "false").lower() == "true",
    )
