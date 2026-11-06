// Shared constants and source-derived fixtures for the TSM Lab E2E suite.

import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { load: loadYaml } = require('js-yaml') as { load(source: string): unknown };

// The 7 human pages, with the nav `key` used for active-state assertions.
export const PAGES = [
  { path: '/', navKey: 'home', label: 'Home' },
  { path: '/team', navKey: 'team', label: 'Team' },
  { path: '/research', navKey: 'research', label: 'Research' },
  { path: '/publications', navKey: 'publications', label: 'Publications' },
  { path: '/data', navKey: 'data', label: 'Data' },
  { path: '/news', navKey: 'news', label: 'News' },
  { path: '/contact-us', navKey: 'contact', label: 'Contact' },
] as const;

// Desktop nav: 7 anchors in order, matched by visible label -> href.
// (SiteHeader.astro renders Home/Team/Research/Publications/Data/News/Contact.)
export const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Team', href: '/team' },
  { label: 'Research', href: '/research' },
  { label: 'Publications', href: '/publications' },
  { label: 'Data', href: '/data' },
  { label: 'News', href: '/news' },
  { label: 'Contact', href: '/contact-us' },
] as const;

// Machine endpoints with their expected content-type substring (lowercased).
export const MACHINE_ENDPOINTS = [
  { path: '/robots.txt', ctype: 'text' },
  { path: '/sitemap.xml', ctype: 'xml' },
  { path: '/feed.xml', ctype: 'xml' },
  { path: '/llms.txt', ctype: 'text' },
  // publications.bib is served as application/x-bibtex; static hosts may downgrade to
  // text/plain. Treated specially in the test (accepts bibtex OR text).
  { path: '/publications.bib', ctype: 'bibtex|text' },
  { path: '/publications.csl.json', ctype: 'json' },
  { path: '/datasets.json', ctype: 'json' },
  { path: '/api/people.json', ctype: 'json' },
  { path: '/api/publications.json', ctype: 'json' },
  { path: '/api/news.json', ctype: 'json' },
] as const;

type SourcePublication = {
  id?: unknown;
  title?: unknown;
  DOI?: unknown;
  pdfUrl?: unknown;
};

export type PublicationRecord = {
  id: string;
  title: string;
  doi?: string;
  pdfUrl?: string;
};

export type NewsRecord = {
  date: string;
  slug: string;
  title: string;
};

function sourceValue(value: unknown, field: string, source: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${source} must provide a non-empty ${field}`);
  }
  return value;
}

function sourceRecord(value: unknown, source: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${source} must contain a YAML mapping`);
  }
  return value as Record<string, unknown>;
}

function sourceDate(value: unknown, source: string): string {
  const date = value instanceof Date ? value : typeof value === 'string' ? new Date(value) : undefined;
  if (!date || Number.isNaN(date.valueOf())) {
    throw new Error(`${source} must provide a valid date frontmatter field`);
  }
  return date.toISOString().slice(0, 10);
}

function sourceSlug(value: unknown, fallback: string, source: string): string {
  if (value === undefined) return fallback;
  return sourceValue(value, 'slug', source);
}

function frontmatterSource(contents: string, source: string): Record<string, unknown> {
  const normalized = contents.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    throw new Error(`${source} must start with frontmatter`);
  }
  const closingDelimiter = normalized.indexOf('\n---', 4);
  if (closingDelimiter < 0) throw new Error(`${source} must close its frontmatter`);
  return sourceRecord(loadYaml(normalized.slice(4, closingDelimiter)), source);
}

const sourceRoot = process.cwd();
const publicationsSource = resolve(sourceRoot, 'src/data/publications.csl.json');
const rawPublications = JSON.parse(readFileSync(publicationsSource, 'utf8')) as unknown;

if (!Array.isArray(rawPublications) || rawPublications.length === 0) {
  throw new Error(`${publicationsSource} must contain at least one publication`);
}

export const PUBLICATION_RECORDS: readonly PublicationRecord[] = rawPublications.map((raw, index) => {
  const publication = raw as SourcePublication;
  const source = `${publicationsSource}[${index}]`;
  return {
    id: sourceValue(publication.id, 'id', source),
    title: sourceValue(publication.title, 'title', source),
    ...(typeof publication.DOI === 'string' && publication.DOI.trim()
      ? { doi: publication.DOI }
      : {}),
    ...(typeof publication.pdfUrl === 'string' && publication.pdfUrl.trim()
      ? { pdfUrl: publication.pdfUrl }
      : {}),
  };
});

const newsDirectory = resolve(sourceRoot, 'src/content/news');
const newsFiles = readdirSync(newsDirectory).filter((file) => file.endsWith('.md')).sort();

if (newsFiles.length === 0) {
  throw new Error(`${newsDirectory} must contain at least one news record`);
}

export const NEWS_RECORDS: readonly NewsRecord[] = newsFiles.map((file) => {
  const source = resolve(newsDirectory, file);
  const frontmatter = frontmatterSource(readFileSync(source, 'utf8'), source);
  return {
    date: sourceDate(frontmatter.date, source),
    slug: sourceSlug(frontmatter.slug, file.replace(/\.md$/, ''), source),
    title: sourceValue(frontmatter.title, 'title', source),
  };
});

const labSource = resolve(sourceRoot, 'src/data/lab.yaml');
const lab = sourceRecord(loadYaml(readFileSync(labSource, 'utf8')), labSource);
const pi = sourceRecord(lab.pi, `${labSource}.pi`);
const configuredCv = pi.cvUrl;

export const EXPECTED_CV_URL = sourceValue(configuredCv, 'cvUrl', `${labSource}.pi`);
export const HOSTED_PDF_RECORDS = PUBLICATION_RECORDS.filter(
  (record): record is PublicationRecord & { pdfUrl: string } => Boolean(record.pdfUrl)
);

if (HOSTED_PDF_RECORDS.length === 0) {
  throw new Error(`${publicationsSource} must contain at least one hosted PDF URL`);
}

// External link checks use a small source-derived sample so the opt-in suite is bounded.
export const EXTERNAL_PDF_PROBES = [...new Set([0, Math.floor(HOSTED_PDF_RECORDS.length / 2), HOSTED_PDF_RECORDS.length - 1])].map(
  (index) => HOSTED_PDF_RECORDS[index]
);
