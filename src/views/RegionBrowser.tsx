import { useMemo, useState } from 'react';
import type { Article } from '../../shared/types';
import { ArticleList } from '../components/ArticleRow';
import { WorldIcon } from '../components/WorldIcon';
import { countBy, regions } from '../lib/newsData';

export function RegionBrowser({ articles }: { articles: Article[] }) {
  const [activeRegion, setActiveRegion] = useState(regions[0].id);
  const [activeCountry, setActiveCountry] = useState<string | null>(null);

  const regionCounts = useMemo(() => countBy(articles, (a) => a.regions), [articles]);
  const regionArticles = useMemo(
    () => articles.filter((a) => a.regions.includes(activeRegion)),
    [articles, activeRegion],
  );
  const countryCounts = useMemo(
    () => countBy(regionArticles, (a) => a.countries),
    [regionArticles],
  );

  const region = regions.find((r) => r.id === activeRegion);
  const countryChips = (region?.countries ?? [])
    .map((c) => ({ ...c, count: countryCounts.get(c.code) ?? 0 }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  const shownArticles = activeCountry
    ? regionArticles.filter((a) => a.countries.includes(activeCountry))
    : regionArticles;

  const selectRegion = (id: string) => {
    setActiveRegion(id);
    setActiveCountry(null);
  };

  return (
    <div className="view">
      <div className="region-tabs" role="tablist" aria-label="Continents">
        {regions.map((r) => {
          const active = r.id === activeRegion;
          return (
            <button
              key={r.id}
              role="tab"
              aria-selected={active}
              className={`region-btn${active ? ' active' : ''}`}
              style={active ? { borderColor: r.color, background: `${r.color}1c` } : undefined}
              onClick={() => selectRegion(r.id)}
            >
              <WorldIcon highlight={r.id} color={active ? r.color : `${r.color}99`} />
              <span className="region-btn-text">
                <span className="region-name">{r.name}</span>
                <span className="region-count">{regionCounts.get(r.id) ?? 0} Articles</span>
              </span>
            </button>
          );
        })}
      </div>

      {countryChips.length > 0 && (
        <div className="country-chips">
          <button
            className={`chip${activeCountry === null ? ' active' : ''}`}
            style={activeCountry === null && region ? { borderColor: region.color, background: `${region.color}1c`, color: 'var(--text)' } : undefined}
            onClick={() => setActiveCountry(null)}
          >
            <WorldIcon width={20} />
            All <span className="chip-count">({regionArticles.length})</span>
          </button>
          {countryChips.map((c) => {
            const active = activeCountry === c.code;
            return (
              <button
                key={c.code}
                className={`chip${active ? ' active' : ''}`}
                style={active && region ? { borderColor: region.color, background: `${region.color}1c`, color: 'var(--text)' } : undefined}
                onClick={() => setActiveCountry(active ? null : c.code)}
              >
                <span className={`fi fi-${c.code.toLowerCase()}`} aria-hidden="true" />
                {c.name} <span className="chip-count">({c.count})</span>
              </button>
            );
          })}
        </div>
      )}

      <ArticleList
        key={`${activeRegion}:${activeCountry ?? 'all'}`}
        articles={shownArticles}
        emptyMessage="No articles for this region yet."
      />
    </div>
  );
}
