// Self-archiving rights, DERIVED from the single-source publisher table (src/data/publisher-policies.yaml).
// A paper declares only `version` (aam|vor) + DOI in publications.csl.json; the statement, the COAR
// version URI, and the schema.org rights signals are computed here. Mirrors scripts/stamp_rights.py
// (which stamps the same statement onto the PDF) — keep the two in sync via the shared YAML.

import policies from '../data/publisher-policies.yaml';

type Pol = {
  publisher: string;
  hostable: string[];
  embargoMonths: number;
  policyUrl?: string;
  openAccess?: boolean;
  statement: string;
};
type Policies = { journals: Record<string, Pol>; conference: Pol };
const POL = policies as Policies;

export type CSLLike = {
  id: string;
  type?: string;
  'container-title'?: string;
  DOI?: string;
  volume?: string;
  page?: string;
  issued?: { 'date-parts'?: number[][] };
  version?: string;
  pdfUrl?: string;
};

// COAR Version Types vocabulary (from NISO JAV).
const COAR_VERSION: Record<string, string> = {
  aam: 'http://purl.org/coar/version/c_ab4af688f83e57aa', // Author's Accepted Manuscript
  vor: 'http://purl.org/coar/version/c_970fb48d4fbd8a85', // Version of Record
};
const VERSION_LABEL: Record<string, string> = {
  aam: 'Author-accepted manuscript',
  vor: 'Version of record',
};
const CC_BY = 'https://creativecommons.org/licenses/by/4.0/';

export function policyFor(p: CSLLike): Pol | undefined {
  if (p.type === 'paper-conference') return POL.conference;
  const ct = p['container-title'];
  return ct ? POL.journals[ct] : undefined;
}

function fill(tpl: string, p: CSLLike): string {
  const y = p.issued?.['date-parts']?.[0]?.[0];
  const vp = p.volume && p.page ? ` ${p.volume}, ${p.page}` : p.volume ? ` ${p.volume}` : '';
  return tpl
    .split('{journal}').join(p['container-title'] ?? '')
    .split('{volpage}').join(vp)
    .split('{year}').join(String(y ?? ''))
    .split('{doi}').join(p.DOI ?? '');
}

/** Publisher-required rights statement for a hosted PDF; null when no PDF or no known policy. */
export function rightsStatement(p: CSLLike): string | null {
  if (!p.pdfUrl) return null;
  const pol = policyFor(p);
  return pol ? fill(pol.statement, p) : null;
}

export function versionLabel(v?: string): string {
  return (v && VERSION_LABEL[v]) || '';
}
export function coarVersionUri(v?: string): string | undefined {
  return v ? COAR_VERSION[v] : undefined;
}

/** schema.org rights signals for a publication's JSON-LD node (so AI crawlers see per-paper terms). */
export function rightsSchema(p: CSLLike): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.version && COAR_VERSION[p.version]) out.creativeWorkStatus = versionLabel(p.version);
  const pol = policyFor(p);
  if (p.pdfUrl) {
    out.isAccessibleForFree = true;
    if (pol?.openAccess) out.license = CC_BY; // gold-OA VoR is genuinely CC-BY
    else if (pol?.policyUrl) out.usageInfo = pol.policyUrl; // publisher self-archiving terms (NOT CC-BY)
  } else {
    // No PDF hosted here — say so explicitly so a crawler doesn't read the absence of rights
    // fields as "rights undeclared". (The DOI still links the version of record.)
    out.isAccessibleForFree = false;
  }
  return out;
}
