// Atom 1.0 feed for lab news. One <entry> per news item.
// News has no per-item pages, so each entry links to its stable News-page anchor.
// <rights> declares CC-BY 4.0.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { base } from '../lib/site';
import { legacyNewsAtomId, newsUrl } from '../lib/news';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const GET: APIRoute = async ({ site }) => {
  const root = base(site);
  const items = (await getCollection('news')).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
  );

  const updated = items.length ? items[0].data.date.toISOString() : new Date(0).toISOString();
  const entries = items
    .map((item) => {
      const url = newsUrl(root, item);
      const summary = item.body?.trim() || item.data.title;
      const relatedLink = item.data.link
        ? `\n    <link href="${esc(item.data.link)}" rel="related"/>`
        : '';
      return `  <entry>
    <title>${esc(item.data.title)}</title>
    <link href="${esc(url)}" rel="alternate" type="text/html"/>${relatedLink}
    <id>${esc(legacyNewsAtomId(root, item))}</id>
    <updated>${item.data.date.toISOString()}</updated>
    <summary>${esc(summary)}</summary>
  </entry>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>TSM Lab — News &amp; Updates</title>
  <link href="${root}/feed.xml" rel="self"/>
  <link href="${root}/" rel="alternate" type="text/html"/>
  <id>${root}/</id>
  <updated>${updated}</updated>
  <author><name>Turbulence Simulation &amp; Modeling Lab</name></author>
  <rights>CC-BY 4.0</rights>
${entries}
</feed>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' },
  });
};
