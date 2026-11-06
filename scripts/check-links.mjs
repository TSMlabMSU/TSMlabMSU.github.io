// Opt-in link checker for the built site. Crawls dist/**/*.html, then:
//  - resolves every root-relative href against dist/ (catches internal dead links), and
//  - probes every external URL over the network (HEAD, falling back to a ranged GET).
// Three buckets: OK / WARN / BROKEN. Only BROKEN exits non-zero, so bot-blocking hosts
// (ResearchGate, Scholar) don't fail the run. The canonical domain (tsmlabmsu.com) is now
// live, so its URLs are probed like any other external link.
//
// Run via `just check-links` (builds first) or `npm run check:links` (assumes dist/ built).
// NOT part of the pre-build gate — network checks are slow/flaky and must not block the build.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const DIST = join(ROOT, 'dist');
const CONCURRENCY = 8;
const TIMEOUT_MS = 15000;

if (!existsSync(join(DIST, 'index.html'))) {
  console.error('dist/ not built. Run `just build` (or `npm run build`) first.');
  process.exit(1);
}

// Hosts that block automated requests (return 403/999) but whose links are valid.
const BOT_BLOCKED = [/researchgate\.net$/, /scholar\.google\./, /linkedin\.com$/, /x\.com$/, /twitter\.com$/];

function walkHtml(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkHtml(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

// url -> Set(source html paths)
const links = new Map();
function record(url, src) {
  if (!links.has(url)) links.set(url, new Set());
  links.get(url).add(src.replace(DIST + '/', ''));
}

for (const file of walkHtml(DIST)) {
  const html = readFileSync(file, 'utf8');
  for (const tag of html.matchAll(/<(a|link|img|script|source)\b([^>]*)>/gi)) {
    const [, name, attrs] = tag;
    // Skip resource hints — preconnect/dns-prefetch point at bare origins that 404, not real links.
    if (name.toLowerCase() === 'link') {
      const rel = (attrs.match(/\brel="([^"]*)"/i)?.[1] || '').toLowerCase();
      if (/(preconnect|dns-prefetch|modulepreload)/.test(rel)) continue;
    }
    const raw = (attrs.match(/\b(?:href|src)="([^"]+)"/i)?.[1] || '').trim();
    if (!raw || raw.startsWith('#') || /^(mailto:|tel:|data:|javascript:)/i.test(raw)) continue;
    record(raw, file);
  }
}

function resolveInternal(p) {
  const clean = p.split('#')[0].split('?')[0];
  if (clean === '' || clean === '/') return existsSync(join(DIST, 'index.html'));
  const rel = decodeURIComponent(clean.replace(/^\//, ''));
  const cands = extname(rel)
    ? [join(DIST, rel)]
    : [join(DIST, rel), join(DIST, rel, 'index.html'), join(DIST, rel + '.html')];
  return cands.some((c) => existsSync(c) && statSync(c).isFile());
}

async function fetchT(url, opts) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, redirect: 'follow', signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

const UA = { 'user-agent': 'tsm-linkcheck/1.0 (+https://tsmlabmsu.com)' };
const okStatus = (s) => s >= 200 && s < 400;
const softStatus = (s) => [401, 403, 405, 406, 429, 501, 999].includes(s);

async function probeExternal(url, host) {
  // doi.org: validate the DOI is REGISTERED via the doi.org handle API, without following
  // the redirect into the publisher landing page (which bot-blocks valid DOIs with 403).
  if (host === 'doi.org') {
    const doi = url.replace(/^https?:\/\/doi\.org\//i, '').replace(/[#?].*$/, '');
    try {
      const r = await fetchT(`https://doi.org/api/handles/${doi}`, { method: 'GET', headers: UA });
      if (r.ok) {
        const j = await r.json();
        if (j.responseCode === 1) return { bucket: 'ok', status: 'registered' };
        if (j.responseCode === 100) return { bucket: 'broken', status: 'DOI not found' };
      }
    } catch {}
    // Handle API indecisive (transient error / unexpected responseCode). Do NOT fall through to
    // probing the doi.org URL itself — it redirects into the publisher landing page, which
    // bot-blocks valid DOIs with 403 and would mark a REGISTERED DOI broken. Report unverified.
    return { bucket: 'warn', status: 'DOI unverified (handle API indecisive)' };
  }
  try {
    let r = await fetchT(url, { method: 'HEAD', headers: UA });
    if (okStatus(r.status)) return { bucket: 'ok', status: r.status };
    // A non-OK HEAD (incl. 404/405/410) is not authoritative: many hosts disallow or mis-handle
    // HEAD for URLs that serve fine on GET. Let a ranged GET decide rather than trusting HEAD.
    let g = await fetchT(url, { method: 'GET', headers: { ...UA, range: 'bytes=0-0' } });
    g.body?.cancel?.();
    if (okStatus(g.status)) return { bucket: 'ok', status: g.status };
    if (softStatus(g.status)) return { bucket: 'warn', status: g.status };
    return { bucket: 'broken', status: g.status };
  } catch (e) {
    return { bucket: 'broken', status: `ERR ${e.cause?.code || e.code || e.name}` };
  }
}

const internalBroken = [];
const external = [];
for (const url of links.keys()) {
  if (/^https?:\/\//i.test(url)) external.push(url);
  else if (url.startsWith('/')) {
    if (!resolveInternal(url)) internalBroken.push(url);
  }
}

// Probe externals with a bounded pool.
const results = new Map();
let idx = 0;
async function worker() {
  while (idx < external.length) {
    const url = external[idx++];
    const host = (() => { try { return new URL(url).host; } catch { return ''; } })();
    let res = await probeExternal(url, host);
    if (res.bucket === 'broken' && BOT_BLOCKED.some((re) => re.test(host))) {
      res = { bucket: 'warn', status: `${res.status} (bot-blocked host)` };
    }
    results.set(url, res);
  }
}
process.stdout.write(`Probing ${external.length} external links (+${links.size - external.length} internal)…\n`);
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, external.length) }, worker));

const broken = [...results].filter(([, r]) => r.bucket === 'broken');
const warn = [...results].filter(([, r]) => r.bucket === 'warn');
const ok = [...results].filter(([, r]) => r.bucket === 'ok');

const srcOf = (u) => [...links.get(u)].slice(0, 3).join(', ');

if (warn.length) {
  console.log(`\n⚠  WARN (${warn.length}) — reachable-but-blocked or otherwise non-fatal:`);
  for (const [u, r] of warn) console.log(`   [${r.status}] ${u}`);
}
if (internalBroken.length) {
  console.log(`\n✖  INTERNAL DEAD LINKS (${internalBroken.length}):`);
  for (const u of internalBroken) console.log(`   ${u}   (in ${srcOf(u)})`);
}
if (broken.length) {
  console.log(`\n✖  BROKEN EXTERNAL (${broken.length}):`);
  for (const [u, r] of broken) console.log(`   [${r.status}] ${u}   (in ${srcOf(u)})`);
}

const hardFails = broken.length + internalBroken.length;
console.log(`\nLinks: ${ok.length} ok · ${warn.length} warn · ${hardFails} broken (${internalBroken.length} internal, ${broken.length} external).`);
process.exit(hardFails ? 1 : 0);
