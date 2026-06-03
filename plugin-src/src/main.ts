import { Plugin, TFile, Notice } from "obsidian";
import http from "http";

const DEFAULT_PORT = 27300;
const HOST = "127.0.0.1";

export default class McpBridge extends Plugin {
	private server: http.Server | null = null;

	async onload() {
		this.server = http.createServer((req, res) => this.route(req, res));
		this.server.on("error", (err) => {
			console.error("[mcp-bridge] server error", err);
			new Notice(`MCP bridge failed: ${err.message}`);
		});
		this.server.listen(DEFAULT_PORT, HOST, () => {
			console.log(`[mcp-bridge] listening on http://${HOST}:${DEFAULT_PORT}`);
			new Notice(`MCP bridge online: ${HOST}:${DEFAULT_PORT}`);
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
				return json(res, { service: "obsidian-mcp-bridge", version: "0.1.0" });
			}

			if (method === "GET" && path === "/vault/") {
				const files = this.app.vault.getMarkdownFiles().map((f) => f.path);
				return json(res, { files });
			}

			if (method === "GET" && path.startsWith("/vault/")) {
				const sub = decodePath(path.slice("/vault/".length)).replace(/\/$/, "");
				const file = this.app.vault.getAbstractFileByPath(sub);
				if (file instanceof TFile) {
					const content = await this.app.vault.read(file);
					return text(res, 200, content, "text/markdown");
				}
				// Not a file: callers asking for markdown want a 404; otherwise list the folder.
				const wantsMarkdown = (req.headers["accept"] ?? "").includes("text/markdown");
				if (wantsMarkdown) return text(res, 404, `not found: ${sub}`);
				const prefix = sub ? `${sub}/` : "";
				const all = url.searchParams.get("all") === "true";
				const source = all ? this.app.vault.getFiles() : this.app.vault.getMarkdownFiles();
				const files = source.map((f) => f.path).filter((p) => p.startsWith(prefix));
				return json(res, { files });
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

			if (method === "POST" && path === "/rename/") {
				const body = await readBody(req);
				let payload: { from?: string; to?: string };
				try {
					payload = JSON.parse(body);
				} catch {
					return text(res, 400, "invalid JSON body");
				}
				const from = (payload.from ?? "").replace(/^\/+/, "");
				const to = (payload.to ?? "").replace(/^\/+/, "");
				if (!from || !to) return text(res, 400, "both 'from' and 'to' are required");
				const file = this.app.vault.getAbstractFileByPath(from);
				if (!(file instanceof TFile)) return text(res, 404, `not found: ${from}`);
				if (this.app.vault.getAbstractFileByPath(to)) {
					return text(res, 409, `target already exists: ${to}`);
				}
				await ensureFolder(this.app, to);
				await this.app.fileManager.renameFile(file, to);
				return json(res, { ok: true, from, to });
			}

			if (method === "GET" && path === "/tags/") {
				const raw = (this.app.metadataCache as any).getTags?.() ?? {};
				const tags = Object.entries(raw).map(([tag, count]) => ({ tag, count }));
				return json(res, tags);
			}

			if (method === "GET" && path.startsWith("/tags/")) {
				const tag = decodePath(path.slice("/tags/".length).replace(/\/$/, "")).replace(/^#/, "");
				const files: string[] = [];
				for (const file of this.app.vault.getMarkdownFiles()) {
					if (fileHasTag(this.app, file, tag)) files.push(file.path);
				}
				return json(res, files.map((p) => ({ path: p })));
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

			if (method === "GET" && path.startsWith("/links/")) {
				const source = decodePath(path.slice("/links/".length).replace(/\/$/, ""));
				const resolved = this.app.metadataCache.resolvedLinks;
				const files = resolved[source] ? Object.keys(resolved[source]) : [];
				return json(res, { source, files });
			}

			if (method === "GET" && path === "/graph/") {
				const mc = this.app.metadataCache as any;
				return json(res, {
					resolved: mc.resolvedLinks ?? {},
					unresolved: mc.unresolvedLinks ?? {},
				});
			}

			if (method === "GET" && path === "/index/") {
				const resolved = this.app.metadataCache.resolvedLinks;
				const backCount: Record<string, number> = {};
				for (const src of Object.keys(resolved)) {
					for (const tgt of Object.keys(resolved[src])) {
						backCount[tgt] = (backCount[tgt] ?? 0) + 1;
					}
				}
				const items = this.app.vault.getMarkdownFiles().map((f) => {
					const cache = this.app.metadataCache.getFileCache(f) ?? {};
					const fm = cache.frontmatter ?? {};
					const inlineTags = (cache.tags ?? []).map((t) => t.tag.replace(/^#/, ""));
					const fmTags = normalizeTags((fm as any).tags);
					const tags = Array.from(new Set([...fmTags, ...inlineTags]));
					const h1 = (cache.headings ?? []).find((h) => h.level === 1);
					const slash = f.path.lastIndexOf("/");
					return {
						path: f.path,
						title: h1?.heading ?? f.basename,
						tags,
						frontmatter: fm,
						mtime: f.stat.mtime,
						dir: slash >= 0 ? f.path.slice(0, slash) : "",
						nOut: resolved[f.path] ? Object.keys(resolved[f.path]).length : 0,
						nBack: backCount[f.path] ?? 0,
					};
				});
				return json(res, items);
			}

			if (method === "GET" && path.startsWith("/metadata/")) {
				const fp = decodePath(path.slice("/metadata/".length).replace(/\/$/, ""));
				const file = this.app.vault.getAbstractFileByPath(fp);
				if (!(file instanceof TFile)) return text(res, 404, `not found: ${fp}`);
				const cache = this.app.metadataCache.getFileCache(file) ?? {};
				return json(res, {
					path: fp,
					frontmatter: cache.frontmatter ?? {},
					tags: (cache.tags ?? []).map((t) => t.tag.replace(/^#/, "")),
					headings: (cache.headings ?? []).map((h) => ({ heading: h.heading, level: h.level })),
					links: (cache.links ?? []).map((l) => l.link),
					embeds: (cache.embeds ?? []).map((e) => e.link),
				});
			}

			if (method === "POST" && path === "/search/simple/") {
				const query = url.searchParams.get("query") ?? "";
				if (!query) return json(res, []);
				const ctxLen = parseInt(url.searchParams.get("contextLength") ?? "100", 10);
				const q = query.toLowerCase();
				const results: Array<{ filename: string; score: number; context: string }> = [];
				for (const file of this.app.vault.getMarkdownFiles()) {
					const content = await this.app.vault.cachedRead(file);
					const idx = content.toLowerCase().indexOf(q);
					const titleHit = file.basename.toLowerCase().includes(q);
					const cache = this.app.metadataCache.getFileCache(file);
					const tagHit = (cache?.tags ?? []).some((t) => t.tag.toLowerCase().includes(q));
					if (idx < 0 && !titleHit && !tagHit) continue;
					let context = "";
					if (idx >= 0) {
						const start = Math.max(0, idx - Math.floor(ctxLen / 2));
						context = content.slice(start, idx + query.length + Math.floor(ctxLen / 2));
					}
					const score = (idx >= 0 ? 1 : 0) + (titleHit ? 1 : 0) + (tagHit ? 1 : 0);
					results.push({ filename: file.path, score, context });
				}
				results.sort((a, b) => b.score - a.score);
				return json(res, results);
			}

			return text(res, 404, `no route: ${method} ${path}`);
		} catch (err: any) {
			console.error("[mcp-bridge] handler error", err);
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

function normalizeTags(value: unknown): string[] {
	if (!value) return [];
	const list = Array.isArray(value) ? value : String(value).split(/[,\s]+/);
	return list.map((t) => String(t).replace(/^#/, "")).filter(Boolean);
}

function tagMatches(candidate: string, query: string): boolean {
	return candidate === query || candidate.startsWith(`${query}/`);
}

function fileHasTag(app: any, file: TFile, query: string): boolean {
	const cache = app.metadataCache.getFileCache(file);
	if (!cache) return false;
	const inline = (cache.tags ?? []).some((t: any) => tagMatches(t.tag.replace(/^#/, ""), query));
	const fm = normalizeTags(cache.frontmatter?.tags).some((t) => tagMatches(t, query));
	return inline || fm;
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
