export interface FeedConfig {
  id: string;
  name: string;
  url: string;
  /** Region id used as a fallback when no country is detected in the text. */
  regionHint?: string;
  /** Conflict id this query feed targets (recall booster only; classification is content-based). */
  conflictHint?: string;
}

export interface ConflictMatch {
  /** A single hit on any of these phrases is enough. */
  any: string[];
  /** Each pair is [groupA, groupB]; requires at least one hit in each group. */
  pairs: string[][][];
}

export interface ConflictConfig {
  id: string;
  name: string;
  parties: string;
  description: string;
  /** Approximate geographic center of the conflict, for the tension map. */
  epicenter: { lat: number; lon: number };
  match: ConflictMatch;
}

export interface CountryConfig {
  code: string;
  name: string;
  aliases: string[];
  /** Optional regex source (case-insensitive) overriding name/alias matching. */
  pattern?: string;
}

export interface RegionConfig {
  id: string;
  name: string;
  /** Accent color used to highlight this continent in the UI. */
  color: string;
  countries: CountryConfig[];
}

export interface Article {
  id: string;
  title: string;
  link: string;
  source: string;
  publishedAt: string;
  summary: string;
  conflicts: string[];
  regions: string[];
  /** ISO 3166-1 alpha-2 codes of countries detected in the text. */
  countries: string[];
}

export interface FeedStatus {
  id: string;
  name: string;
  ok: boolean;
  items: number;
  error?: string;
}

export interface NewsData {
  generatedAt: string;
  articleCount: number;
  articles: Article[];
}

export interface CollectMeta {
  generatedAt: string;
  feeds: FeedStatus[];
  totalArticles: number;
  newArticles: number;
}

export interface OilPricePoint {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  close: number;
}

export interface OilSeries {
  id: string;
  name: string;
  unit: string;
  latest: number;
  /** Absolute and percent change vs. the previous close. */
  change: number;
  changePct: number;
  series: OilPricePoint[];
}

export interface LiveQuote {
  /** Benchmark id matching OilSeries.id ('brent' | 'wti'). */
  id: string;
  price: number;
  /** When the provider observed this price (ISO). */
  asOf: string;
  /** Provider flagged the value as stale or carried forward. */
  stale: boolean;
}

export interface LiveQuotes {
  provider: string;
  fetchedAt: string;
  quotes: LiveQuote[];
}

/** EIA's published schedule for the daily spot price table (YYYY-MM-DD). */
export interface EiaSchedule {
  lastRelease: string;
  nextRelease: string;
}

export interface MarketsData {
  generatedAt: string;
  source: string;
  oil: OilSeries[];
  /** Intraday quotes; present only when an OILPRICEAPI_KEY was configured. */
  live?: LiveQuotes;
  eia?: EiaSchedule;
}
