// /datasets.json — {meta, data[]} envelope for datasets.
// Each item carries the Dataset fields plus the related-publication link (the dataset
// side of the bidirectional dataset<->publication cross-link). Zenodo DOI is canonical.
// Per-dataset license comes straight from content (may be TODO(owner) — NOT defaulted).

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { base, LICENSE_URL } from '../lib/site';

export const GET: APIRoute = async ({ site }) => {
  const root = base(site);
  const datasets = (await getCollection('datasets')).sort((a, b) => {
    const ay = a.data.date?.valueOf() ?? 0;
    const by = b.data.date?.valueOf() ?? 0;
    return by - ay;
  });

  const data = datasets.map((ds) => {
    const d = ds.data;
    const creators = d.creators.map((c) =>
      'literal' in c ? c.literal : [c.given, c.family].filter(Boolean).join(' ')
    );
    const item: Record<string, unknown> = {
      slug: d.slug,
      title: d.title,
      shortDescription: d.shortDescription,
      creators,
      platform: d.platform,
      doi: d.doi,
      url: d.url ?? `https://doi.org/${d.doi}`,
      relatedPublications: d.relatedPublications,
      license: d.license,
    };
    if (d.version) item.version = d.version;
    if (d.date) item.date = d.date.toISOString().slice(0, 10);
    if (d.keywords) item.keywords = d.keywords;
    return item;
  });

  const payload = {
    meta: {
      generated: new Date().toISOString(),
      source: root,
      // Site CONTENT license; per-dataset license is on each data[] item (may differ).
      license: LICENSE_URL,
      count: data.length,
      schema: 'datasets',
    },
    data,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
