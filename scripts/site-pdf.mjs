// Generate a text-selectable PDF of the built site, one tall page per route, for
// annotation/iteration. Run via `just pdf` (which builds first). Self-contained:
// it boots `astro preview` to serve dist/, renders each page with Chromium's
// page.pdf() (real screen styles, reveal animations forced visible), then merges
// the per-route PDFs into one file with `pdfunite`.
//
// Requirements (already present in this repo/host): @playwright/test (chromium)
// and poppler's `pdfunite`. Output: tsm-site-preview-<YYYY-MM-DD>.pdf at repo root
// (git-ignored). NOT a build output — a transient review artifact.

import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { readdirSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 4333);
const BASE = `http://localhost:${PORT}`;
const VIEWPORT_W = 1200;

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/ not built. Run `just build` (or `npm run build`) first.');
  process.exit(1);
}

// Discover routes from the built dist/: every <dir>/index.html is a page.
function findRoutes(dir) {
  const routes = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === '_astro') continue;
      routes.push(...findRoutes(join(dir, entry.name)));
    } else if (entry.name === 'index.html') {
      const rel = relative(DIST, dir).split(sep).join('/');
      routes.push(rel === '' ? '/' : `/${rel}/`);
    }
  }
  return routes;
}
// Stable, human order: home first, then alphabetical.
const routes = findRoutes(DIST).sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
console.log(`Pages: ${routes.join('  ')}`);

const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
const outFile = join(ROOT, `tsm-site-preview-${today}.pdf`);
const workDir = mkdtempSync(join(tmpdir(), 'tsm-pdf-'));

async function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await new Promise((res) => setTimeout(res, 250));
  }
  throw new Error(`server did not come up at ${url}`);
}

// Boot astro preview to serve dist/.
const server = spawn(join(ROOT, 'node_modules', '.bin', 'astro'), ['preview', '--port', String(PORT)], {
  cwd: ROOT,
  stdio: 'ignore',
});

let browser;
try {
  await waitForServer(BASE);

  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: VIEWPORT_W, height: 1000 },
    colorScheme: 'light',
    deviceScaleFactor: 2,
  });

  const parts = [];
  for (const [i, route] of routes.entries()) {
    const page = await context.newPage();
    await page.emulateMedia({ media: 'screen' }); // real layout/colors, not @media print
    await page.goto(BASE + route, { waitUntil: 'networkidle' });

    // Force scroll-driven reveals fully visible and freeze animations, else the PDF
    // captures opacity:0 content (animation-timeline never fires in one headless paint).
    await page.addStyleTag({
      content: `*{animation:none !important;transition:none !important;}
        .reveal{opacity:1 !important;transform:none !important;}`,
    });
    await page.waitForTimeout(150);

    // One tall page per route (no mid-content page breaks) for clean annotation.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const part = join(workDir, `${String(i).padStart(2, '0')}.pdf`);
    await page.pdf({
      path: part,
      printBackground: true,
      width: `${VIEWPORT_W}px`,
      height: `${height + 8}px`,
      pageRanges: '1',
    });
    parts.push(part);
    console.log(`  rendered ${route}  (${height}px)`);
    await page.close();
  }

  // Merge per-route PDFs into one.
  execFileSync('pdfunite', [...parts, outFile], { stdio: 'inherit' });
  console.log(`\nPDF: ${outFile}`);
} finally {
  if (browser) await browser.close();
  server.kill('SIGTERM');
  rmSync(workDir, { recursive: true, force: true });
}
