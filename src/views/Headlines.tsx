import { useMemo } from 'react';
import type { Article } from '../../shared/types';
import { ArticleList } from '../components/ArticleRow';
import { searchArticles } from '../lib/newsData';

export function Headlines({ articles, query }: { articles: Article[]; query: string }) {
  const filtered = useMemo(() => searchArticles(articles, query), [articles, query]);
  return (
    <div className="view">
      {query.trim() && (
        <p className="view-intro">
          {filtered.length} result{filtered.length === 1 ? '' : 's'} for “{query.trim()}”
        </p>
      )}
      <ArticleList
        key={query}
        articles={filtered}
        emptyMessage="No articles match your search."
      />
    </div>
  );
}
