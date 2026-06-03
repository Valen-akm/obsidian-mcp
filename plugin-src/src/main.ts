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

	// A one-line summary of a note for link lists: callers shouldn't have to fetch
	// each path just to learn its title/tags. Falls back to the path if the file
	// is missing (e.g. a link target that was since deleted).
	private noteBrief(p: string): { path: string; title: string; tags: string[] } {
		const f = this.app.vault.getAbstractFileByPath(p);
		if (!(f instanceof TFile)) return { path: p, title: p, tags: [] };
		const cache = this.app.metadataCache.getFileCache(f) ?? {};
		const h1 = (cache.headings ?? []).find((h) => h.level === 1);
		const inlineTags = (cache.tags ?? []).map((t) => t.tag.replace(/^#/, ""));
		const fmTags = normalizeTags((cache.frontmatter as any)?.tags);
		const tags = Array.from(new Set([...fmTags, ...inlineTags])).filter(
			(t) => !isHexColorTag(t)
		);
		return { path: p, title: h1?.heading ?? f.basename, tags };
	}

	// A backlink entry enriched with the sentence the link sits in — the most
	// useful half of Obsidian's backlink panel: not just WHO links here, but HOW.
	private async backlinkEntry(
		src: string,
		target: string
	): Promise<{ path: string; title: string; tags: string[]; context: string }> {
		const brief = this.noteBrief(src);
		const f = this.app.vault.getAbstractFileByPath(src);
		if (!(f instanceof TFile)) return { ...brief, context: "" };
		const cache = this.app.metadataCache.getFileCache(f);
		const link = (cache?.links ?? []).find((l) => {
			const base = l.link.split("|")[0].split("#")[0];
			const dest = this.app.metadataCache.getFirstLinkpathDest(base, src);
			return dest?.path === target;
		});
		if (!link?.position) return { ...brief, context: "" };
		const content = await this.app.vault.cachedRead(f);
		const s = Math.max(0, link.position.start.offset - 60);
		const e = Math.min(content.length, link.position.end.offset + 60);
		const context = content.slice(s, e).replace(/\s+/g, " ").trim();
		return { ...brief, context };
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
				const tags = Object.entries(raw)
					.map(([tag, count]) => ({ tag, count }))
					.filter((t) => !isHexColorTag(t.tag.replace(/^#/, "")));
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
				const files = [];
				for (const src of sources) {
					files.push(await this.backlinkEntry(src, target));
				}
				return json(res, { target, files });
			}

			if (method === "GET" && path.startsWith("/links/")) {
				const source = decodePath(path.slice("/links/".length).replace(/\/$/, ""));
				const resolved = this.app.metadataCache.resolvedLinks;
				const files = resolved[source] ? Object.keys(resolved[source]) : [];
				return json(res, { source, files: files.map((p) => this.noteBrief(p)) });
			}

			if (method === "GET" && path.startsWith("/neighborhood/")) {
				// Breadth-first walk out from `root` up to `depth` hops, returning the
				// whole subgraph in one call so callers don't have to hand-roll a BFS
				// (the N+1 trap with get_outgoing_links). With backlinks=true (default)
				// it follows links in BOTH directions, so you also reach notes that
				// reference the root, not just the ones it points at.
				const root = decodePath(path.slice("/neighborhood/".length).replace(/\/$/, ""));
				const depth = Math.min(
					Math.max(parseInt(url.searchParams.get("depth") ?? "2", 10) || 2, 1),
					4
				);
				const includeBack = url.searchParams.get("backlinks") !== "false";
				const resolved = this.app.metadataCache.resolvedLinks;
				const backAdj: Record<string, string[]> = {};
				if (includeBack) {
					for (const src of Object.keys(resolved)) {
						for (const tgt of Object.keys(resolved[src])) {
							if (tgt !== src) (backAdj[tgt] ??= []).push(src);
						}
					}
				}
				const nodeSet = new Set<string>([root]);
				const edgeSeen = new Set<string>();
				const edges: Array<{ from: string; to: string; refCount: number }> = [];
				const visited = new Set<string>([root]);
				let frontier = [root];
				for (let d = 0; d < depth; d++) {
					const next: string[] = [];
					for (const cur of frontier) {
						for (const [tgt, n] of Object.entries(resolved[cur] ?? {})) {
							if (tgt === cur) continue;
							const key = `${cur} ${tgt}`;
							if (!edgeSeen.has(key)) {
								edgeSeen.add(key);
								edges.push({ from: cur, to: tgt, refCount: n });
							}
							nodeSet.add(tgt);
							if (!visited.has(tgt)) {
								visited.add(tgt);
								next.push(tgt);
							}
						}
						if (includeBack) {
							for (const src of backAdj[cur] ?? []) {
								const key = `${src} ${cur}`;
								if (!edgeSeen.has(key)) {
									edgeSeen.add(key);
									edges.push({ from: src, to: cur, refCount: resolved[src][cur] });
								}
								nodeSet.add(src);
								if (!visited.has(src)) {
									visited.add(src);
									next.push(src);
								}
							}
						}
					}
					frontier = next;
				}
				const nodes = Array.from(nodeSet).map((p) => this.noteBrief(p));
				return json(res, { root, depth, includeBacklinks: includeBack, nodes, edges });
			}

			if (method === "GET" && path === "/graph/") {
				// Obsidian's raw link maps list EVERY note as a key (most with no edges)
				// and include self-links, which makes the graph hard to read. Clean it:
				// keep only sources inside `dir`, drop self-links, and omit nodes that
				// have no edges left. dir="" returns the whole (cleaned) graph.
				const dir = (url.searchParams.get("dir") ?? "").replace(/^\/+|\/+$/g, "");
				const prefix = dir ? `${dir}/` : "";
				const mc = this.app.metadataCache as any;
				const clean = (raw: Record<string, Record<string, number>>) => {
					const out: Record<string, Record<string, number>> = {};
					for (const src of Object.keys(raw ?? {})) {
						if (prefix && !src.startsWith(prefix)) continue;
						const edges: Record<string, number> = {};
						for (const [tgt, n] of Object.entries(raw[src])) {
							if (tgt !== src) edges[tgt] = n;
						}
						if (Object.keys(edges).length > 0) out[src] = edges;
					}
					return out;
				};
				return json(res, {
					dir,
					resolved: clean(mc.resolvedLinks),
					unresolved: clean(mc.unresolvedLinks),
				});
			}

			if (method === "GET" && path === "/index/") {
				// One level at a time, like a file browser: return the notes that live
				// directly in `dir`, plus a rolled-up count for each immediate subdir.
				// Default (dir="") is the vault root, so callers drill down on demand
				// instead of pulling every note in the tree at once.
				const dir = (url.searchParams.get("dir") ?? "").replace(/^\/+|\/+$/g, "");
				const prefix = dir ? `${dir}/` : "";
				const resolved = this.app.metadataCache.resolvedLinks;
				const backCount: Record<string, number> = {};
				for (const src of Object.keys(resolved)) {
					for (const tgt of Object.keys(resolved[src])) {
						backCount[tgt] = (backCount[tgt] ?? 0) + 1;
					}
				}
				const notes: Array<Record<string, unknown>> = [];
				const subdirCount: Record<string, number> = {};
				const subdirHasIndex: Record<string, boolean> = {};
				for (const f of this.app.vault.getMarkdownFiles()) {
					if (prefix && !f.path.startsWith(prefix)) continue;
					const rest = f.path.slice(prefix.length);
					const slash = rest.indexOf("/");
					if (slash >= 0) {
						const child = prefix + rest.slice(0, slash);
						subdirCount[child] = (subdirCount[child] ?? 0) + 1;
						// README directly under this subdir → flag it so callers know
						// where to start reading instead of enumerating every note.
						if (rest.slice(slash + 1) === "README.md") subdirHasIndex[child] = true;
						continue;
					}
					const cache = this.app.metadataCache.getFileCache(f) ?? {};
					const fm = cache.frontmatter ?? {};
					const inlineTags = (cache.tags ?? []).map((t) => t.tag.replace(/^#/, ""));
					const fmTags = normalizeTags((fm as any).tags);
					const tags = Array.from(new Set([...fmTags, ...inlineTags])).filter(
						(t) => !isHexColorTag(t)
					);
					const h1 = (cache.headings ?? []).find((h) => h.level === 1);
					notes.push({
						path: f.path,
						title: h1?.heading ?? f.basename,
						tags,
						frontmatter: scalarFrontmatter(fm as Record<string, unknown>),
						mtime: f.stat.mtime,
						dir,
						nOut: resolved[f.path] ? Object.keys(resolved[f.path]).length : 0,
						nBack: backCount[f.path] ?? 0,
					});
				}
				const dirs = Object.entries(subdirCount)
					.map(([d, count]) => ({ dir: d, count, hasIndex: subdirHasIndex[d] ?? false }))
					.sort((a, b) => a.dir.localeCompare(b.dir));
				return json(res, { dir, dirs, notes });
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
				// Split on whitespace and require EVERY term to match somewhere in the
				// note (content, title, or tags) — AND semantics, like Obsidian search.
				const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
				const results: Array<{ filename: string; score: number; context: string }> = [];
				for (const file of this.app.vault.getMarkdownFiles()) {
					const content = await this.app.vault.cachedRead(file);
					const contentLower = content.toLowerCase();
					const titleLower = file.basename.toLowerCase();
					const cache = this.app.metadataCache.getFileCache(file);
					const tagsLower = (cache?.tags ?? []).map((t) => t.tag.toLowerCase());
					let score = 0;
					let firstIdx = -1;
					const allMatched = terms.every((term) => {
						const idx = contentLower.indexOf(term);
						const inContent = idx >= 0;
						const inTitle = titleLower.includes(term);
						const inTags = tagsLower.some((t) => t.includes(term));
						if (!inContent && !inTitle && !inTags) return false;
						if (inContent && (firstIdx < 0 || idx < firstIdx)) firstIdx = idx;
						score += (inContent ? 1 : 0) + (inTitle ? 1 : 0) + (inTags ? 1 : 0);
						return true;
					});
					if (!allMatched) continue;
					let context = "";
					if (firstIdx >= 0) {
						const half = Math.floor(ctxLen / 2);
						const start = Math.max(0, firstIdx - half);
						context = content.slice(start, firstIdx + terms[0].length + half);
					}
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

// Notes that document color palettes write hex codes (#ffffff, #1a1a1a) in their
// body; Obsidian picks these up as tags and they swamp the real tag list. Drop
// 6-digit hex and 3-digit hex that contains a digit. Pure-letter short tags like
// #bad / #add / #fff are kept — a real word is far more likely than a 3-letter color.
function isHexColorTag(tag: string): boolean {
	if (/^[0-9a-fA-F]{6}$/.test(tag)) return true;
	if (/^[0-9a-fA-F]{3}$/.test(tag) && /[0-9]/.test(tag)) return true;
	return false;
}

// Keep only short scalar frontmatter values. Arrays/objects (e.g. full color-token
// maps in design notes) and long prose (description/vibe blurbs) bloat the index and
// are better fetched per-note via get_metadata. tags live in their own field, so
// frontmatter.tags is redundant here.
const MAX_SCALAR_LEN = 80;
function scalarFrontmatter(fm: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(fm)) {
		if (k === "tags" || k === "position") continue;
		if (typeof v === "string") {
			if (v.length <= MAX_SCALAR_LEN) out[k] = v;
		} else if (v === null || typeof v === "number" || typeof v === "boolean") {
			out[k] = v;
		}
	}
	return out;
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
