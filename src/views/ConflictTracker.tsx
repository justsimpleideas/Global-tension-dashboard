import { useMemo, useState } from 'react';
import type { Article } from '../../shared/types';
import { ArticleRow } from '../components/ArticleRow';
import { conflicts } from '../lib/newsData';

const PREVIEW_COUNT = 5;
const EXPANDED_COUNT = 25;

function ConflictCard({ conflictId, articles }: { conflictId: string; articles: Article[] }) {
  const [expanded, setExpanded] = useState(false);
  const conflict = conflicts.find((c) => c.id === conflictId);
  if (!conflict) return null;
  const shown = articles.slice(0, expanded ? EXPANDED_COUNT : PREVIEW_COUNT);

  return (
    <section className="conflict-card">
      <header className="conflict-header">
        <div>
          <h3 className="conflict-name">{conflict.name}</h3>
          <p className="conflict-parties">{conflict.parties}</p>
        </div>
        <span className="conflict-count">{articles.length}</span>
      </header>
      <p className="conflict-description">{conflict.description}</p>
      {articles.length === 0 ? (
        <p className="empty-message">No recent articles collected for this conflict.</p>
      ) : (
        <div className="conflict-articles">
          {shown.map((a) => (
            <ArticleRow key={a.id} article={a} showTags={false} />
          ))}
        </div>
      )}
      {articles.length > PREVIEW_COUNT && (
        <button className="conflict-toggle" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less' : `Show more (${Math.min(articles.length, EXPANDED_COUNT)} of ${articles.length})`}
        </button>
      )}
    </section>
  );
}

export function ConflictTracker({ articles }: { articles: Article[] }) {
  const byConflict = useMemo(() => {
    const map = new Map<string, Article[]>();
    for (const c of conflicts) map.set(c.id, []);
    for (const a of articles) {
      for (const id of a.conflicts) map.get(id)?.push(a);
    }
    return map;
  }, [articles]);

  // Busiest conflicts first; empty ones sink to the bottom.
  const ordered = [...byConflict.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="view">
      <p className="view-intro">
        Ongoing armed conflicts and geopolitical crises, tracked automatically. Articles are
        classified by keyword rules — see <code>shared/config/conflicts.json</code> to adjust or add
        conflicts.
      </p>
      <div className="conflict-grid">
        {ordered.map(([id, items]) => (
          <ConflictCard key={id} conflictId={id} articles={items} />
        ))}
      </div>
    </div>
  );
}
