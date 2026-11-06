# TSM Lab Website

Source for the [Turbulence Simulation & Modeling Lab](https://www.tsmlabmsu.com) website at Michigan State University. The site is built with Astro and deployed to GitHub Pages.

## Development

Requirements: Node.js 22.12 or newer and npm. `.nvmrc` selects Node 22 for development and CI.

```bash
npm ci
npx playwright install chromium
npm run dev
npm run validate
npm run build
npm test
```

The default suite checks local output without fetching external PDFs. Run `npm run test:external` to include live CV and publication PDF checks. `npm run dev` listens locally; use `npm run dev -- --host` only when you intend to expose it to your network.

## Structure

- `src/content/` — people, news, research themes, and datasets
- `src/data/` — lab metadata, publication records, and publisher policies
- `src/assets/` — site images
- `src/components/`, `src/layouts/`, `src/pages/` — Astro interface and routes
- `public/` — static assets and custom-domain configuration
- `scripts/` — content validation and link-checking utilities
- `tests/` — Playwright test suite

Before publishing anything, check it against [PUBLISHING.md](PUBLISHING.md); `npm run check:publish` automates the parts a script can check.

Pull requests and pushes to `main` run the publishing check, content validation, a production build, and desktop/mobile Chromium tests through `.github/workflows/deploy.yml`. Only successful builds on `main` deploy to GitHub Pages. Dependency and GitHub Actions updates are checked weekly by Dependabot.

## Licensing

- Code in this repository is licensed under the [MIT License](LICENSE).
- Site text, metadata, and citation exports are licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- Hosted paper PDFs are author-accepted manuscripts or publisher-permitted versions under each publisher's terms — not CC BY. Per-paper rights are declared in each publication's JSON-LD.
