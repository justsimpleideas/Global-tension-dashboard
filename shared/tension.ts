import type { Article, ConflictConfig } from './types';

/**
 * Tension scoring — deterministic and transparent, derived only from collected
 * article volume and recency:
 *
 * Per conflict (0-100):
 *   W     = sum over its articles of 0.5^(ageHours / 48)   (48h half-life)
 *   score = 100 * (1 - e^(-W / 25))                        (saturating curve)
 *   → 0 articles = 0; ~17 recent articles ≈ 50; sustained heavy coverage → 100.
 *
 * Global index (0-100):
 *   0.5 * mean(top 5 conflict scores)  — how hot the hottest fronts are
 * + 50  * conflictShare                — how much of all world news is conflict news
 */

export const HALF_LIFE_HOURS = 48;
export const SATURATION = 25;

export interface ConflictTension {
  id: string;
  score: number;
  articleCount: number;
}

export interface TensionReport {
  global: number;
  level: TensionLevel;
  /** Fraction (0-1) of all articles tagged to at least one conflict. */
  conflictShare: number;
  perConflict: ConflictTension[];
}

export type TensionLevel = 'Calm' | 'Elevated' | 'High' | 'Severe' | 'Critical';

export function tensionLevel(score: number): TensionLevel {
  if (score < 20) return 'Calm';
  if (score < 40) return 'Elevated';
  if (score < 60) return 'High';
  if (score < 80) return 'Severe';
  return 'Critical';
}

function recencyWeight(publishedAt: string, now: number): number {
  const ageHours = Math.max(0, (now - Date.parse(publishedAt)) / 3_600_000);
  return Math.pow(0.5, ageHours / HALF_LIFE_HOURS);
}

export function computeTension(
  articles: Article[],
  conflicts: ConflictConfig[],
  now: number,
): TensionReport {
  const weights = new Map<string, number>();
  const counts = new Map<string, number>();
  let tagged = 0;

  for (const article of articles) {
    if (article.conflicts.length > 0) tagged += 1;
    const w = article.conflicts.length > 0 ? recencyWeight(article.publishedAt, now) : 0;
    for (const id of article.conflicts) {
      weights.set(id, (weights.get(id) ?? 0) + w);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  const perConflict: ConflictTension[] = conflicts
    .map((c) => ({
      id: c.id,
      score: Math.round(100 * (1 - Math.exp(-(weights.get(c.id) ?? 0) / SATURATION))),
      articleCount: counts.get(c.id) ?? 0,
    }))
    .sort((a, b) => b.score - a.score || b.articleCount - a.articleCount);

  const top = perConflict.slice(0, 5);
  const topMean = top.length
    ? top.reduce((sum, c) => sum + c.score, 0) / top.length
    : 0;
  const conflictShare = articles.length > 0 ? tagged / articles.length : 0;
  const global = Math.min(100, Math.round(0.5 * topMean + 50 * conflictShare));

  return { global, level: tensionLevel(global), conflictShare, perConflict };
}
