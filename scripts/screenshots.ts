import { chromium } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";

const PAGES = [
  "/docs/getting-started",
  "/docs/example-nextjs-merchant",
  "/docs/example-express-merchant",
  "/docs/example-agent-weather",
];

const VIEWPORT = { width: 1280, height: 900 };
const POLL_INTERVAL_MS = 1_000;
const POLL_TIMEOUT_MS = 60_000;
const OUTPUT_DIR = "screenshots";

function parseArgs(): { baseUrl?: string } {
  const idx = process.argv.indexOf("--base-url");
  if (idx !== -1 && process.argv[idx + 1]) {
    return { baseUrl: process.argv[idx + 1] };
  }
  return {};
}

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (res.ok || res.status === 404) return; // server is up
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Server at ${url} did not become ready within ${POLL_TIMEOUT_MS / 1000}s`);
}

function startDevServer(): ChildProcess {
  const child = spawn("pnpm", ["--filter", "@pincerpay/dashboard", "dev"], {
    stdio: "pipe",
    shell: true,
  });
  child.stdout?.on("data", (d: Buffer) => process.stdout.write(d));
  child.stderr?.on("data", (d: Buffer) => process.stderr.write(d));
  return child;
}

function killServer(child: ChildProcess): void {
  if (!child.killed) {
    // On Windows, spawn with shell creates a cmd wrapper — kill the whole tree
    if (process.platform === "win32" && child.pid) {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { shell: true });
    } else {
      child.kill("SIGTERM");
    }
  }
}

async function main() {
  const { baseUrl } = parseArgs();
  const origin = baseUrl ?? "http://localhost:3000";
  let server: ChildProcess | undefined;

  try {
    // Start dev server if no --base-url provided
    if (!baseUrl) {
      console.log("Starting dashboard dev server...");
      server = startDevServer();
      console.log("Waiting for server to be ready...");
      await waitForServer(origin);
      console.log("Server is ready.");
    }

    // Ensure output directory exists
    const { mkdir } = await import("node:fs/promises");
    await mkdir(OUTPUT_DIR, { recursive: true });

    // Launch browser
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();

    for (const route of PAGES) {
      const url = `${origin}${route}`;
      const filename = route.replace(/^\/docs\//, "").replace(/\//g, "-") + ".png";
      const filepath = `${OUTPUT_DIR}/${filename}`;

      console.log(`Capturing ${url} → ${filepath}`);
      await page.goto(url, { waitUntil: "networkidle" });
      await page.screenshot({ path: filepath, fullPage: true });
    }

    await browser.close();
    console.log(`Done. ${PAGES.length} screenshots saved to ${OUTPUT_DIR}/`);
  } finally {
    if (server) {
      console.log("Shutting down dev server...");
      killServer(server);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
