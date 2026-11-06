import type { CollectionEntry } from 'astro:content';

export function newsSlug(entry: CollectionEntry<'news'>): string {
  return entry.data.slug ?? entry.id.replace(/\.md$/, '');
}

export function newsUrl(root: string, entry: CollectionEntry<'news'>): string {
  return `${root}/news#news-${newsSlug(entry)}`;
}

// Atom entry IDs are permanent identifiers. Keep their original Home-fragment
// form even though the human-facing alternate link now targets /news.
export function legacyNewsAtomId(root: string, entry: CollectionEntry<'news'>): string {
  return `${root}/#news-${newsSlug(entry)}`;
}
