// /api/news.json — {meta, data[]} envelope. Dated lab news items.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { base, LICENSE_URL } from '../../lib/site';
import { newsSlug, newsUrl } from '../../lib/news';

export const GET: APIRoute = async ({ site }) => {
  const root = base(site);
  const items = (await getCollection('news')).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf()
  );

  const data = items.map((n) => {
    const slug = newsSlug(n);
    const item: Record<string, unknown> = {
      slug,
      date: n.data.date.toISOString().slice(0, 10),
      title: n.data.title,
    };
    if (n.data.category) item.category = n.data.category;
    if (n.data.link) item.link = n.data.link;
    if (n.body?.trim()) item.summary = n.body.trim();
    item.url = newsUrl(root, n);
    return item;
  });

  const payload = {
    meta: {
      generated: new Date().toISOString(),
      source: root,
      license: LICENSE_URL,
      count: data.length,
      schema: 'news',
    },
    data,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
