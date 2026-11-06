#!/usr/bin/env node
// validate-content.mjs — Layer-2 content validation the Astro/Zod type-check can't do.
//
// Checks:
//   1. TODO(owner) sweep   — list every occurrence (file + line) as a WARNING.
//                            These are ALLOWED but surfaced (anti-fabrication: unknown -> TODO(owner)).
//   2. Image existence     — every `photo:`/`figure:` path in content must exist under src/assets/images/.
//   3. Publication CSL      — every entry in publications.csl.json has required CSL fields
//                            (id, type, title, author, container-title|event, issued).
//   4. Analytics check: validate analytics provider and script source in site.yaml.
//
// Exit code:
//   - non-zero ONLY on HARD errors (missing image, malformed publication).
//   - 0 when only WARNINGS (TODO(owner)) are present.
//
// Node ESM, stdlib only — no dependencies.

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';
import { isWebUrl } from '../src/lib/safety.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'src', 'content');
const DATA_DIR = join(ROOT, 'src', 'data');
const PUBS_FILE = join(DATA_DIR, 'publications.csl.json');
const POLICY_FILE = join(DATA_DIR, 'publisher-policies.yaml');

// Allowed analytics providers and script origins.
const ALLOWED_ANALYTICS_PROVIDERS = ['selfhosted'];
const ALLOWED_ANALYTICS_ORIGINS = ['https://stats-tsmlab.vercel.app'];

const errors = [];   // hard failures -> non-zero exit
const warnings = []; // surfaced but allowed (TODO(owner))

// Real YAML parse so inline mappings/aliases can't slip past the allowlist.
function loadSiteYaml() {
  const file = join(DATA_DIR, 'site.yaml');
  if (!existsSync(file)) return null;
  const site = parseYaml(readFileSync(file, 'utf8'));
  return site?.analytics ?? null;
}


// Minimal read of publisher-policies.yaml (stdlib only): journal container-title -> hostable[],
// plus the conference hostable[]. Powers the rights "don't-forget" guard in Check 3.
function loadPolicies() {
  if (!existsSync(POLICY_FILE)) return null;
  const text = readFileSync(POLICY_FILE, 'utf8');
  const journals = {};
  let conference = null;
  let section = null;   // 'journals' | 'conference'
  let curKey = null;
  for (const raw of text.split('\n')) {
    if (/^journals:\s*$/.test(raw)) { section = 'journals'; curKey = null; continue; }
    if (/^conference:\s*$/.test(raw)) { section = 'conference'; curKey = null; conference = { hostable: [] }; continue; }
    const jk = raw.match(/^ {2}"(.+)":\s*$/);
    if (section === 'journals' && jk) { curKey = jk[1]; journals[curKey] = { hostable: [], embargoMonths: 0 }; continue; }
    const host = raw.match(/^\s+hostable:\s*\[([^\]]*)\]/);
    if (host) {
      const list = host[1].split(',').map((s) => s.trim()).filter(Boolean);
      if (section === 'journals' && curKey) journals[curKey].hostable = list;
      else if (section === 'conference' && conference) conference.hostable = list;
    }
    const emb = raw.match(/^\s+embargoMonths:\s*(\d+)/);
    if (emb) {
      const months = Number(emb[1]);
      if (section === 'journals' && curKey) journals[curKey].embargoMonths = months;
      else if (section === 'conference' && conference) conference.embargoMonths = months;
    }
  }
  return { journals, conference };
}
const POLICIES = loadPolicies();

// ---------------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------------
function walk(dir, filterFn) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, filterFn));
    else if (filterFn(entry.name)) out.push(full);
  }
  return out;
}

const rel = (p) => p.startsWith(ROOT) ? p.slice(ROOT.length + 1) : p;

const mdFiles = walk(CONTENT_DIR, (n) => n.endsWith('.md'));
const dataFiles = walk(DATA_DIR, (n) => n.endsWith('.yaml') || n.endsWith('.yml') || n.endsWith('.json'));

// ---------------------------------------------------------------------------
// Check 1 — TODO(owner) sweep (WARNING)
// ---------------------------------------------------------------------------
for (const file of [...mdFiles, ...dataFiles]) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes('TODO(owner)')) {
      warnings.push(`TODO(owner) at ${rel(file)}:${i + 1} — ${line.trim()}`);
    }
  });
}

// ---------------------------------------------------------------------------
// Check 2 — image existence for photo:/figure: refs (ERROR if missing)
// ---------------------------------------------------------------------------
// Content image refs are written relative to the .md file's directory
// (e.g. "../../assets/images/people/x.jpg"). Resolve against that dir.
const imgRefRe = /^\s*(photo|figure):\s*["']?([^"'\n#]+?)["']?\s*$/;
for (const file of mdFiles) {
  const dir = dirname(file);
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const m = line.match(imgRefRe);
    if (!m) return;
    const field = m[1];
    const refPath = m[2].trim();
    if (!refPath || refPath === 'TODO(owner)') return; // empty / placeholder handled elsewhere
    const resolved = isAbsolute(refPath) ? join(ROOT, refPath) : resolve(dir, refPath);
    if (!existsSync(resolved) || !statSync(resolved).isFile()) {
      errors.push(
        `Missing image: ${field}: "${refPath}" in ${rel(file)}:${i + 1} -> expected at ${rel(resolved)}`
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Check 3 — publications.csl.json required CSL fields (ERROR if malformed)
// ---------------------------------------------------------------------------
if (!existsSync(PUBS_FILE)) {
  errors.push(`Missing publications source: ${rel(PUBS_FILE)}`);
} else {
  let pubs;
  try {
    pubs = JSON.parse(readFileSync(PUBS_FILE, 'utf8'));
  } catch (e) {
    errors.push(`publications.csl.json is not valid JSON: ${e.message}`);
    pubs = null;
  }
  if (pubs !== null) {
    if (!Array.isArray(pubs)) {
      errors.push(`publications.csl.json must be a JSON array of CSL entries`);
    } else {
      pubs.forEach((entry, idx) => {
        const id = entry && entry.id ? entry.id : `#${idx}`;
        const need = (cond, field) => {
          if (!cond) errors.push(`Publication "${id}" missing required CSL field: ${field}`);
        };
        need(entry && typeof entry === 'object', 'object');
        if (!entry || typeof entry !== 'object') return;
        need(entry.id, 'id');
        need(entry.type, 'type');
        need(entry.title, 'title');
        for (const field of ['URL', 'pdfUrl']) {
          if (entry[field] !== undefined && !isWebUrl(entry[field])) {
            errors.push(`Publication "${id}" has an invalid ${field}: expected an HTTP(S) URL`);
          }
        }
        need(Array.isArray(entry.author) && entry.author.length > 0, 'author');
        // venue: container-title (journal) OR event/event-title (conference)
        need(
          entry['container-title'] || entry.event || entry['event-title'] || entry['event-place'],
          'container-title|event'
        );
        // issued must carry a year via date-parts
        const issuedOk =
          entry.issued &&
          Array.isArray(entry.issued['date-parts']) &&
          Array.isArray(entry.issued['date-parts'][0]) &&
          entry.issued['date-parts'][0][0];
        need(issuedOk, 'issued (date-parts[0][0])');
        // DOI format sanity when present (advisory -> error only if clearly malformed)
        if (entry.DOI && !/^10\.\d{4,9}\/\S+$/.test(entry.DOI)) {
          errors.push(`Publication "${id}" has a malformed DOI: "${entry.DOI}"`);
        }
        // Rights guard (don't-forget): a hosted PDF MUST resolve to a known publisher
        // policy + a permitted version. A future paper cannot be published with an
        // unresolved rights decision. (src/data/publisher-policies.yaml is the source.)
        if (entry.pdfUrl) {
          const v = entry.version;
          if (!v) {
            errors.push(`Publication "${id}" has a pdfUrl but no version (set version: aam|vor)`);
          } else if (POLICIES) {
            const pol = entry.type === 'paper-conference'
              ? POLICIES.conference
              : POLICIES.journals[entry['container-title']];
            if (!pol) {
              errors.push(`Publication "${id}" hosts a PDF but publisher "${entry['container-title']}" is not in publisher-policies.yaml`);
            } else if (!pol.hostable.includes(v)) {
              errors.push(`Publication "${id}" hosts version "${v}" not permitted for "${entry['container-title'] || 'conference'}" (allowed: ${pol.hostable.join(',') || 'none'})`);
            } else if (pol.embargoMonths > 0 && issuedOk) {
              // A paper cannot be self-hosted while still inside its self-archiving embargo
              // (publisher-policies.yaml encodes the personal-site embargo: 0 where none applies).
              const dp = entry.issued['date-parts'][0];
              const iy = dp[0];
              const im = dp[1] || 1; // lenient: missing month -> January (maximizes elapsed)
              const now = new Date();
              const elapsed = (now.getFullYear() - iy) * 12 + (now.getMonth() + 1 - im);
              if (elapsed < pol.embargoMonths) {
                errors.push(
                  `Publication "${id}" hosts a PDF still inside its ${pol.embargoMonths}-month embargo ` +
                  `for "${entry['container-title'] || 'conference'}" (issued ${iy}-${String(im).padStart(2, '0')}, ${elapsed} months elapsed)`
                );
              }
            }
          }
        }
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Check 4: analytics provider and script source in site.yaml (ERROR if invalid)
// ---------------------------------------------------------------------------
const SITE_FILE = join(DATA_DIR, 'site.yaml');
if (existsSync(SITE_FILE)) {
  const analytics = loadSiteYaml();
  if (analytics !== null) {
    const { provider, id, src } = analytics;
    
    if (!provider || !ALLOWED_ANALYTICS_PROVIDERS.includes(provider)) {
      errors.push(
        `Invalid analytics provider: "${provider}". Allowed providers: ${ALLOWED_ANALYTICS_PROVIDERS.join(', ')}.`
      );
    }
    
    if (!id || typeof id !== 'string' || id.trim() === '') {
      errors.push('Analytics configuration is missing a valid id.');
    }
    
    if (!src) {
      errors.push('Analytics configuration is missing a src URL.');
    } else {
      let parsedUrl = null;
      try {
        parsedUrl = new URL(src);
      } catch (e) {
        // Invalid URL structure
      }
      
      if (!parsedUrl || parsedUrl.protocol !== 'https:' || !src.endsWith('/t.js') || !ALLOWED_ANALYTICS_ORIGINS.includes(parsedUrl.origin)) {
        errors.push(
          `Invalid analytics src URL: "${src}". Must be a valid HTTPS URL ending with "/t.js" from allowed origins: ${ALLOWED_ANALYTICS_ORIGINS.join(', ')}.`
        );
      }
    }
  }
}


// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const counts = `${mdFiles.length} content files, ${dataFiles.length} data files, ` +
  `${existsSync(PUBS_FILE) ? 'publications.csl.json present' : 'no publications file'}`;
console.log(`validate-content: scanned ${counts}`);

if (warnings.length) {
  console.log(`\n${warnings.length} WARNING(s) — TODO(owner) markers require review:`);
  for (const w of warnings) console.log(`  WARN  ${w}`);
}

if (errors.length) {
  console.error(`\n${errors.length} ERROR(s) — must fix before build/release:`);
  for (const e of errors) console.error(`  ERROR ${e}`);
  console.error('\nvalidate-content: FAILED');
  process.exit(1);
}

console.log(`\nvalidate-content: OK${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
process.exit(0);
