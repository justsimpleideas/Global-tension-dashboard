import type { ConflictConfig, RegionConfig } from '../shared/types';

/** Substring match against lowercased text. Keywords are lowercase phrases. */
function hitsAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

/**
 * Returns ids of conflicts the text belongs to.
 * A conflict matches when any "strong" phrase hits, or when at least one
 * phrase from each group of a pair hits.
 */
export function matchConflicts(text: string, conflicts: ConflictConfig[]): string[] {
  const t = ` ${text.toLowerCase().replace(/\s+/g, ' ')} `;
  const out: string[] = [];
  for (const c of conflicts) {
    if (hitsAny(t, c.match.any)) {
      out.push(c.id);
      continue;
    }
    for (const [groupA, groupB] of c.match.pairs) {
      if (hitsAny(t, groupA) && hitsAny(t, groupB)) {
        out.push(c.id);
        break;
      }
    }
  }
  return out;
}

export interface CountryMatcher {
  code: string;
  region: string;
  /** Case-insensitive matcher for full names and long aliases. */
  regex: RegExp | null;
  /** Case-sensitive matcher for short all-caps aliases (US, UK, UAE, ...). */
  exact: RegExp | null;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Wrap a term with word boundaries only where the edge is a word character. */
function bounded(term: string): string {
  const escaped = escapeRegex(term);
  const start = /^\w/.test(term) ? '\\b' : '';
  const end = /\w$/.test(term) ? '\\b' : '';
  return start + escaped + end;
}

export function buildCountryMatchers(regions: RegionConfig[]): CountryMatcher[] {
  const matchers: CountryMatcher[] = [];
  for (const region of regions) {
    for (const country of region.countries) {
      if (country.pattern) {
        matchers.push({
          code: country.code,
          region: region.id,
          regex: new RegExp(country.pattern, 'i'),
          exact: null,
        });
        continue;
      }
      const terms = [country.name, ...country.aliases];
      const shortCaps = terms.filter((a) => a.length <= 4 && a === a.toUpperCase());
      const normal = terms.filter((a) => !shortCaps.includes(a));
      matchers.push({
        code: country.code,
        region: region.id,
        regex: normal.length ? new RegExp(normal.map(bounded).join('|'), 'i') : null,
        exact: shortCaps.length ? new RegExp(shortCaps.map(bounded).join('|')) : null,
      });
    }
  }
  return matchers;
}

export interface RegionResult {
  countries: string[];
  regions: string[];
}

/**
 * Detects countries mentioned in the text and derives their regions.
 * Falls back to `regionHint` when nothing is detected.
 */
export function matchRegions(
  text: string,
  matchers: CountryMatcher[],
  regionHint?: string,
): RegionResult {
  const countries: string[] = [];
  const regions = new Set<string>();
  for (const m of matchers) {
    if ((m.regex && m.regex.test(text)) || (m.exact && m.exact.test(text))) {
      countries.push(m.code);
      regions.add(m.region);
    }
  }
  if (countries.length === 0 && regionHint) {
    regions.add(regionHint);
  }
  return { countries, regions: [...regions] };
}
