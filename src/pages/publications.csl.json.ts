// Serve the canonical publication records as CSL-JSON.
import type { APIRoute } from 'astro';
import pubsData from '../data/publications.csl.json';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(pubsData, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
