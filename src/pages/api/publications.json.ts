// /api/publications.json — {meta, data[]} envelope. Each item
// carries the Scholar/JSON-LD fields directly (DOI, full authors, venue, year,
// volume/pages) so an agent gets everything in one fetch. Derived from canonical CSL-JSON.

import type { APIRoute } from 'astro';
import { base, LICENSE_URL } from '../../lib/site';
import { pubs, yearOf, authorNames, plainText } from '../../lib/pubs';

export const GET: APIRoute = ({ site }) => {
  const root = base(site);

  const data = pubs.map((p) => {
    const item: Record<string, unknown> = {
      id: p.id,
      type: p.type,
      title: plainText(p.title),
      authors: authorNames(p.author),
      venue: p['container-title'] ?? null,
      year: yearOf(p) || null,
    };
    if (p.volume) item.volume = p.volume;
    if (p.issue) item.issue = p.issue;
    if (p.page) item.pages = p.page;
    if (p.DOI) {
      item.doi = p.DOI;
      item.url = `https://doi.org/${p.DOI}`;
    } else if (p.URL) {
      item.url = p.URL;
    }
    return item;
  });

  const payload = {
    meta: {
      generated: new Date().toISOString(),
      source: root,
      license: LICENSE_URL,
      count: data.length,
      schema: 'publications',
      canonical: `${root}/publications.csl.json`,
    },
    data,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
