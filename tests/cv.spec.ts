import { test, expect } from '@playwright/test';
import { EXPECTED_CV_URL } from './_shared';

test.describe('cv', () => {
  test.skip(
    ({ viewport }) => !!viewport && viewport.width < 760,
    'CV link check runs once on the desktop project'
  );

  test('Team page CV link matches the configured hosted PDF URL', async ({ page }) => {
    await page.goto('/team');
    const cv = page.locator('a', { hasText: 'CV (PDF)' }).first();
    await expect(cv).toHaveAttribute('href', EXPECTED_CV_URL);
    expect(new URL(EXPECTED_CV_URL).pathname).toMatch(/\.pdf$/);
  });

  test('configured CV URL serves a PDF when external link checks are enabled', async ({ request }) => {
    test.skip(process.env.CHECK_EXTERNAL_LINKS !== '1', 'set CHECK_EXTERNAL_LINKS=1 to probe hosted files');
    const res = await request.get(EXPECTED_CV_URL);
    // R2 public URLs support Range requests, so 200 or 206 are both successful responses.
    expect([200, 206], `CV URL did not resolve: ${EXPECTED_CV_URL}`).toContain(res.status());
    expect((res.headers()['content-type'] ?? '').toLowerCase()).toContain('pdf');
  });
});
