import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';
import { isWebUrl, isProfileUrl } from './lib/safety.mjs';

// Structured collections for news, people, research themes, and datasets.

const externalLink = z.object({
  // Absolute https/http, mailto:, or a root-relative path (e.g. /cv.pdf).
  url: z.string().refine(isProfileUrl, 'Expected an HTTP(S), mailto, or root-relative URL'),
  label: z.string().min(1),
  rel: z
    .enum(['cv', 'scholar', 'researchgate', 'orcid', 'linkedin', 'faculty', 'doi', 'pdf', 'video', 'paper', 'code', 'other'])
    .optional(),
});

const imageRef = z.string(); // repo-relative path; resolved + alt-checked by build/validation

// Optional provider-agnostic video block rendered by <VideoEmbed>.
// `id` is the entryId / stream UID / share id / R2 file key / video id for the chosen
// provider. Never fabricate ids — derive from a real source URL.
const videoEmbed = z.object({
  provider: z.enum([
    'mediaspace',
    'cloudflare-r2',
    'cloudflare-stream',
    'descript',
    'youtube',
    'vimeo',
  ]),
  id: z.string().min(1),
  title: z.string().min(1),
  poster: imageRef.optional(),
});

const news = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/news' }),
  schema: z.object({
    date: z.coerce.date(),
    slug: z.string().optional(),
    title: z.string(),
    category: z.string().optional(),
    link: z.string().refine(isWebUrl, 'Expected an HTTP(S) URL').optional(),
    video: videoEmbed.optional(),
  }),
});

const people = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/people' }),
  schema: z.object({
    name: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    role: z.enum(['pi', 'postdoc', 'phd', 'ms', 'undergrad', 'collaborator', 'staff', 'visitor']),
    roleLabel: z.string().optional(),
    status: z.enum(['current', 'alumni']),
    order: z.number().int().optional(),
    title: z.string().optional(),
    affiliation: z.string().optional(),
    degree: z.string().optional(),
    tenure: z.object({ start: z.string(), end: z.string().nullable() }).optional(),
    placement: z.string().optional(),
    email: z.email().optional(),
    photo: imageRef.optional(),
    orcid: z.string().regex(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/).optional(),
    links: z.array(externalLink).optional(),
    researchInterests: z.array(z.string()).optional(),
  }),
});

const research = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/research' }),
  schema: z.object({
    title: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    order: z.number().int(),
    summary: z.string().min(1),
    figure: imageRef.optional(),
    figureAlt: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    relatedPublications: z.array(z.string()).optional(),
  }),
});

const cslCreator = z
  .object({ family: z.string(), given: z.string().optional() })
  .or(z.object({ literal: z.string() }));

const datasets = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/datasets' }),
  schema: z.object({
    title: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    shortDescription: z.string().min(1),
    creators: z.array(cslCreator).min(1),
    platform: z.enum(['Zenodo', 'Dataverse', 'HPCC']).default('Zenodo'),
    doi: z.string().regex(/^10\.\d{4,9}\/\S+$/),
    url: z.string().refine(isWebUrl, 'Expected an HTTP(S) URL').optional(),
    relatedPublications: z.array(z.string()).min(1),
    license: z.string().min(1),
    version: z.string().optional(),
    date: z.coerce.date().optional(),
    keywords: z.array(z.string()).optional(),
    // Presentation (Data page card): header eyebrow label and, when the related
    // publication is confirmed, the human-readable cross-link text shown in the footer.
    cardLabel: z.string().optional(),
    relatedPaperLabel: z.string().optional(),
  }),
});

export const collections = { news, people, research, datasets };
