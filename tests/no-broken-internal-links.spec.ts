import { test, expect } from '@playwright/test';
import { PAGES } from './_shared';

// KEY USER STORY: no broken internal links anywhere on the site.
// Visit all 7 pages, collect every <a href>. For each INTERNAL href (starts with '/',
// including /cv.pdf and the machine endpoints) issue a request.get and assert status < 400,
// reporting every failing URL together with the page it appeared on. External http(s)
// hrefs are only checked for well-formedness (new URL() parses) — never fetched.
// mailto:/tel:/#fragments are ignored.

// Run once on desktop chromium only — link-graph coverage is viewport-independent
// and we don't want to re-crawl on the mobile project.
test.describe('no-broken-internal-links', () => {
  test.skip(
    ({ viewport }) => !!viewport && viewport.width < 760,
    'link crawl runs once on the desktop project'
  );

  test('every internal link resolves (status < 400) and external links are well-formed', async ({
    page,
    request,
    baseURL,
  }) => {
    type Found = { href: string; onPage: string };
    const internal = new Map<string, string>(); // normalized internal path -> first page seen on
    const malformedExternal: Found[] = [];

    for (const p of PAGES) {
      await page.goto(p.path);
      const hrefs = await page.locator('a[href]').evaluateAll((els) =>
        els.map((el) => (el as HTMLAnchorElement).getAttribute('href') ?? '')
      );
      for (const href of hrefs) {
        if (!href || href.startsWith('#')) continue;
        if (href.startsWith('mailto:') || href.startsWith('tel:')) continue;

        if (href.startsWith('/')) {
          // internal absolute-path link (incl. /cv.pdf, /api/*.json, /feed.xml, …)
          const key = href;
          if (!internal.has(key)) internal.set(key, p.path);
        } else if (/^https?:\/\//i.test(href)) {
          // external — validate format only, do not fetch
          try {
            // eslint-disable-next-line no-new
            new URL(href);
          } catch {
            malformedExternal.push({ href, onPage: p.path });
          }
        }
        // other schemes (relative without leading slash, javascript:, etc.) — ignore
      }
    }

    // Fetch each unique internal link and collect failures.
    const broken: { href: string; status: number; onPage: string }[] = [];
    for (const [href, onPage] of internal) {
      const url = new URL(href, baseURL).toString();
      const res = await request.get(url);
      if (res.status() >= 400) {
        broken.push({ href, status: res.status(), onPage });
      }
    }

    expect(
      malformedExternal,
      `Malformed external hrefs:\n${malformedExternal
        .map((m) => `  ${m.href} (on ${m.onPage})`)
        .join('\n')}`
    ).toHaveLength(0);

    expect(
      broken,
      `Broken internal links:\n${broken
        .map((b) => `  [${b.status}] ${b.href} (on ${b.onPage})`)
        .join('\n')}`
    ).toHaveLength(0);
  });
});
