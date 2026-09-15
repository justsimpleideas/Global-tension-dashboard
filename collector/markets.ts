import type {
  EiaSchedule,
  LiveQuote,
  LiveQuotes,
  MarketsData,
  OilPricePoint,
  OilSeries,
} from '../shared/types';

/**
 * Crude oil prices without API keys, from FRED's public CSV endpoint
 * (EIA daily spot prices; published with a few days' lag — fine for trends).
 * One request returns both benchmarks. Fetched by the collector; the browser
 * only reads the stored JSON.
 */

export const OIL_SERIES_IDS = [
  { id: 'brent', name: 'Brent Crude', fredId: 'DCOILBRENTEU' },
  { id: 'wti', name: 'WTI Crude', fredId: 'DCOILWTICO' },
] as const;

const HISTORY_DAYS = 100; // ~3 months of calendar days
const MAX_POINTS = 66; // FRED ignores cosd for some multi-series requests — hard cap

const FETCH_HEADERS = {
  'user-agent': 'Mozilla/5.0 (compatible; GlobalTensionDashboard/0.1; +https://github.com)',
  accept: 'text/csv, text/plain, */*',
};

export function fredUrl(now: Date): string {
  const start = new Date(now.getTime() - HISTORY_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const ids = OIL_SERIES_IDS.map((s) => s.fredId).join(',');
  return `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${ids}&cosd=${start}`;
}

/**
 * Parses a FRED multi-series CSV (observation_date,SERIES_A,SERIES_B,...) into
 * per-column price points. Missing observations are "." and are skipped.
 */
export function parseFredCsv(csv: string): Record<string, OilPricePoint[]> {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return {};
  const header = lines[0].split(',').map((h) => h.trim());
  const out: Record<string, OilPricePoint[]> = {};
  for (let col = 1; col < header.length; col++) out[header[col]] = [];

  for (const line of lines.slice(1)) {
    const cols = line.split(',');
    const date = cols[0]?.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    for (let col = 1; col < header.length; col++) {
      const value = Number(cols[col]);
      if (Number.isFinite(value) && value > 0) {
        out[header[col]].push({ date, close: Math.round(value * 100) / 100 });
      }
    }
  }
  return out;
}

export function toOilSeries(
  id: string,
  name: string,
  points: OilPricePoint[],
): OilSeries | null {
  if (points.length < 2) return null;
  const latest = points[points.length - 1].close;
  const prev = points[points.length - 2].close;
  const change = Math.round((latest - prev) * 100) / 100;
  return {
    id,
    name,
    unit: 'USD/bbl',
    latest,
    change,
    changePct: Math.round((change / prev) * 10000) / 100,
    series: points,
  };
}

// ---------- EIA release schedule (public page, no key) ----------

export const EIA_SPOT_PAGE = 'https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm';

function usDateToIso(m: string, d: string, y: string): string {
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** Reads "Release Date: 9/10/2026 Next Release Date: 9/16/2026" from the EIA table page. */
export function parseEiaSchedule(html: string): EiaSchedule | null {
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const last = /(?<!Next )Release Date:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
  const next = /Next Release Date:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
  if (!last || !next) return null;
  return {
    lastRelease: usDateToIso(last[1], last[2], last[3]),
    nextRelease: usDateToIso(next[1], next[2], next[3]),
  };
}

// ---------- Intraday quotes (OilPriceAPI, needs a key) ----------

export const LIVE_PROVIDER = 'OilPriceAPI';
export const OILPRICEAPI_CODES: Record<string, string> = {
  brent: 'BRENT_CRUDE_USD',
  wti: 'WTI_USD',
};

export function oilPriceApiUrl(): string {
  const codes = Object.values(OILPRICEAPI_CODES).join(',');
  return `https://api.oilpriceapi.com/v1/prices/latest?by_code=${codes}`;
}

interface ApiPrice {
  price?: unknown;
  code?: unknown;
  created_at?: unknown;
  as_of?: unknown;
  stale?: unknown;
  synthetic?: unknown;
}

/**
 * Parses /v1/prices/latest. A single code returns `data: {...}`; several codes
 * return `data.prices[]`. Unknown codes and non-numeric prices are dropped.
 */
export function parseOilPriceApi(payload: unknown): LiveQuote[] {
  const p = payload as { status?: unknown; data?: ApiPrice & { prices?: ApiPrice[] } };
  if (p?.status !== 'success' || !p.data) return [];
  const rows = Array.isArray(p.data.prices) ? p.data.prices : [p.data];
  const idByCode = new Map(Object.entries(OILPRICEAPI_CODES).map(([id, code]) => [code, id]));
  const quotes: LiveQuote[] = [];
  for (const row of rows) {
    const id = typeof row.code === 'string' ? idByCode.get(row.code) : undefined;
    const asOf = typeof row.as_of === 'string' ? row.as_of : row.created_at;
    if (!id || typeof row.price !== 'number' || !Number.isFinite(row.price)) continue;
    if (typeof asOf !== 'string' || Number.isNaN(Date.parse(asOf))) continue;
    quotes.push({
      id,
      price: Math.round(row.price * 100) / 100,
      asOf,
      stale: row.stale === true || row.synthetic === true,
    });
  }
  return quotes;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------- Orchestration ----------

export interface OilFetchResult {
  data: MarketsData | null;
  notes: string[];
}

export interface CollectOilOptions {
  /** OilPriceAPI key; intraday quotes are skipped without it. */
  apiKey?: string;
  /** Last run's data, reused for any part that fails this time. */
  previous?: MarketsData | null;
}

/**
 * Daily history from FRED (always), EIA's release schedule (always), and
 * intraday quotes when a key is configured. Each part is best-effort; a part
 * that fails falls back to the previous run's value.
 */
export async function collectOilPrices(
  now: Date,
  { apiKey, previous }: CollectOilOptions = {},
): Promise<OilFetchResult> {
  const notes: string[] = [];

  let oil: OilSeries[] = [];
  try {
    const res = await fetchWithTimeout(fredUrl(now), { headers: FETCH_HEADERS }, 20000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const byFredId = parseFredCsv(await res.text());
    for (const { id, name, fredId } of OIL_SERIES_IDS) {
      const series = toOilSeries(id, name, (byFredId[fredId] ?? []).slice(-MAX_POINTS));
      if (series) oil.push(series);
      else notes.push(`${id}: no usable data in FRED response`);
    }
  } catch (err) {
    notes.push(`FRED fetch failed (${err instanceof Error ? err.message : err})`);
  }
  if (oil.length === 0 && previous?.oil.length) {
    notes.push('keeping previous daily history');
    oil = previous.oil;
  }

  let eia: EiaSchedule | undefined;
  try {
    const res = await fetchWithTimeout(EIA_SPOT_PAGE, { headers: FETCH_HEADERS }, 20000);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    eia = parseEiaSchedule(await res.text()) ?? undefined;
    if (!eia) notes.push('EIA schedule not found on page');
  } catch (err) {
    notes.push(`EIA schedule fetch failed (${err instanceof Error ? err.message : err})`);
  }
  eia ??= previous?.eia;

  let live: LiveQuotes | undefined;
  if (apiKey) {
    try {
      const res = await fetchWithTimeout(
        oilPriceApiUrl(),
        { headers: { Authorization: `Token ${apiKey}`, accept: 'application/json' } },
        15000,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const quotes = parseOilPriceApi(await res.json());
      if (quotes.length === 0) throw new Error('no usable quotes in response');
      live = { provider: LIVE_PROVIDER, fetchedAt: now.toISOString(), quotes };
    } catch (err) {
      notes.push(`${LIVE_PROVIDER} fetch failed (${err instanceof Error ? err.message : err})`);
      live = previous?.live;
    }
  }

  if (oil.length === 0 && !live) return { data: null, notes };
  return {
    data: {
      generatedAt: now.toISOString(),
      source: 'FRED (EIA daily spot prices)',
      oil,
      ...(live ? { live } : {}),
      ...(eia ? { eia } : {}),
    },
    notes,
  };
}
