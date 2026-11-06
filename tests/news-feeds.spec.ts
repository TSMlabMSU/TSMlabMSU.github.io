import { test, expect } from '@playwright/test';

const atomNs = 'http://www.w3.org/2005/Atom';
const sitemapNs = 'http://www.sitemaps.org/schemas/sitemap/0.9';

type NewsItem = { slug: string; url: string };

async function parseXml(page: import('@playwright/test').Page, xml: string, namespace: string) {
  return page.evaluate(
    ({ xml, namespace }) => {
      const document = new DOMParser().parseFromString(xml, 'application/xml');
      return {
        errors: [...document.querySelectorAll('parsererror')].map((node) => node.textContent),
        rootNamespace: document.documentElement.namespaceURI,
        entries: [...document.getElementsByTagNameNS(namespace, 'entry')].map((entry) => ({
          id: entry.getElementsByTagNameNS(namespace, 'id')[0]?.textContent,
          alternate: [...entry.getElementsByTagNameNS(namespace, 'link')].find(
            (link) => link.getAttribute('rel') === 'alternate'
          )?.getAttribute('href'),
        })),
        author: document.getElementsByTagNameNS(namespace, 'author')[0]?.textContent?.trim(),
        locs: [...document.getElementsByTagNameNS(namespace, 'loc')].map((loc) => loc.textContent),
      };
    },
    { xml, namespace }
  );
}

test.describe('news exports', () => {
  test.skip(
    ({ viewport }) => !!viewport && viewport.width < 760,
    'news export checks run once on the desktop project'
  );

  test('every API news URL targets its News-page anchor', async ({ page, request }) => {
    const response = await request.get('/api/news.json');
    expect(response.status()).toBe(200);
    const { data } = (await response.json()) as { data: NewsItem[] };
    expect(data.length).toBeGreaterThan(0);

    await page.goto('/news');
    for (const item of data) {
      const url = new URL(item.url);
      expect(url.origin).toBe('https://tsmlabmsu.com');
      expect(url.pathname).toBe('/news');
      expect(url.hash).toBe(`#news-${item.slug}`);
      await expect(page.locator(url.hash), `${item.url} should have one News-page target`).toHaveCount(1);
    }
  });

  test('Atom feed and sitemap are valid XML with stable news references', async ({ page, request }) => {
    const news = (await (await request.get('/api/news.json')).json()) as { data: NewsItem[] };
    const feed = await (await request.get('/feed.xml')).text();
    const atom = await parseXml(page, feed, atomNs);

    expect(atom.errors).toEqual([]);
    expect(atom.rootNamespace).toBe(atomNs);
    expect(atom.author).toBe('Turbulence Simulation & Modeling Lab');
    expect(atom.entries).toHaveLength(news.data.length);

    const legacyIds = new Set(atom.entries.map((entry) => entry.id));
    const alternateLinks = new Set(atom.entries.map((entry) => entry.alternate));
    for (const item of news.data) {
      expect(alternateLinks).toContain(item.url);
      expect(legacyIds).toContain(`${new URL(item.url).origin}/#news-${item.slug}`);
    }

    const sitemap = await (await request.get('/sitemap.xml')).text();
    const map = await parseXml(page, sitemap, sitemapNs);
    expect(map.errors).toEqual([]);
    expect(map.rootNamespace).toBe(sitemapNs);
    expect(map.locs).toContain(`${new URL(news.data[0].url).origin}/news`);
  });
});
