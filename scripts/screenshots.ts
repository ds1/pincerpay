import { chromium, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { spawn, type ChildProcess } from "node:child_process";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const VIEWPORT = { width: 1280, height: 900 };
const POLL_INTERVAL_MS = 1_000;
const POLL_TIMEOUT_MS = 60_000;
const OUTPUT_DIR = "screenshots";

/** Playground components to capture as isolated element shots. */
const COMPONENTS = [
  "agent-config",
  "endpoint-picker",
  "response-panel",
  "flow-visualizer",
  "spend-tracker",
] as const;

/** Doc pages → array of H2 heading text to isolate as section screenshots. */
const DOC_SECTIONS: Record<string, string[]> = {
  "/docs/getting-started": [
    "How It Works",
    "Quick Start",
    "Examples",
  ],
  "/docs/example-nextjs-merchant": [
    "How it works",
    "Endpoints",
    "Route handler",
  ],
  "/docs/example-express-merchant": [
    "How it works",
    "Endpoints",
    "Server code",
  ],
  "/docs/example-agent-weather": [
    "How it works",
    "Agent code",
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArgs(): { baseUrl?: string; demoUrl?: string } {
  const args: Record<string, string> = {};
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === "--base-url" && process.argv[i + 1]) {
      args.baseUrl = process.argv[++i];
    } else if (process.argv[i] === "--demo-url" && process.argv[i + 1]) {
      args.demoUrl = process.argv[++i];
    }
  }
  return args;
}

async function waitForServer(url: string): Promise<void> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (res.ok || res.status === 404) return;
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
    if (process.platform === "win32" && child.pid) {
      spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { shell: true });
    } else {
      child.kill("SIGTERM");
    }
  }
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ---------------------------------------------------------------------------
// Screenshot routines
// ---------------------------------------------------------------------------

/**
 * Walk through the 11-step guided tour, capturing a viewport screenshot at
 * each step (spotlight halo + tooltip visible).
 */
async function captureTourSteps(page: Page, demoOrigin: string) {
  const dir = `${OUTPUT_DIR}/tour`;
  await mkdir(dir, { recursive: true });

  console.log("\n=== Guided Tour Steps ===");
  await page.goto(`${demoOrigin}/playground?tour=1`, { waitUntil: "networkidle" });

  // Wait for the tour tooltip to appear
  await page.waitForSelector(".tour-tooltip-in", { timeout: 10_000 });
  await page.waitForTimeout(600); // let entrance animation finish

  let step = 1;
  while (true) {
    // Read the step title from the tooltip
    const title = await page.locator(".tour-tooltip-in h4").textContent();
    const filepath = `${dir}/${String(step).padStart(2, "0")}-${slug(title ?? "step")}.png`;
    console.log(`  Tour step ${step}: "${title}" → ${filepath}`);
    await page.screenshot({ path: filepath });

    // Check if this is the last step (button says "Finish")
    const btnText = await page.locator(".tour-tooltip-in button:last-child").textContent();
    if (btnText?.trim() === "Finish") break;

    // Advance to next step
    await page.locator(".tour-tooltip-in button:last-child").click();

    // Wait for any auto-action to complete (button shows "Waiting...")
    try {
      await page.locator(".tour-tooltip-in button:last-child:has-text('Waiting')").waitFor({ timeout: 500 });
      // It's waiting — wait until it's done (button text changes back)
      await page.locator(".tour-tooltip-in button:last-child:not(:has-text('Waiting'))").waitFor({ timeout: 15_000 });
    } catch {
      // No waiting state — step advanced immediately
    }

    await page.waitForTimeout(400); // settle animations
    step++;
  }

  console.log(`  ${step} tour screenshots saved.`);
}

/**
 * Capture each playground component as an isolated element screenshot.
 * Sends a request first so the response panel and flow visualizer have content.
 */
async function captureComponents(page: Page, demoOrigin: string) {
  const dir = `${OUTPUT_DIR}/components`;
  await mkdir(dir, { recursive: true });

  console.log("\n=== Playground Components ===");
  await page.goto(`${demoOrigin}/playground`, { waitUntil: "networkidle" });

  // Generate a wallet so agent-config is populated
  const generateBtn = page.locator('[data-tour="agent-config"] button', { hasText: /generate/i });
  if (await generateBtn.isVisible()) {
    await generateBtn.click();
    await page.waitForTimeout(500);
  }

  // Select the first endpoint and send a request to populate response + flow
  const firstEndpoint = page.locator('[data-tour="endpoint-picker"] [role="button"], [data-tour="endpoint-picker"] button').first();
  if (await firstEndpoint.isVisible()) {
    await firstEndpoint.click();
    await page.waitForTimeout(300);
  }
  const sendBtn = page.locator('[data-tour="send-button"]');
  if (await sendBtn.isEnabled()) {
    await sendBtn.click();
    // Wait for response panel to populate
    await page.waitForTimeout(4000);
  }

  for (const name of COMPONENTS) {
    const el = page.locator(`[data-tour="${name}"]`);
    if (await el.isVisible()) {
      const filepath = `${dir}/${name}.png`;
      console.log(`  ${name} → ${filepath}`);
      await el.screenshot({ path: filepath });
    } else {
      console.log(`  ${name} — not visible, skipping`);
    }
  }
}

/**
 * Capture individual H2 sections from doc pages.
 * Each section = the H2 heading through to (but not including) the next H2.
 */
async function captureDocSections(page: Page, docsOrigin: string) {
  const dir = `${OUTPUT_DIR}/docs`;
  await mkdir(dir, { recursive: true });

  console.log("\n=== Doc Sections ===");

  for (const [route, headings] of Object.entries(DOC_SECTIONS)) {
    const pageName = route.replace(/^\/docs\//, "");
    await page.goto(`${docsOrigin}${route}`, { waitUntil: "networkidle" });

    for (const heading of headings) {
      // Find the H2 that contains this text
      const h2 = page.locator(".prose-pincerpay h2", { hasText: heading }).first();
      if (!(await h2.isVisible())) {
        console.log(`  ${pageName}/"${heading}" — H2 not found, skipping`);
        continue;
      }

      // Wrap the H2 and its following siblings into a temporary container,
      // then screenshot that container.
      const bbox = await page.evaluate((headingText: string) => {
        const h2s = Array.from(document.querySelectorAll(".prose-pincerpay h2"));
        const target = h2s.find((el) => el.textContent?.trim() === headingText);
        if (!target) return null;

        // Collect elements from this H2 to the next H2 (or end)
        const elements: Element[] = [target];
        let sibling = target.nextElementSibling;
        while (sibling && sibling.tagName !== "H2") {
          elements.push(sibling);
          sibling = sibling.nextElementSibling;
        }

        // Compute bounding box spanning all elements
        let top = Infinity, left = Infinity, bottom = 0, right = 0;
        for (const el of elements) {
          const r = el.getBoundingClientRect();
          top = Math.min(top, r.top);
          left = Math.min(left, r.left);
          bottom = Math.max(bottom, r.bottom);
          right = Math.max(right, r.right);
        }

        return {
          x: left + window.scrollX,
          y: top + window.scrollY,
          width: right - left,
          height: bottom - top,
        };
      }, heading);

      if (!bbox) {
        console.log(`  ${pageName}/"${heading}" — could not measure, skipping`);
        continue;
      }

      // Add padding
      const pad = 16;
      const clip = {
        x: Math.max(0, bbox.x - pad),
        y: Math.max(0, bbox.y - pad),
        width: bbox.width + pad * 2,
        height: bbox.height + pad * 2,
      };

      const filepath = `${dir}/${pageName}--${slug(heading)}.png`;
      console.log(`  ${pageName}/"${heading}" → ${filepath}`);
      await page.screenshot({ path: filepath, fullPage: true, clip });
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { baseUrl, demoUrl } = parseArgs();
  const docsOrigin = baseUrl ?? "http://localhost:3000";
  const demoOrigin = demoUrl ?? "https://demo.pincerpay.com";
  let server: ChildProcess | undefined;
  let count = 0;

  try {
    if (!baseUrl) {
      console.log("Starting dashboard dev server...");
      server = startDevServer();
      console.log("Waiting for server to be ready...");
      await waitForServer(docsOrigin);
      console.log("Server is ready.");
    }

    await mkdir(OUTPUT_DIR, { recursive: true });

    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: VIEWPORT });

    // --- Tour steps ---
    const tourPage = await context.newPage();
    await captureTourSteps(tourPage, demoOrigin);
    await tourPage.close();

    // --- Component isolations ---
    const compPage = await context.newPage();
    await captureComponents(compPage, demoOrigin);
    await compPage.close();

    // --- Doc sections ---
    const docsPage = await context.newPage();
    await captureDocSections(docsPage, docsOrigin);
    await docsPage.close();

    await browser.close();

    // Count output files
    const { readdir } = await import("node:fs/promises");
    for (const sub of ["tour", "components", "docs"]) {
      try {
        const files = await readdir(`${OUTPUT_DIR}/${sub}`);
        count += files.filter((f) => f.endsWith(".png")).length;
      } catch { /* dir may not exist */ }
    }

    console.log(`\nDone. ${count} screenshots saved to ${OUTPUT_DIR}/`);
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
