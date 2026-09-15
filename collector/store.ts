import { createHash } from 'node:crypto';
import type { Article } from '../shared/types';

export const MAX_AGE_DAYS = 7;
export const MAX_ARTICLES = 3000;

export function articleId(link: string): string {
  return createHash('sha1').update(link.trim()).digest('hex').slice(0, 16);
}

/** Normalize a title so the same story from two feeds deduplicates. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Merge freshly collected articles into the existing set.
 * - Dedupes by article id (link hash) and by normalized title.
 * - Drops articles older than MAX_AGE_DAYS or dated in the future (>1 day).
 * - Sorts newest first and caps the total size.
 */
export function mergeArticles(existing: Article[], incoming: Article[], now: Date): Article[] {
  const minTime = now.getTime() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const maxTime = now.getTime() + 24 * 60 * 60 * 1000;

  const byId = new Map<string, Article>();
  const byTitle = new Map<string, Article>();

  const add = (article: Article) => {
    const t = Date.parse(article.publishedAt);
    if (Number.isNaN(t) || t < minTime || t > maxTime) return;
    if (byId.has(article.id)) return;
    const titleKey = normalizeTitle(article.title);
    if (titleKey && byTitle.has(titleKey)) return;
    byId.set(article.id, article);
    if (titleKey) byTitle.set(titleKey, article);
  };

  // Existing articles win so classifications stay stable across runs.
  for (const a of existing) add(a);
  for (const a of incoming) add(a);

  return [...byId.values()]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, MAX_ARTICLES);
}
