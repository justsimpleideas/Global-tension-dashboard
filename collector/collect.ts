import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Parser from 'rss-parser';
import type {
  Article,
  CollectMeta,
  ConflictConfig,
  FeedConfig,
  FeedStatus,
  MarketsData,
  NewsData,
  RegionConfig,
} from '../shared/types';
import { buildCountryMatchers, matchConflicts, matchRegions } from './classify';
import { collectOilPrices } from './markets';
import { normalizeSource, stripNonLatinTitleSuffix, stripSourceSuffix } from './sources';
import { articleId, mergeArticles } from './store';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONFIG_DIR = path.join(ROOT, 'shared', 'config');
const DATA_DIR = path.join(ROOT, 'public', 'data');

// Optional local secrets (OILPRICEAPI_KEY). CI passes them as real env vars.
const ENV_FILE = path.join(ROOT, '.env');
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

const feeds = readJson<FeedConfig[]>(path.join(CONFIG_DIR, 'feeds.json'));
const conflicts = readJson<ConflictConfig[]>(path.join(CONFIG_DIR, 'conflicts.json'));
const regions = readJson<RegionConfig[]>(path.join(CONFIG_DIR, 'regions.json'));
const countryMatchers = buildCountryMatchers(regions);

const parser = new Parser({
  timeout: 20000,
  headers: {
    'user-agent': 'Mozilla/5.0 (compatible; GlobalTensionDashboard/0.1; +https://github.com)',
    accept: 'application/rss+xml, application/rdf+xml, application/atom+xml, application/xml, text/xml',
  },
  customFields: { item: [['source', 'gnSource']] },
});

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function itemSource(item: Record<string, unknown>, feed: FeedConfig, isGoogleNews: boolean): string {
  // Only Google News items carry the real outlet in <source>; other feeds may use
  // that element for photo credits or self-references.
  if (isGoogleNews) {
    const gn = item.gnSource;
    if (typeof gn === 'string' && gn.trim()) return normalizeSource(gn);
    if (gn && typeof gn === 'object' && typeof (gn as { _?: string })._ === 'string') {
      return normalizeSource((gn as { _: string })._);
    }
  }
  return feed.name;
}

function itemDate(item: { isoDate?: string; pubDate?: string }, fallback: Date): string {
  const raw = item.isoDate || item.pubDate;
  if (raw) {
    const t = Date.parse(raw);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  return fallback.toISOString();
}

/** Hard cap per feed; rss-parser's own timeout can miss slow-dripping sockets. */
const FEED_TIMEOUT_MS = 30000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function collectFeed(
  feed: FeedConfig,
  now: Date,
): Promise<{ status: FeedStatus; articles: Article[] }> {
  const isGoogleNews = feed.url.includes('news.google.com');
  try {
    const parsed = await withTimeout(parser.parseURL(feed.url), FEED_TIMEOUT_MS);
    const articles: Article[] = [];
    for (const item of parsed.items ?? []) {
      const link = (item.link ?? '').trim();
      let title = stripHtml(item.title ?? '');
      if (!link || !title) continue;

      const source = itemSource(item as unknown as Record<string, unknown>, feed, isGoogleNews);
      // Google News titles end with " - Source"; strip it since we show the source separately.
      if (isGoogleNews) title = stripSourceSuffix(title, source);
      title = stripNonLatinTitleSuffix(title);
      // Google News descriptions are just lists of related links — not a real summary.
      const summary = isGoogleNews
        ? ''
        : stripHtml(item.contentSnippet ?? item.content ?? '').slice(0, 300);

      const text = `${title} ${summary}`;
      const { countries, regions: articleRegions } = matchRegions(
        text,
        countryMatchers,
        feed.regionHint,
      );
      articles.push({
        id: articleId(link),
        title,
        link,
        source,
        publishedAt: itemDate(item, now),
        summary,
        conflicts: matchConflicts(text, conflicts),
        regions: articleRegions,
        countries,
      });
    }
    return {
      status: { id: feed.id, name: feed.name, ok: true, items: articles.length },
      articles,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: { id: feed.id, name: feed.name, ok: false, items: 0, error: message },
      articles: [],
    };
  }
}

async function main() {
  const now = new Date();
  const newsPath = path.join(DATA_DIR, 'news.json');
  const stored: Article[] = existsSync(newsPath)
    ? readJson<NewsData>(newsPath).articles
    : [];
  // Re-classify stored articles so config edits apply retroactively. The feed's
  // regionHint is gone at this point, so keep old regions when nothing matches.
  const existing: Article[] = stored.map((a) => {
    const source = normalizeSource(a.source);
    const title = stripSourceSuffix(stripNonLatinTitleSuffix(a.title), source);
    const text = `${title} ${a.summary}`;
    const { countries, regions: articleRegions } = matchRegions(text, countryMatchers);
    return {
      ...a,
      title,
      source,
      conflicts: matchConflicts(text, conflicts),
      regions: articleRegions.length > 0 ? articleRegions : a.regions,
      countries,
    };
  });
  const existingIds = new Set(existing.map((a) => a.id));

  console.log(`Collecting ${feeds.length} feeds...`);
  const results = await Promise.all(feeds.map((f) => collectFeed(f, now)));

  const statuses: FeedStatus[] = [];
  const incoming: Article[] = [];
  for (const r of results) {
    statuses.push(r.status);
    incoming.push(...r.articles);
    const label = r.status.ok ? `${r.status.items} items` : `FAILED (${r.status.error})`;
    console.log(`  ${r.status.ok ? 'ok  ' : 'fail'} ${r.status.id}: ${label}`);
  }

  const okCount = statuses.filter((s) => s.ok).length;
  if (okCount === 0) {
    console.error('All feeds failed — keeping existing data untouched.');
    process.exitCode = 1;
    return;
  }

  const merged = mergeArticles(existing, incoming, now);
  const newCount = merged.filter((a) => !existingIds.has(a.id)).length;

  const data: NewsData = {
    generatedAt: now.toISOString(),
    articleCount: merged.length,
    articles: merged,
  };
  const meta: CollectMeta = {
    generatedAt: now.toISOString(),
    feeds: statuses,
    totalArticles: merged.length,
    newArticles: newCount,
  };

  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(newsPath, JSON.stringify(data));
  writeFileSync(path.join(DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 2));

  // Oil prices are best-effort: failures never break the news run, and stale
  // data from a previous run is kept rather than overwritten with nothing.
  try {
    const marketsPath = path.join(DATA_DIR, 'markets.json');
    let previous: MarketsData | null = null;
    try {
      if (existsSync(marketsPath)) previous = readJson<MarketsData>(marketsPath);
    } catch {
      previous = null;
    }
    const apiKey = process.env.OILPRICEAPI_KEY?.trim() || undefined;
    const oil = await collectOilPrices(now, { apiKey, previous });
    for (const note of oil.notes) console.log(`  markets: ${note}`);
    if (oil.data) {
      writeFileSync(marketsPath, JSON.stringify(oil.data, null, 2));
      const summary = oil.data.oil
        .map((s) => `${s.name} $${s.latest.toFixed(2)} (${s.changePct >= 0 ? '+' : ''}${s.changePct}%)`)
        .join(', ');
      console.log(`  markets: ${summary} [${oil.data.source}]`);
      if (oil.data.eia) {
        console.log(`  markets: EIA last release ${oil.data.eia.lastRelease}, next ${oil.data.eia.nextRelease}`);
      }
      console.log(
        apiKey
          ? `  markets: live quotes ${oil.data.live?.quotes.map((q) => `${q.id} $${q.price}`).join(', ') ?? 'unavailable'}`
          : '  markets: no OILPRICEAPI_KEY set — daily history only',
      );
    } else {
      console.log('  markets: all sources failed — keeping previous data if any.');
    }
  } catch (err) {
    console.log(`  markets: unexpected error (${err instanceof Error ? err.message : err})`);
  }

  const conflictCount = merged.filter((a) => a.conflicts.length > 0).length;
  console.log(
    `\nDone: ${okCount}/${feeds.length} feeds ok, ` +
      `${newCount} new articles, ${merged.length} total ` +
      `(${conflictCount} tagged to conflicts).`,
  );
}

main().then(
  // Lingering sockets from timed-out feeds must not keep the process alive.
  () => process.exit(process.exitCode ?? 0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
