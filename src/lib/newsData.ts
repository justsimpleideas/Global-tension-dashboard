import conflictsJson from '../../shared/config/conflicts.json';
import regionsJson from '../../shared/config/regions.json';
import type {
  Article,
  CollectMeta,
  ConflictConfig,
  MarketsData,
  NewsData,
  RegionConfig,
} from '../../shared/types';

export const conflicts = conflictsJson as ConflictConfig[];
export const regions = regionsJson as RegionConfig[];

export const conflictById = new Map(conflicts.map((c) => [c.id, c]));
export const regionById = new Map(regions.map((r) => [r.id, r]));
export const countryByCode = new Map(
  regions.flatMap((r) => r.countries.map((c) => [c.code, c] as const)),
);

export interface Loaded {
  data: NewsData;
  meta: CollectMeta | null;
}

// Data files are rewritten in place by the collector, so skip the HTTP cache.
const noCache: RequestInit = { cache: 'no-store' };

export async function loadNews(): Promise<Loaded> {
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}data/news.json`, noCache);
  if (!res.ok) {
    throw new Error(`Could not load data/news.json (${res.status}). Run "npm run collect" first.`);
  }
  const data = (await res.json()) as NewsData;
  let meta: CollectMeta | null = null;
  try {
    const metaRes = await fetch(`${base}data/meta.json`, noCache);
    if (metaRes.ok) meta = (await metaRes.json()) as CollectMeta;
  } catch {
    meta = null;
  }
  return { data, meta };
}

export async function loadMarkets(): Promise<MarketsData | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/markets.json`, noCache);
    if (!res.ok) return null;
    return (await res.json()) as MarketsData;
  } catch {
    return null;
  }
}

export function timeAgo(iso: string, now = Date.now()): string {
  const diff = now - Date.parse(iso);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function countBy<T>(items: T[], keys: (item: T) => string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    for (const key of keys(item)) {
      map.set(key, (map.get(key) ?? 0) + 1);
    }
  }
  return map;
}

export function searchArticles(articles: Article[], query: string): Article[] {
  const q = query.trim().toLowerCase();
  if (!q) return articles;
  const terms = q.split(/\s+/);
  return articles.filter((a) => {
    const text = `${a.title} ${a.summary} ${a.source}`.toLowerCase();
    return terms.every((t) => text.includes(t));
  });
}
