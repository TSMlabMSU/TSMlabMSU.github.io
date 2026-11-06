import { test, expect } from '@playwright/test';
import { MACHINE_ENDPOINTS, NEWS_RECORDS, PUBLICATION_RECORDS } from './_shared';

type PublicationApiRecord = { id: string; title: string };
type NewsApiRecord = { slug: string; date: string; title: string };

// USER STORY: every machine endpoint serves 200, the right content-type, and a
// non-empty body. Plus structural assertions on the JSON envelopes and llms.txt.
test.describe('machine-endpoints', () => {
  test.skip(
    ({ viewport }) => !!viewport && viewport.width < 760,
    'endpoint checks run once on the desktop project'
  );

  for (const ep of MACHINE_ENDPOINTS) {
    test(`${ep.path} → 200, ${ep.ctype} content-type, non-empty body`, async ({ request }) => {
      const res = await request.get(ep.path);
      expect(res.status(), `bad status for ${ep.path}`).toBe(200);

      // Static hosts (astro preview, GitHub Pages) don't set a content-type for
      // unusual extensions like .bib — that's host-dependent and not a site bug.
      // So: when a content-type IS present it must match; always assert the body shape.
      const ctype = (res.headers()['content-type'] ?? '').toLowerCase();
      const accepted = ep.ctype.split('|');
      if (ctype) {
        expect(
          accepted.some((t) => ctype.includes(t)),
          `content-type "${ctype}" for ${ep.path} should match one of [${accepted.join(', ')}]`
        ).toBe(true);
      }

      const body = await res.text();
      expect(body.trim().length, `${ep.path} body should be non-empty`).toBeGreaterThan(0);
      // BibTeX body must actually look like BibTeX (the content-type is unreliable for .bib).
      if (ep.path.endsWith('.bib')) {
        expect(body, `${ep.path} should contain BibTeX entries`).toMatch(/@\w+\s*\{/);
      }
    });
  }

  test('/api/publications.json preserves every source publication id and title', async ({ request }) => {
    const res = await request.get('/api/publications.json');
    expect(res.status()).toBe(200);
    const json = (await res.json()) as { meta: { count: number }; data: PublicationApiRecord[] };
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.meta.count).toBe(PUBLICATION_RECORDS.length);
    expect(json.data).toHaveLength(PUBLICATION_RECORDS.length);

    const recordsById = new Map(json.data.map((record) => [record.id, record]));
    for (const expected of PUBLICATION_RECORDS) {
      expect(recordsById.get(expected.id), `missing API publication ${expected.id}`).toMatchObject({
        id: expected.id,
        title: expected.title,
      });
    }
  });

  test('/api/news.json preserves every source news slug, date, and title', async ({ request }) => {
    const res = await request.get('/api/news.json');
    expect(res.status()).toBe(200);
    const json = (await res.json()) as { meta: { count: number }; data: NewsApiRecord[] };
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.meta.count).toBe(NEWS_RECORDS.length);
    expect(json.data).toHaveLength(NEWS_RECORDS.length);

    const recordsBySlug = new Map(json.data.map((record) => [record.slug, record]));
    for (const expected of NEWS_RECORDS) {
      expect(recordsBySlug.get(expected.slug), `missing API news record ${expected.slug}`).toMatchObject(expected);
    }
  });

  test('/llms.txt first non-empty line starts with "# "', async ({ request }) => {
    const res = await request.get('/llms.txt');
    expect(res.status()).toBe(200);
    const body = await res.text();
    const firstLine = body.split('\n').map((l) => l.trim()).find((l) => l.length > 0);
    expect(firstLine, 'llms.txt should have a non-empty first line').toBeTruthy();
    expect(firstLine!.startsWith('# ')).toBe(true);
  });
});
