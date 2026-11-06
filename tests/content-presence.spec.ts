import { test, expect } from '@playwright/test';
import { NEWS_RECORDS, PUBLICATION_RECORDS } from './_shared';

// USER STORY: each page actually renders its real content (not an empty shell).
test.describe('content-presence', () => {
  test.skip(
    ({ viewport }) => !!viewport && viewport.width < 760,
    'content rendering is viewport-independent; run once on desktop'
  );

  test('source fixtures contain records before rendered-content checks', () => {
    expect(PUBLICATION_RECORDS.length, 'publications source must not be empty').toBeGreaterThan(0);
    expect(NEWS_RECORDS.length, 'news source must not be empty').toBeGreaterThan(0);
  });

  test('home shows "Junlin Yuan" and the mission sentence', async ({ page }) => {
    await page.goto('/');
    const body = await page.locator('body').innerText();
    expect(body).toContain('Junlin Yuan');
    expect(body).toContain('high-fidelity simulations');
  });

  test('publications page renders every source publication by id and title', async ({ page }) => {
    await page.goto('/publications');
    const entries = page.locator('.pubyear ul > li');
    await expect(entries).toHaveCount(PUBLICATION_RECORDS.length);

    for (const record of PUBLICATION_RECORDS) {
      const entry = page.locator(`li#${record.id}`);
      await expect(entry, `missing publication ${record.id}`).toHaveCount(1);
      await expect(entry).toContainText(record.title);
    }
  });

  test('news page renders every source record with its id, date, and title', async ({ page }) => {
    await page.goto('/news');
    const rows = page.locator('li.nrow');
    await expect(rows).toHaveCount(NEWS_RECORDS.length);
    await expect(page.locator('li.nrow time[datetime]')).toHaveCount(NEWS_RECORDS.length);

    for (const record of NEWS_RECORDS) {
      const row = page.locator(`li#news-${record.slug}`);
      await expect(row, `missing news record ${record.slug}`).toHaveCount(1);
      await expect(row.locator(`time[datetime="${record.date}"]`)).toHaveCount(1);
      await expect(row).toContainText(record.title);
    }
  });

  test('contact page shows the address + a reachable but obfuscated email', async ({ page }) => {
    await page.goto('/contact-us');
    const body = await page.locator('body').innerText();
    expect(body).toContain('428 South Shaw Lane');
    // Email is intentionally NOT plaintext (anti-harvesting) — it is an entity-encoded mailto.
    expect(body).not.toContain('junlin@msu.edu');
    // ...but the browser-decoded mailto still resolves to the real address.
    const mailto = page.locator('a[href^="mailto:"]').first();
    await expect(mailto).toHaveAttribute('href', /mailto:junlin@msu\.edu/);
  });
});
