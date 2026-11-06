// /api/people.json — {meta, data[]} envelope. Roster with role,
// status (incl. alumni), slug, and known PIDs. Unknown PIDs are omitted, never stubbed.

import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { base, LICENSE_URL } from '../../lib/site';

export const GET: APIRoute = async ({ site }) => {
  const root = base(site);
  const people = (await getCollection('people')).sort(
    (a, b) => (a.data.order ?? 999) - (b.data.order ?? 999)
  );

  const data = people.map((p) => {
    const d = p.data;
    const item: Record<string, unknown> = {
      name: d.name,
      slug: d.slug,
      role: d.role,
      status: d.status,
    };
    if (d.roleLabel) item.roleLabel = d.roleLabel;
    if (d.title) item.title = d.title;
    if (d.affiliation) item.affiliation = d.affiliation;
    if (d.degree) item.degree = d.degree;
    if (d.tenure) item.tenure = d.tenure;
    if (d.placement) item.placement = d.placement;
    // Email is intentionally NOT exposed in machine output (anti-harvesting). Contact is the
    // /contact-us page (obfuscated mailto) — see the Person contactPoint in JSON-LD.
    if (d.orcid) item.orcid = `https://orcid.org/${d.orcid}`;
    if (d.researchInterests) item.researchInterests = d.researchInterests;
    if (d.links?.length) item.links = d.links;
    if (p.body?.trim()) item.bio = p.body.trim();
    return item;
  });

  const payload = {
    meta: {
      generated: new Date().toISOString(),
      source: root,
      license: LICENSE_URL,
      count: data.length,
      schema: 'people',
    },
    data,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
