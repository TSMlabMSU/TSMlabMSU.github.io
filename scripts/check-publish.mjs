#!/usr/bin/env node
// check-publish.mjs — automated part of the PUBLISHING.md checklist.
//
// Scans every git-tracked file (what the public repo and the deploy carry) and FAILS on:
//   1. Image metadata outside an allowlist (EXIF/XMP/IPTC, PNG text/time chunks, SVG editor metadata).
//   2. Committed secrets: .env / key files, and token or private-key patterns in text files.
//   3. Files over MAX_FILE_BYTES (binaries belong on R2, datasets on Zenodo).
//   4. Retracted wording, matched by hash (scripts/retracted-phrases.txt) so the denylist never republishes it.
//   5. Images in src/assets/images/ whose file name no source file mentions (the research/ glob would
//      still copy them to the live site, and the public repo carries them either way).
//
// Usage: node scripts/check-publish.mjs           — run all checks
//        node scripts/check-publish.mjs --hash "<retracted phrase>"  — print a denylist line
// Node ESM, stdlib only.

import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DENYLIST = 'scripts/retracted-phrases.txt';
const MAX_FILE_BYTES = 5 * 1024 * 1024;

// ---- 1. Image metadata ----------------------------------------------------------------------

// PNG chunks that carry only pixel, color or decoding data. Everything else (tEXt, zTXt, iTXt,
// eXIf, tIME, unknown private chunks) fails. iDOT is Apple's parallel-decode offset table.
const PNG_ALLOWED = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'cHRM', 'gAMA', 'iCCP', 'sBIT', 'sRGB', 'cICP', 'bKGD', 'pHYs', 'iDOT']);
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function pngProblems(buf) {
  if (!buf.subarray(0, 8).equals(PNG_SIG)) return ['not a PNG file'];
  const bad = [];
  for (let off = 8; off + 8 <= buf.length; ) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('latin1', off + 4, off + 8);
    if (!PNG_ALLOWED.has(type)) bad.push(`PNG ${type} chunk`);
    if (type === 'IEND') {
      if (off + 12 + len < buf.length) bad.push('data after PNG IEND');
      break;
    }
    off += 12 + len;
  }
  return bad;
}

// JPEG: APP0 (JFIF), APP2 ICC_PROFILE and APP14 Adobe are color/format data. APP1 (EXIF, XMP),
// APP13 (IPTC/Photoshop), other APPn and COM comments fail.
export function jpegProblems(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return ['not a JPEG file'];
  const bad = [];
  for (let off = 2; off + 4 <= buf.length; ) {
    if (buf[off] !== 0xff) return [...bad, 'malformed JPEG marker'];
    const marker = buf[off + 1];
    if (marker === 0xff) { off += 1; continue; }                        // fill byte
    if (marker === 0xd9) {                                              // EOI
      if (off + 2 < buf.length) bad.push('data after JPEG end-of-image');
      return bad;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue; }
    const len = buf.readUInt16BE(off + 2);
    if (marker === 0xda) {                                              // start of scan: skip entropy-coded data
      off += 2 + len;
      while (off + 1 < buf.length && !(buf[off] === 0xff && buf[off + 1] !== 0 && !(buf[off + 1] >= 0xd0 && buf[off + 1] <= 0xd7))) off++;
      continue;
    }
    const id = buf.toString('latin1', off + 4, off + 4 + Math.min(14, len - 2));
    if (marker === 0xfe) bad.push('JPEG COM comment');
    else if (marker >= 0xe0 && marker <= 0xef) {
      const ok = (marker === 0xe0 && /^JF(IF|XX)\0/.test(id))
        || (marker === 0xe2 && id.startsWith('ICC_PROFILE\0'))
        || (marker === 0xee && id.startsWith('Adobe'));
      if (!ok) bad.push(`JPEG APP${marker - 0xe0} segment (${id.split('\0')[0] || 'unnamed'})`);
    }
    off += 2 + len;
  }
  return bad;
}

// SVG: editor metadata can carry author names and local file paths.
export function svgProblems(text) {
  const bad = [];
  for (const [re, what] of [[/<([\w.-]+:)?metadata\b/i, '<metadata> element'], [/\b(inkscape|sodipodi):/i, 'Inkscape/Sodipodi attributes'],
    [/\brdf:/i, 'RDF metadata'], [/<!--/, 'XML comment'], [/(\/Users\/|\/home\/|[A-Z]:\\)/, 'local file path']]) {
    if (re.test(text)) bad.push(`SVG ${what}`);
  }
  return bad;
}

// ICO: each embedded PNG must pass the PNG check; BMP entries carry no metadata.
export function icoProblems(buf) {
  const bad = [];
  const count = buf.readUInt16LE(4);
  for (let i = 0; i < count; i++) {
    const size = buf.readUInt32LE(6 + 16 * i + 8);
    const off = buf.readUInt32LE(6 + 16 * i + 12);
    const img = buf.subarray(off, off + size);
    if (img.subarray(0, 8).equals(PNG_SIG)) bad.push(...pngProblems(img).map((p) => `icon ${i}: ${p}`));
  }
  return bad;
}

const IMAGE_EXT = /\.(png|jpe?g|svg|ico|gif|webp|avif|tiff?|heic|heif|bmp)$/i;

export function imageProblems(path, buf) {
  const ext = path.toLowerCase().split('.').pop();
  if (ext === 'png') return pngProblems(buf);
  if (ext === 'jpg' || ext === 'jpeg') return jpegProblems(buf);
  if (ext === 'svg') return svgProblems(buf.toString('utf8'));
  if (ext === 'ico') return icoProblems(buf);
  return [`.${ext} images are not checked; convert to PNG/JPEG or extend scripts/check-publish.mjs`];
}

// ---- 2. Secrets ------------------------------------------------------------------------------

const SECRET_FILE = /(^|\/)(\.env(\.(?!example$)[^/]+)?|[^/]+\.(pem|key|p12|pfx)|id_(rsa|ed25519|ecdsa)[^/]*)$/i;
const SECRET_PATTERNS = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b/, 'GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{22,}/, 'GitHub token'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/\bsk-(ant-|proj-)?[A-Za-z0-9_-]{32,}/, 'OpenAI/Anthropic key'],
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'Google API key'],
  [/\b[rs]k_live_[0-9A-Za-z]{20,}/, 'Stripe key'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, 'JWT (e.g. Supabase key)'],
  [/\b(api[_-]?key|secret|token|password)["']?\s*[:=]\s*["'][^"'\s]{16,}["']/i, 'hard-coded credential'],
];

export function secretProblems(path, text) {
  const bad = [];
  if (SECRET_FILE.test(path)) bad.push('secret-bearing file name (.env, key or certificate file)');
  if (text !== null) for (const [re, what] of SECRET_PATTERNS) if (re.test(text)) bad.push(`possible ${what}`);
  return bad;
}

// ---- 4. Retracted wording --------------------------------------------------------------------

const words = (text) => text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

export function hashPhrase(phrase) {
  const w = words(phrase);
  return `${w.length} ${sha256(w.join(' '))}`;
}

export function loadDenylist(text) {
  return text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
    .map((l) => { const [n, h] = l.split(/\s+/); return { n: Number(n), h }; });
}

export function retractedHits(text, denylist) {
  const w = words(text);
  const hits = new Set();
  for (const { n, h } of denylist) {
    for (let i = 0; i + n <= w.length; i++) if (sha256(w.slice(i, i + n).join(' ')) === h) { hits.add(h); break; }
  }
  return [...hits];
}

// ---- 5. Unreferenced images ------------------------------------------------------------------

export function unreferencedImages(paths, sourceText) {
  return paths.filter((p) => p.startsWith('src/assets/images/') && IMAGE_EXT.test(p) && !sourceText.includes(basename(p)));
}

// ---- Runner ----------------------------------------------------------------------------------

function trackedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
}

export function run(files = trackedFiles()) {
  const errors = [];
  const denylist = loadDenylist(readFileSync(join(ROOT, DENYLIST), 'utf8'));
  const sourceTexts = [];
  const present = [];

  for (const path of files) {
    let buf;
    try { buf = readFileSync(join(ROOT, path)); } catch { continue; }   // deleted in working tree
    present.push(path);
    const fail = (msg) => errors.push(`${path}: ${msg}`);
    if (buf.length > MAX_FILE_BYTES) fail(`${(buf.length / 1048576).toFixed(1)} MB exceeds the ${MAX_FILE_BYTES / 1048576} MB limit`);
    const isText = !buf.includes(0);
    const text = isText ? buf.toString('utf8') : null;
    if (IMAGE_EXT.test(path)) imageProblems(path, buf).forEach((p) => fail(`image metadata: ${p}`));
    secretProblems(path, text).forEach(fail);
    if (text !== null && path !== DENYLIST) {
      if (retractedHits(text, denylist).length) fail('contains retracted wording (scripts/retracted-phrases.txt)');
      if (path.startsWith('src/') && !path.startsWith('src/assets/')) sourceTexts.push(text);
    }
  }

  for (const path of unreferencedImages(present, sourceTexts.join('\n'))) {
    errors.push(`${path}: not referenced by any source file; use it or delete it`);
  }
  return { errors, count: files.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--hash');
  if (i !== -1) {
    console.log(hashPhrase(process.argv.slice(i + 1).join(' ')));
  } else {
    const { errors, count } = run();
    for (const e of errors) console.error(`FAIL  ${e}`);
    console.log(`check:publish — ${count} tracked files, ${errors.length} failure(s). Checklist: PUBLISHING.md`);
    process.exit(errors.length ? 1 : 0);
  }
}
