import { useEffect, useMemo, useState } from 'react';
import { computeTension } from '../shared/tension';
import type { MarketsData } from '../shared/types';
import { conflicts, loadMarkets, loadNews, timeAgo, type Loaded } from './lib/newsData';
import { ConflictTracker } from './views/ConflictTracker';
import { Headlines } from './views/Headlines';
import { OilPrices } from './views/OilPrices';
import { RegionBrowser } from './views/RegionBrowser';
import { TensionMap } from './views/TensionMap';

type Tab = 'headlines' | 'regions' | 'conflicts' | 'map' | 'oil';
type Theme = 'dark' | 'light';

const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

const TABS: { id: Tab; label: string }[] = [
  { id: 'headlines', label: 'All Headlines' },
  { id: 'regions', label: 'By Region' },
  { id: 'conflicts', label: 'Conflict Tracker' },
  { id: 'map', label: 'Tension Map' },
  { id: 'oil', label: 'Oil Prices' },
];

function initialTheme(): Theme {
  const saved = localStorage.getItem('theme');
  if (saved === 'dark' || saved === 'light') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export default function App() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('headlines');
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  const [markets, setMarkets] = useState<MarketsData | null>(null);

  useEffect(() => {
    const refresh = () => {
      loadNews().then(
        (next) => {
          setLoaded(next);
          setError(null);
        },
        (e: Error) => setError(e.message),
      );
      loadMarkets().then(setMarkets);
    };
    refresh();
    // The deployed site gets new data hourly from the collector workflow; in
    // dev the auto-collect plugin pushes an event the moment a run finishes.
    const timer = setInterval(refresh, REFRESH_INTERVAL_MS);
    import.meta.hot?.on('news:updated', refresh);
    return () => {
      clearInterval(timer);
      import.meta.hot?.off('news:updated', refresh);
    };
  }, []);

  // Re-render periodically so "Updated 5m ago" doesn't freeze.
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  const articles = loaded?.data.articles ?? [];
  // Score against the snapshot's own timestamp, not the wall clock: a static
  // deploy whose data is a few weeks old would otherwise decay every conflict
  // to 0 and leave the map with no hotspots at all.
  const snapshotAt = loaded ? Date.parse(loaded.data.generatedAt) : Date.now();
  const tension = useMemo(
    () => computeTension(articles, conflicts, snapshotAt),
    [articles, snapshotAt],
  );
  const stats = useMemo(() => {
    const sources = new Set(articles.map((a) => a.source));
    const conflictTagged = articles.filter((a) => a.conflicts.length > 0);
    const activeConflicts = new Set(conflictTagged.flatMap((a) => a.conflicts));
    return {
      total: articles.length,
      sources: sources.size,
      conflictTagged: conflictTagged.length,
      activeConflicts: activeConflicts.size,
    };
  }, [articles]);

  const onSearch = (value: string) => {
    setQuery(value);
    if (value.trim() && tab !== 'headlines') setTab('headlines');
  };

  const goHome = () => {
    setTab('headlines');
    setQuery('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const feedsOk = loaded?.meta ? loaded.meta.feeds.filter((f) => f.ok).length : null;

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true" />
            <div>
              <h1 className="brand-title">
                <a
                  href="./"
                  className="brand-home"
                  title="Back to all headlines"
                  onClick={(e) => {
                    e.preventDefault();
                    goHome();
                  }}
                >
                  Global Tension Dashboard
                </a>
              </h1>
              <p className="brand-subtitle">
                {loaded
                  ? `Updated ${timeAgo(loaded.data.generatedAt)}` +
                    (feedsOk !== null ? ` · ${feedsOk}/${loaded.meta!.feeds.length} Feeds OK` : '')
                  : 'Loading…'}
              </p>
            </div>
          </div>
          <div className="header-actions">
            <input
              className="search"
              type="search"
              placeholder="Search articles…"
              value={query}
              onChange={(e) => onSearch(e.target.value)}
              aria-label="Search articles"
            />
            <button
              className="theme-toggle"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle color theme"
              title="Toggle color theme"
            >
              {theme === 'dark' ? 'Light' : 'Dark'}
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        {error && (
          <div className="error-box">
            <strong>Could not load news data.</strong>
            <p>{error}</p>
          </div>
        )}

        {loaded && (
          <>
            <div className="stats">
              <div className="stat">
                <span className="stat-value">{stats.total.toLocaleString()}</span>
                <span className="stat-label">Articles · Last 7 Days</span>
              </div>
              <div className="stat">
                <span className="stat-value">{stats.sources}</span>
                <span className="stat-label">Sources</span>
              </div>
              <div className="stat stat-danger">
                <span className="stat-value">{stats.conflictTagged.toLocaleString()}</span>
                <span className="stat-label">Conflict-Related Articles</span>
              </div>
              <div className="stat stat-danger">
                <span className="stat-value">
                  {stats.activeConflicts}/{conflicts.length}
                </span>
                <span className="stat-label">Tracked Conflicts Active</span>
              </div>
              <button className="stat stat-danger stat-link" onClick={() => setTab('map')}>
                <span className="stat-value">{tension.global}/100</span>
                <span className="stat-label">Global Tension · {tension.level}</span>
              </button>
            </div>

            <nav className="tabs" role="tablist" aria-label="Views">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`main-tab tab-${t.id}${tab === t.id ? ' active' : ''}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            {tab === 'headlines' && <Headlines articles={articles} query={query} />}
            {tab === 'regions' && <RegionBrowser articles={articles} />}
            {tab === 'conflicts' && <ConflictTracker articles={articles} />}
            {tab === 'map' && (
              <TensionMap report={tension} onSelectConflict={() => setTab('conflicts')} />
            )}
            {tab === 'oil' && <OilPrices markets={markets} />}
          </>
        )}

        {!loaded && !error && <p className="loading">Loading news data…</p>}
      </main>

      <footer className="footer">
        <p>
          Aggregated from public RSS feeds (BBC, Al Jazeera, The Guardian, DW, France 24, NPR, and
          more). Headlines link to the original publishers, who own all content.
        </p>
        <p>
          Articles are auto-classified by transparent keyword rules — no AI, no tracking, no API
          keys. Free and open source.
        </p>
      </footer>
    </div>
  );
}
