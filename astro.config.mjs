// @ts-check
import { defineConfig } from 'astro/config';
import yaml from '@rollup/plugin-yaml';

// Canonical site URL (apex; www → 301). Drives canonical links + future sitemap.
// Canonical site URL used for generated absolute URLs.
export default defineConfig({
  site: 'https://tsmlabmsu.com',
  // Legacy path aliases (old Google Sites / guessed URLs). GitHub Pages cannot
  // emit real HTTP 301s, so Astro SSG writes meta-refresh stubs.
  //
  // DO NOT add `*.html` → clean-path redirects here. Astro emits those as
  // `dist/<page>.html/index.html`, and the local preview server's `.html`
  // extension fallback then serves the stub for `/<page>` instead of the real
  // `dist/<page>/index.html` — every nav tab becomes a redirect loop. Keep
  // only aliases whose source path does not collide with a real page basename.
  redirects: {
    '/home': '/',
    '/people': '/team',
    '/contact': '/contact-us',
    '/about': '/',
    '/about-us': '/',
  },
  // Prefetch visible internal links (pages are tiny static HTML) — navigation feels
  // instant with no visual change and no framework runtime.
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
  // Import Layer-2 YAML data files (src/data/*.yaml) as plain JS objects so pages
  // render from the single source of truth instead of hardcoded markup.
  vite: {
    plugins: [yaml()],
  },
});
