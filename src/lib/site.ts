// Shared machine-layer constants. The canonical base is astro.config `site`
// (https://tsmlabmsu.com); endpoints read Astro.site at build time and fall back here.

export const SITE = 'https://tsmlabmsu.com';
export const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';
export const LICENSE_SPDX = 'CC-BY-4.0';

export function base(astroSite?: URL): string {
  return (astroSite?.origin ?? SITE).replace(/\/$/, '');
}
