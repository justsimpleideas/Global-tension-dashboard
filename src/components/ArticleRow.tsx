import { useState } from 'react';
import type { Article } from '../../shared/types';
import { conflictById, countryByCode, timeAgo } from '../lib/newsData';

export function ArticleRow({ article, showTags = true }: { article: Article; showTags?: boolean }) {
  return (
    <article className="article-row">
      <div className="article-main">
        <a className="article-title" href={article.link} target="_blank" rel="noopener noreferrer">
          {article.title}
        </a>
        {article.summary && <p className="article-summary">{article.summary}</p>}
        <div className="article-meta">
          <span className="article-source">{article.source}</span>
          <span className="article-time">{timeAgo(article.publishedAt)}</span>
          {showTags && (
            <span className="article-tags">
              {article.conflicts.map((id) => (
                <span key={id} className="tag tag-conflict">
                  {conflictById.get(id)?.name ?? id}
                </span>
              ))}
              {article.countries.slice(0, 3).map((code) => (
                <span key={code} className="tag tag-country">
                  <span className={`fi fi-${code.toLowerCase()}`} aria-hidden="true" />
                  {countryByCode.get(code)?.name ?? code}
                </span>
              ))}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function ArticleList({
  articles,
  pageSize = 50,
  showTags = true,
  emptyMessage = 'No articles found.',
}: {
  articles: Article[];
  pageSize?: number;
  showTags?: boolean;
  emptyMessage?: string;
}) {
  const [visible, setVisible] = useState(pageSize);
  if (articles.length === 0) {
    return <p className="empty-message">{emptyMessage}</p>;
  }
  return (
    <div className="article-list">
      {articles.slice(0, visible).map((a) => (
        <ArticleRow key={a.id} article={a} showTags={showTags} />
      ))}
      {visible < articles.length && (
        <button className="load-more" onClick={() => setVisible((v) => v + pageSize)}>
          Load more ({articles.length - visible} remaining)
        </button>
      )}
    </div>
  );
}
