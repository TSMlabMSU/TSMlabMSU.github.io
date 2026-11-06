import { test, expect } from '@playwright/test';
import { PAGES, NAV_LINKS } from './_shared';

// The desktop nav lives in <nav.nav-desktop>. On a mobile viewport it is CSS-hidden,
// so the nav suite is scoped to projects whose viewport is wide enough for it.
function desktopNav(page: import('@playwright/test').Page) {
  return page.locator('nav.nav-desktop');
}

test.describe('nav', () => {
  test.skip(
    ({ viewport }) => !!viewport && viewport.width < 760,
    'desktop nav is hidden on mobile viewports (covered by dark-mode mobile tests)'
  );

  for (const page of PAGES) {
    test(`${page.path} desktop nav has all 7 links with correct hrefs`, async ({ page: pw }) => {
      await pw.goto(page.path);
      const nav = desktopNav(pw);
      await expect(nav).toBeVisible();

      for (const link of NAV_LINKS) {
        const anchor = nav.getByRole('link', { name: link.label, exact: true });
        await expect(anchor, `missing nav link "${link.label}" on ${page.path}`).toHaveCount(1);
        await expect(anchor, `wrong href for "${link.label}" on ${page.path}`).toHaveAttribute(
          'href',
          link.href
        );
      }
    });

    test(`${page.path} marks its own nav item active (aria-current + accent)`, async ({
      page: pw,
    }) => {
      await pw.goto(page.path);
      const nav = desktopNav(pw);
      // The active item carries aria-current="page".
      const active = nav.locator('a[aria-current="page"]');
      await expect(active, `${page.path} should have exactly one active nav item`).toHaveCount(1);
      const expectedLabel = NAV_LINKS.find((l) => l.href === page.path)!.label;
      await expect(active).toHaveText(expectedLabel);
      // Accent styling: SiteHeader applies an inline accent color + underline.
      const style = (await active.getAttribute('style')) ?? '';
      expect(style, `active item on ${page.path} should use the accent style`).toContain(
        'var(--accent)'
      );
    });
  }

  // Click-through: from the home page, each nav link navigates to the right route.
  for (const link of NAV_LINKS) {
    test(`clicking the "${link.label}" nav link navigates to ${link.href}`, async ({
      page: pw,
    }) => {
      await pw.goto('/');
      await desktopNav(pw).getByRole('link', { name: link.label, exact: true }).click();
      await pw.waitForLoadState('domcontentloaded');
      const url = new URL(pw.url());
      expect(url.pathname.replace(/\/$/, '') || '/').toBe(link.href.replace(/\/$/, '') || '/');
    });
  }
});
