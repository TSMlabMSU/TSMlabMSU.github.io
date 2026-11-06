// Schema.org JSON-LD builders. Load-bearing part = the sameAs PID
// chains (ORCID, ROR, DOI). Anti-fabrication: emit a field only when its value exists;
// never invent an ORCID/DOI/ROR. Built from the canonical content/data.

import { SITE, LICENSE_URL } from './site';
import { pubs, yearOf, authorNames, plainText, pageParts, type CSLItem } from './pubs';
import { rightsSchema } from './rights';
import lab from '../data/lab.yaml';

// Identity/PID constants single-sourced from lab.yaml (parentOrg.ror, pi.links, pi.orcid).
const piLinkUrl = (rel: string): string | undefined =>
  lab.pi.links.find((l: { rel: string; url: string }) => l.rel === rel)?.url;
const ROR_MSU: string = lab.parentOrg.ror;
const PI_ORCID: string = piLinkUrl('orcid') ?? `https://orcid.org/${lab.pi.orcid}`;
const PI_SCHOLAR: string | undefined = piLinkUrl('scholar');
const PI_RESEARCHGATE: string | undefined = piLinkUrl('researchgate');

const LAB_ID = `${SITE}/#lab`;

export function researchOrganization() {
  return {
    '@context': 'https://schema.org',
    '@type': 'ResearchOrganization',
    '@id': LAB_ID,
    name: lab.name,
    alternateName: lab.shortName,
    url: `${SITE}/`,
    description:
      'Research group studying wall-bounded turbulent flows via large-scale high-fidelity simulation and physics- and data-based predictive modeling.',
    parentOrganization: {
      '@type': 'CollegeOrUniversity',
      name: lab.parentOrg.name,
      '@id': ROR_MSU,
      sameAs: ROR_MSU,
    },
    department: { '@type': 'Organization', name: lab.department },
    founder: { '@type': 'Person', '@id': PI_ORCID, name: lab.pi.name },
    funder: [
      { '@type': 'Organization', name: 'Office of Naval Research' },
      { '@type': 'Organization', name: 'National Science Foundation' },
    ],
    license: LICENSE_URL,
  };
}

export function piPerson() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': PI_ORCID,
    name: lab.pi.name,
    givenName: 'Junlin',
    familyName: 'Yuan',
    jobTitle: 'Associate Professor',
    affiliation: { '@type': 'ResearchOrganization', '@id': LAB_ID },
    worksFor: {
      '@type': 'CollegeOrUniversity',
      name: lab.parentOrg.name,
      '@id': ROR_MSU,
    },
    alumniOf: { '@type': 'CollegeOrUniversity', name: "Queen's University" },
    url: `${SITE}/team`,
    sameAs: [PI_ORCID, PI_SCHOLAR, PI_RESEARCHGATE].filter(Boolean),
    // Structured contact path WITHOUT exposing a raw, harvestable address — the email
    // itself stays off the served HTML/JSON (it is already public on the MSU faculty page).
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'inquiries',
      url: `${SITE}/contact-us`,
    },
  };
}

// One ScholarlyArticle node per publication. @id/sameAs only when a DOI exists;
// DOI-less entries fall back to the publications-page URL as @id (no sameAs).
export function scholarlyArticle(p: CSLItem) {
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': p.type === 'paper-conference' ? 'ScholarlyArticle' : 'ScholarlyArticle',
    headline: plainText(p.title),
    name: plainText(p.title),
    author: authorNames(p.author).map((name) => ({ '@type': 'Person', name })),
  };
  // Per-paper rights: hosted manuscripts carry publisher terms (usageInfo) + version status,
  // NOT the site's CC-BY. Gold-OA VoRs get a real CC-BY license. (See src/lib/rights.ts.)
  Object.assign(node, rightsSchema(p));
  const y = yearOf(p);
  if (y) node.datePublished = String(y);
  if (p['container-title']) {
    node.isPartOf = { '@type': 'Periodical', name: p['container-title'] };
  }
  if (p.volume) node.volumeNumber = p.volume;
  const { first, last } = pageParts(p.page);
  if (first) node.pageStart = first;
  if (last) node.pageEnd = last;
  if (p.DOI) {
    const doiUrl = `https://doi.org/${p.DOI}`;
    node['@id'] = doiUrl;
    node.sameAs = doiUrl;
    node.identifier = doiUrl;
  } else {
    node['@id'] = `${SITE}/publications#${p.id}`;
  }
  return node;
}

export function allScholarlyArticles() {
  return pubs.map(scholarlyArticle);
}

// One Dataset node per dataset. Zenodo DOI is canonical and reused as @id/identifier/url.
// license comes verbatim from content; emit citation cross-link to related publications.
export function datasetNode(d: {
  title: string;
  shortDescription: string;
  creators: { family?: string; given?: string; literal?: string }[];
  platform: string;
  doi: string;
  url?: string;
  relatedPublications: string[];
  license: string;
  version?: string;
  date?: Date;
  keywords?: string[];
}) {
  const doiUrl = d.url ?? `https://doi.org/${d.doi}`;
  const node: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    '@id': `https://doi.org/${d.doi}`,
    identifier: `https://doi.org/${d.doi}`,
    name: d.title,
    description: d.shortDescription,
    creator: d.creators.map((c) => ({
      '@type': 'Person',
      name: 'literal' in c && c.literal ? c.literal : [c.given, c.family].filter(Boolean).join(' '),
    })),
    includedInDataCatalog: { '@type': 'DataCatalog', name: d.platform, url: 'https://zenodo.org/' },
    distribution: {
      '@type': 'DataDownload',
      contentUrl: doiUrl,
      encodingFormat: 'application/zip',
    },
    url: doiUrl,
  };
  if (d.date) node.datePublished = String(d.date.getUTCFullYear());
  if (d.version) node.version = d.version;
  if (d.keywords?.length) node.keywords = d.keywords;
  // Only emit license when it is a real value (content may carry TODO(owner)).
  if (d.license && !/^TODO\(/.test(d.license)) node.license = d.license;
  // Dataset side of the bidirectional dataset<->publication cross-link.
  const pubMap = new Map(pubs.map((p) => [p.id, p]));
  const citations = d.relatedPublications
    .map((id) => {
      const p = pubMap.get(id);
      if (!p) return null;
      return p.DOI ? `https://doi.org/${p.DOI}` : `${SITE}/publications#${p.id}`;
    })
    .filter(Boolean);
  if (citations.length) node.citation = citations.length === 1 ? citations[0] : citations;
  return node;
}
