import { Plugin, TFile, Notice } from "obsidian";
import http from "http";

const DEFAULT_PORT = 27300;
const HOST = "127.0.0.1";

export default class TiworkBridge extends Plugin {
	private server: http.Server | null = null;

	async onload() {
		this.server = http.createServer((req, res) => this.route(req, res));
		this.server.on("error", (err) => {
			console.error("[tiwork-bridge] server error", err);
			new Notice(`Tiwork bridge failed: ${err.message}`);
		});
		this.server.listen(DEFAULT_PORT, HOST, () => {
			console.log(`[tiwork-bridge] listening on http://${HOST}:${DEFAULT_PORT}`);
			new Notice(`Tiwork bridge online: ${HOST}:${DEFAULT_PORT}`);
		});
	}

	async onunload() {
		if (this.server) {
			this.server.close();
			this.server = null;
		}
	}

	private async route(req: http.IncomingMessage, res: http.ServerResponse) {
		try {
			const url = new URL(req.url ?? "/", `http://${HOST}`);
			const path = url.pathname;
			const method = req.method ?? "GET";

			if (method === "GET" && path === "/") {
				return json(res, { service: "obsidian-tiwork-bridge", version: "0.1.0" });
			}

			if (method === "GET" && path === "/vault/") {
				const files = this.app.vault.getMarkdownFiles().map((f) => f.path);
				return json(res, { files });
			}

			if (method === "GET" && path.startsWith("/vault/")) {
				const filePath = decodePath(path.slice("/vault/".length));
				const file = this.app.vault.getAbstractFileByPath(filePath);
				if (!(file instanceof TFile)) return text(res, 404, `not found: ${filePath}`);
				const content = await this.app.vault.read(file);
				return text(res, 200, content, "text/markdown");
			}

			if (method === "POST" && path.startsWith("/vault/")) {
				const filePath = decodePath(path.slice("/vault/".length));
				const body = await readBody(req);
				const existing = this.app.vault.getAbstractFileByPath(filePath);
				if (existing instanceof TFile) {
					const cur = await this.app.vault.read(existing);
					await this.app.vault.modify(existing, cur + body);
				} else {
					await ensureFolder(this.app, filePath);
					await this.app.vault.create(filePath, body);
				}
				return json(res, { ok: true, path: filePath });
			}

			if (method === "PUT" && path.startsWith("/vault/")) {
				const filePath = decodePath(path.slice("/vault/".length));
				const body = await readBody(req);
				const existing = this.app.vault.getAbstractFileByPath(filePath);
				if (existing instanceof TFile) {
					await this.app.vault.modify(existing, body);
				} else {
					await ensureFolder(this.app, filePath);
					await this.app.vault.create(filePath, body);
				}
				return json(res, { ok: true, path: filePath });
			}

			if (method === "GET" && path === "/tags/") {
				const raw = (this.app.metadataCache as any).getTags?.() ?? {};
				const tags = Object.entries(raw).map(([tag, count]) => ({ tag, count }));
				return json(res, tags);
			}

			if (method === "GET" && path.startsWith("/backlinks/")) {
				const target = decodePath(path.slice("/backlinks/".length).replace(/\/$/, ""));
				const resolved = this.app.metadataCache.resolvedLinks;
				const sources: string[] = [];
				for (const source of Object.keys(resolved)) {
					if (resolved[source] && target in resolved[source]) {
						sources.push(source);
					}
				}
				return json(res, { target, files: sources });
			}

			if (method === "POST" && path === "/search/simple/") {
				const query = url.searchParams.get("query") ?? "";
				if (!query) return json(res, []);
				const results: Array<{ filename: string; score: number }> = [];
				for (const file of this.app.vault.getMarkdownFiles()) {
					const content = await this.app.vault.cachedRead(file);
					if (content.toLowerCase().includes(query.toLowerCase())) {
						results.push({ filename: file.path, score: 1 });
					}
				}
				return json(res, results);
			}

			return text(res, 404, `no route: ${method} ${path}`);
		} catch (err: any) {
			console.error("[tiwork-bridge] handler error", err);
			return text(res, 500, err?.message ?? "internal error");
		}
	}
}

function json(res: http.ServerResponse, body: unknown) {
	res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(body));
}

function text(res: http.ServerResponse, status: number, body: string, type = "text/plain; charset=utf-8") {
	res.writeHead(status, { "Content-Type": type });
	res.end(body);
}

function decodePath(raw: string): string {
	return decodeURIComponent(raw.replace(/^\/+/, ""));
}

async function readBody(req: http.IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on("data", (chunk: Buffer) => chunks.push(chunk));
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
		req.on("error", reject);
	});
}

async function ensureFolder(app: any, filePath: string): Promise<void> {
	const idx = filePath.lastIndexOf("/");
	if (idx < 0) return;
	const dir = filePath.slice(0, idx);
	if (!dir) return;
	const existing = app.vault.getAbstractFileByPath(dir);
	if (existing) return;
	await app.vault.createFolder(dir);
}
