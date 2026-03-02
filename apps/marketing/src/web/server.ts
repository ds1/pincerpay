import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  listContent,
  findContentById,
  moveContent,
  updateBody,
  countByStatus,
} from "../lib/content-store.js";
import { isChannelConfigured } from "../lib/env.js";
import type { ContentFile, ContentStatus, Channel } from "../types/index.js";
import dayjs from "dayjs";

const DASHBOARD_HTML = path.resolve(import.meta.dirname, "dashboard.html");
const PROJECT_ROOT = path.resolve(import.meta.dirname, "../..");
const DEFAULT_PORT = 3847;

const ALLOWED_COMMANDS: Record<string, { args: string[]; description: string }> = {
  generate:  { args: ["generate"],        description: "Generate content from calendar" },
  status:    { args: ["status"],           description: "Pipeline overview" },
  calendar:  { args: ["calendar"],         description: "View content calendar" },
  analytics: { args: ["analytics", "pull"], description: "Pull platform metrics" },
  report:    { args: ["report"],           description: "Generate KPI report" },
  publish:   { args: ["publish", "--manual", "--yes"], description: "Publish approved content" },
};

function json(res: http.ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function error(res: http.ServerResponse, message: string, status = 400): void {
  json(res, { error: message }, status);
}

async function readBody(req: http.IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf-8");
}

function parseJson(body: string): Record<string, unknown> | null {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  // CORS for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Serve dashboard
  if (req.method === "GET" && pathname === "/") {
    try {
      const html = fs.readFileSync(DASHBOARD_HTML, "utf-8");
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
    } catch {
      error(res, "Dashboard HTML not found", 500);
    }
    return;
  }

  // API: counts
  if (req.method === "GET" && pathname === "/api/counts") {
    json(res, countByStatus());
    return;
  }

  // API: list content
  if (req.method === "GET" && pathname === "/api/content") {
    const status = (url.searchParams.get("status") ?? "draft") as ContentStatus;
    const channel = url.searchParams.get("channel") as Channel | null;
    const items = listContent(status, { channel: channel ?? undefined });
    json(res, items.map(serializeItem));
    return;
  }

  // API: single content item by ID
  const idMatch = pathname.match(/^\/api\/content\/([^/]+)$/);
  if (req.method === "GET" && idMatch) {
    const item = findContentById(decodeURIComponent(idMatch[1]));
    if (!item) return error(res, "Not found", 404);
    json(res, serializeItem(item));
    return;
  }

  // API: approve
  const approveMatch = pathname.match(/^\/api\/content\/([^/]+)\/approve$/);
  if (req.method === "POST" && approveMatch) {
    const item = findContentById(decodeURIComponent(approveMatch[1]));
    if (!item) return error(res, "Not found", 404);
    if (item.frontmatter.status !== "draft") return error(res, "Only drafts can be approved");
    const newPath = moveContent(item.filepath, "approved");
    const updated = findContentById(item.frontmatter.id);
    json(res, updated ? serializeItem(updated) : { filepath: newPath });
    return;
  }

  // API: reject
  const rejectMatch = pathname.match(/^\/api\/content\/([^/]+)\/reject$/);
  if (req.method === "POST" && rejectMatch) {
    handleAsync(req, res, async () => {
      const item = findContentById(decodeURIComponent(rejectMatch[1]));
      if (!item) return error(res, "Not found", 404);
      if (item.frontmatter.status !== "draft") return error(res, "Only drafts can be rejected");
      const body = parseJson(await readBody(req));
      const reason = (body?.reason as string) ?? "";
      const newPath = moveContent(item.filepath, "rejected", { rejection_reason: reason });
      const updated = findContentById(item.frontmatter.id);
      json(res, updated ? serializeItem(updated) : { filepath: newPath });
    });
    return;
  }

  // API: check if channel API is configured
  if (req.method === "GET" && pathname === "/api/channels") {
    const channels: Record<string, boolean> = {};
    for (const ch of ["twitter", "reddit", "youtube", "discord", "blog"]) {
      channels[ch] = isChannelConfigured(ch);
    }
    json(res, channels);
    return;
  }

  // API: publish (auto via platform API, or manual fallback)
  const publishMatch = pathname.match(/^\/api\/content\/([^/]+)\/publish$/);
  if (req.method === "POST" && publishMatch) {
    handleAsync(req, res, async () => {
      const item = findContentById(decodeURIComponent(publishMatch[1]));
      if (!item) return error(res, "Not found", 404);
      if (item.frontmatter.status !== "approved") return error(res, "Only approved content can be published");
      const body = parseJson(await readBody(req));
      const manual = body?.manual === true;
      const manualUrl = (body?.platform_url as string) || "manual";

      const channel = item.frontmatter.channel;
      const canAutoPublish = !manual && isChannelConfigured(channel);

      let platformId: string | null = null;
      let platformUrl: string = manualUrl;

      if (canAutoPublish) {
        const result = await autoPublish(item);
        platformId = result.platform_id ?? null;
        platformUrl = result.platform_url ?? "published";
      }

      moveContent(item.filepath, "published", {
        platform_id: platformId,
        platform_url: platformUrl,
        published_at: dayjs().toISOString(),
      });
      const updated = findContentById(item.frontmatter.id);
      json(res, {
        ...(updated ? serializeItem(updated) : { success: true }),
        auto_published: canAutoPublish,
        platform_url: platformUrl,
      });
    });
    return;
  }

  // API: edit body
  const bodyMatch = pathname.match(/^\/api\/content\/([^/]+)\/body$/);
  if (req.method === "PUT" && bodyMatch) {
    handleAsync(req, res, async () => {
      const item = findContentById(decodeURIComponent(bodyMatch[1]));
      if (!item) return error(res, "Not found", 404);
      const body = parseJson(await readBody(req));
      if (!body?.body || typeof body.body !== "string") return error(res, "body field required");
      updateBody(item.filepath, body.body as string);
      const updated = findContentById(item.frontmatter.id);
      json(res, updated ? serializeItem(updated) : { success: true });
    });
    return;
  }

  // API: list available commands
  if (req.method === "GET" && pathname === "/api/commands") {
    const cmds = Object.entries(ALLOWED_COMMANDS).map(([id, c]) => ({ id, description: c.description }));
    json(res, cmds);
    return;
  }

  // API: run CLI command (SSE stream)
  if (req.method === "POST" && pathname === "/api/run") {
    handleAsync(req, res, async () => {
      const body = parseJson(await readBody(req));
      const cmdId = body?.command as string;
      const extraArgs = (body?.args as string[] | undefined) ?? [];

      const cmd = cmdId ? ALLOWED_COMMANDS[cmdId] : undefined;
      if (!cmd) return error(res, `Unknown command: ${cmdId}`);

      // Validate extra args are safe flags
      for (const arg of extraArgs) {
        if (!arg.startsWith("-") && !arg.startsWith("week-") && !/^[\w.:-]+$/.test(arg)) {
          return error(res, `Invalid argument: ${arg}`);
        }
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      });

      const sendEvent = (event: string, data: string) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const allArgs = ["--no-warnings", "src/cli/index.ts", ...cmd.args, ...extraArgs];
      const child = spawn("npx", ["tsx", ...allArgs], {
        cwd: PROJECT_ROOT,
        shell: true,
        env: { ...process.env, FORCE_COLOR: "0" },
      });

      child.stdout.on("data", (chunk: Buffer) => sendEvent("stdout", chunk.toString()));
      child.stderr.on("data", (chunk: Buffer) => sendEvent("stderr", chunk.toString()));

      child.on("close", (code) => {
        sendEvent("done", String(code ?? 0));
        res.end();
      });

      child.on("error", (err) => {
        sendEvent("error", err.message);
        res.end();
      });

      // Kill after 10 minutes (generate can take several minutes for multiple API calls)
      const timeout = setTimeout(() => {
        child.kill();
        sendEvent("error", "Command timed out after 10 minutes");
        res.end();
      }, 600_000);

      res.on("close", () => {
        clearTimeout(timeout);
        child.kill();
      });
    });
    return;
  }

  error(res, "Not found", 404);
}

function handleAsync(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  fn: () => Promise<void>
): void {
  fn().catch((err) => {
    error(res, err instanceof Error ? err.message : String(err), 500);
  });
}

function serializeItem(item: ContentFile) {
  return {
    ...(item.frontmatter as unknown as Record<string, unknown>),
    body: item.body,
    filepath: item.filepath,
  };
}

async function autoPublish(item: ContentFile): Promise<{ platform_id?: string; platform_url?: string }> {
  const channel = item.frontmatter.channel;
  // Strip code fences the LLM sometimes wraps output in
  const text = item.body.trim().replace(/^```[\w]*\n?/, "").replace(/\n?```$/, "").trim();

  switch (channel) {
    case "twitter": {
      const { postTweet } = await import("../lib/twitter.js");
      const result = await postTweet(text);
      return { platform_id: result.id, platform_url: result.url };
    }
    case "reddit": {
      const { submitPost } = await import("../lib/reddit.js");
      const titleMatch = item.body.match(/^## Title\n(.+)/m);
      const bodyMatch = item.body.match(/^## Body\n([\s\S]+?)(?=^## |$)/m);
      const title = titleMatch?.[1]?.trim() ?? item.frontmatter.title;
      const body = bodyMatch?.[1]?.trim() ?? text;
      const subreddit = (item.frontmatter as Record<string, unknown>).subreddit as string ?? "solana";
      const result = await submitPost(subreddit, title, body);
      return { platform_id: result.id, platform_url: result.url };
    }
    default:
      return { platform_url: "manual" };
  }
}

export function startServer(port = DEFAULT_PORT): http.Server {
  const server = http.createServer(handleRequest);
  server.listen(port, () => {
    console.log(`\n  PincerPay Dashboard: http://localhost:${port}\n`);
  });
  return server;
}

// Run directly via `tsx src/web/server.ts`
const arg1 = process.argv[1]?.replace(/\\/g, "/") ?? "";
if (arg1.endsWith("src/web/server.ts")) {
  const port = parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
  startServer(port);
}
