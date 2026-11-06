// llms.txt. Strict format: single H1, one blockquote, optional
// prose with NO headings, then ## H2 sections, ## Optional last. Links point at the
// human pages and the machine data files. .md page-twins are deferred (§6), so links
// target the canonical HTML pages.

import type { APIRoute } from 'astro';
import { base } from '../lib/site';

export const GET: APIRoute = ({ site }) => {
  const u = base(site);

  const body = `# Turbulence Simulation & Modeling (TSM) Lab — Michigan State University

> Research group in the Department of Mechanical Engineering at Michigan State University (PI: Prof. Junlin Yuan) studying wall-bounded turbulent flows via large-scale high-fidelity simulation and physics- and data-based predictive modeling.

The TSM Lab uses large-scale, high-fidelity simulations to understand the fundamentals of turbulence and to develop next-generation predictive methods. Focus areas include wall-bounded turbulent flows with pressure gradients, unsteadiness, surface roughness, wall permeability, rotation, compressibility, and multiple phases, with applications spanning turbomachinery, vehicles, animal locomotion, rivers, and atmospheric flows. Funding from ONR, NSF, and industry. Site content (text, metadata, citation exports) is licensed CC-BY 4.0 and is free to use, quote, and train on with attribution. Hosted paper PDFs are author-accepted manuscripts (or, where the publisher permits, the version of record) under the respective publisher's terms — NOT CC-BY; per-paper rights are in each publication's JSON-LD (\`usageInfo\` / \`creativeWorkStatus\`). The site-level text/data-mining preference is at /.well-known/tdmrep.json.

## Pages
- [Home](${u}/): lab overview, mission, and News & Updates
- [Team](${u}/team): people — PI, students, postdocs, collaborators, alumni
- [Research](${u}/research): research themes and approach
- [Publications](${u}/publications): peer-reviewed publication list
- [Data & Code](${u}/data): datasets (Zenodo, by DOI) linked to their publications
- [News](${u}/news): papers, defenses, awards, and grants
- [Contact](${u}/contact-us): affiliation, address, and contact links

## Structured data
- [Publications (CSL-JSON, canonical)](${u}/publications.csl.json): all publications as CSL-JSON
- [Publications (BibTeX)](${u}/publications.bib): all publications as BibTeX
- [People (JSON)](${u}/api/people.json): roster with roles and identifiers
- [Publications (JSON)](${u}/api/publications.json): publications with venue/year/DOI
- [Datasets (JSON)](${u}/datasets.json): datasets with Zenodo DOI, creators, and related publication
- [News (JSON)](${u}/api/news.json): dated lab news items
- [News feed (Atom)](${u}/feed.xml): subscribe to lab updates

## Optional
- [PI Google Scholar](https://scholar.google.ca/citations?user=Je5B1hYAAAAJ): Junlin Yuan citation profile
- [PI ORCID](https://orcid.org/0000-0002-4711-6452): Junlin Yuan ORCID record
- [License (CC-BY 4.0)](https://creativecommons.org/licenses/by/4.0/): site content reuse terms
- [TDM rights (TDMRep)](${u}/.well-known/tdmrep.json): site-level text/data-mining preference signal
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
