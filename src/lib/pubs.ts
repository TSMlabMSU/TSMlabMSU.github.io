// Shared publication helpers derive every publication machine output (BibTeX,
// /api/publications.json, JSON-LD) from src/data/publications.csl.json.

import pubsData from '../data/publications.csl.json';

export type CSLName = { family?: string; given?: string; literal?: string };
export type CSLItem = {
  id: string;
  type: string;
  title: string;
  author?: CSLName[];
  'container-title'?: string;
  issued?: { 'date-parts'?: number[][] };
  DOI?: string;
  URL?: string;
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
};

export const pubs = pubsData as CSLItem[];

export function yearOf(p: CSLItem): number {
  return p?.issued?.['date-parts']?.[0]?.[0] ?? 0;
}

export function authorName(a: CSLName): string {
  if (a.literal) return a.literal;
  return [a.given, a.family].filter(Boolean).join(' ');
}

export function authorNames(authors?: CSLName[]): string[] {
  return (authors ?? []).map(authorName);
}

// Strip an HTML title to plain text for fields that must not contain markup
// (BibTeX, JSON author-name fields, JSON-LD headline). The human page renders titles
// as text; this helper also removes any legacy inline tags from machine-readable fields.
export function plainText(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

// First/last page from a CSL "page" range like "434-460" or "A27".
export function pageParts(page?: string): { first?: string; last?: string } {
  if (!page) return {};
  const m = page.split(/[–-]/);
  return { first: m[0]?.trim(), last: m[1]?.trim() };
}

// --- BibTeX generation ------------------------------------------------------

// CSL type -> BibTeX entry type.
function bibType(p: CSLItem): string {
  return p.type === 'paper-conference' ? 'inproceedings' : 'article';
}

// Escape LaTeX/BibTeX-special characters in a field value. Strips braces, then escapes the
// text-mode specials so a title/venue containing `_`, `$`, `#`, `%`, `&`, `^`, `~`, or `\`
// (e.g. "Re_tau scaling" or "CO$_2$ transport") produces valid BibTeX instead of a parse error.
function bibEscape(s: string): string {
  return s
    .replace(/[{}]/g, '')
    .replace(/\\/g, '\\textbackslash ')
    .replace(/([&%#_$])/g, '\\$1')
    .replace(/\^/g, '\\^{}')
    .replace(/~/g, '\\~{}');
}

// "Family, Given" per author, joined with " and " — the BibTeX author convention.
function bibAuthors(authors?: CSLName[]): string {
  return (authors ?? [])
    .map((a) => {
      // Braces keep a literal/corporate author containing "and" from
      // being parsed as multiple BibTeX authors.
      if (a.literal) return `{${bibEscape(a.literal)}}`;
      const fam = a.family ? bibEscape(a.family) : '';
      const giv = a.given ? bibEscape(a.given) : '';
      if (fam && giv) return `${fam}, ${giv}`;
      return fam || giv;
    })
    .join(' and ');
}

export function toBibtex(p: CSLItem): string {
  const fields: [string, string | undefined][] = [];
  fields.push(['author', bibAuthors(p.author)]);
  fields.push(['title', bibEscape(plainText(p.title))]);
  const venueKey = p.type === 'paper-conference' ? 'booktitle' : 'journal';
  if (p['container-title']) fields.push([venueKey, bibEscape(p['container-title'])]);
  const y = yearOf(p);
  if (y) fields.push(['year', String(y)]);
  if (p.volume) fields.push(['volume', bibEscape(p.volume)]);
  if (p.issue) fields.push(['number', bibEscape(p.issue)]);
  // Normalize any dash run (ASCII hyphen or Unicode figure/en/em/horizontal-bar dashes) to BibTeX `--`.
  if (p.page) fields.push(['pages', bibEscape(p.page).replace(/[‒-―-]+/g, '--')]);
  if (p.publisher) fields.push(['publisher', bibEscape(p.publisher)]);
  if (p.DOI) fields.push(['doi', p.DOI]);
  if (p.URL) fields.push(['url', p.URL]);

  const body = fields
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `  ${k} = {${v}},`)
    .join('\n');
  return `@${bibType(p)}{${p.id},\n${body}\n}`;
}

export function bibtexAll(): string {
  const header =
    '% BibTeX export — Turbulence Simulation & Modeling (TSM) Lab, Michigan State University\n' +
    '% Source of truth: /publications.csl.json (CSL-JSON). Content licensed CC-BY 4.0.\n\n';
  return header + pubs.map(toBibtex).join('\n\n') + '\n';
}
