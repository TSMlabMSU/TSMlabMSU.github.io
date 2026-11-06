// BibTeX export, generated from the canonical CSL-JSON.
import type { APIRoute } from 'astro';
import { bibtexAll } from '../lib/pubs';

export const GET: APIRoute = () =>
  new Response(bibtexAll(), {
    // application/x-bibtex is the correct MIME; static hosts may downgrade to text/plain (accepted).
    headers: { 'Content-Type': 'application/x-bibtex; charset=utf-8' },
  });
