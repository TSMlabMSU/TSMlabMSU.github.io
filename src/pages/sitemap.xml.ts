// Hand-built sitemap. Lists the human pages PLUS the machine
// data files (deliberate AI-welcoming choice). <lastmod> reflects real content change
// (latest news/content date), never the build timestamp. Excludes only the .md
// twins (alternates, not canonical). A hand-built endpoint is used instead of
// @astrojs/sitemap because that integration cannot enumerate non-HTML endpoints
// (the .bib/.json/.xml exports) and would emit build-time lastmods.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { base } from '../lib/site';

export const GET: APIRoute = async ({ site }) => {
  const root = base(site);

  const news = await getCollection('news');
  const datasets = await getCollection('datasets');

  const isoDay = (d: Date) => d.toISOString().slice(0, 10);
  const latest = (dates: Date[]) =>
    dates.length ? isoDay(new Date(Math.max(...dates.map((d) => d.valueOf())))) : undefined;

  const newsDates = news.map((n) => n.data.date);
  const datasetDates = datasets.map((d) => d.data.date).filter(Boolean) as Date[];
  const homeLastmod = latest(newsDates);
  const dataLastmod = latest([...datasetDates, ...newsDates]);

  // Human pages + Data & Code. lastmod only where content-derived.
  const pages: { loc: string; lastmod?: string }[] = [
    { loc: `${root}/`, lastmod: homeLastmod },
    { loc: `${root}/team` },
    { loc: `${root}/research` },
    { loc: `${root}/publications` },
    { loc: `${root}/news`, lastmod: homeLastmod },
    { loc: `${root}/contact-us` },
    { loc: `${root}/data`, lastmod: dataLastmod },
  ];

  // Machine data files — discoverable structured exports.
  const machine: string[] = [
    `${root}/publications.csl.json`,
    `${root}/publications.bib`,
    `${root}/api/people.json`,
    `${root}/api/publications.json`,
    `${root}/api/news.json`,
    `${root}/datasets.json`,
    `${root}/feed.xml`,
    `${root}/llms.txt`,
  ];

  const urls = [
    ...pages.map(
      (p) =>
        `  <url>\n    <loc>${p.loc}</loc>${p.lastmod ? `\n    <lastmod>${p.lastmod}</lastmod>` : ''}\n  </url>`
    ),
    ...machine.map((loc) => `  <url><loc>${loc}</loc></url>`),
  ].join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
