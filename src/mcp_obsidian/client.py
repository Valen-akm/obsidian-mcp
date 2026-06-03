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
            trust_env=False,
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

    async def list_files(self, dir_path: str = "", include_non_md: bool = False) -> list[str]:
        path = f"/vault/{dir_path.lstrip('/')}" if dir_path else "/vault/"
        params = {"all": "true"} if include_non_md else None
        resp = await self._get(path, params=params)
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

    async def list_tags(self) -> list[dict[str, Any]]:
        resp = await self._get("/tags/")
        return resp.json()

    async def files_by_tag(self, tag: str) -> list[dict[str, Any]]:
        resp = await self._get(f"/tags/{tag.lstrip('#')}/")
        return resp.json()

    async def backlinks(self, file_path: str) -> list[dict[str, Any]]:
        resp = await self._get(f"/backlinks/{file_path.lstrip('/')}/")
        return resp.json().get("files", [])

    async def outgoing_links(self, file_path: str) -> list[dict[str, Any]]:
        resp = await self._get(f"/links/{file_path.lstrip('/')}/")
        return resp.json().get("files", [])

    async def neighborhood(
        self, file_path: str, depth: int = 2, include_backlinks: bool = True
    ) -> dict[str, Any]:
        params = {"depth": str(depth), "backlinks": "true" if include_backlinks else "false"}
        resp = await self._get(f"/neighborhood/{file_path.lstrip('/')}/", params=params)
        return resp.json()

    async def index(self, dir: str = "") -> dict[str, Any]:
        params = {"dir": dir} if dir else None
        resp = await self._get("/index/", params=params)
        return resp.json()

    async def graph(self, dir: str = "") -> dict[str, Any]:
        params = {"dir": dir} if dir else None
        resp = await self._get("/graph/", params=params)
        return resp.json()

    async def metadata(self, file_path: str) -> dict[str, Any]:
        resp = await self._get(f"/metadata/{file_path.lstrip('/')}")
        return resp.json()

    async def rename(self, from_path: str, to_path: str) -> dict[str, Any]:
        resp = await self._post(
            "/rename/",
            json={"from": from_path.lstrip("/"), "to": to_path.lstrip("/")},
        )
        return resp.json()

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
