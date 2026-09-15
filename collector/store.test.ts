import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Article } from '../shared/types';
import { articleId, MAX_ARTICLES, mergeArticles, normalizeTitle } from './store';

const NOW = new Date('2026-07-23T12:00:00Z');

function makeArticle(overrides: Partial<Article>): Article {
  const link = overrides.link ?? `https://example.com/${Math.random()}`;
  return {
    id: articleId(link),
    title: 'Some headline',
    link,
    source: 'Test Feed',
    publishedAt: '2026-07-23T10:00:00Z',
    summary: '',
    conflicts: [],
    regions: [],
    countries: [],
    ...overrides,
  };
}

test('articleId is stable and short', () => {
  const a = articleId('https://example.com/story');
  const b = articleId('https://example.com/story');
  assert.equal(a, b);
  assert.equal(a.length, 16);
  assert.notEqual(a, articleId('https://example.com/other'));
});

test('normalizeTitle strips punctuation and case', () => {
  assert.equal(
    normalizeTitle("  Iran's leader: 'We will respond!'  "),
    'iran s leader we will respond',
  );
});

test('dedupes by link id', () => {
  const a = makeArticle({ link: 'https://example.com/1', title: 'A' });
  const dup = makeArticle({ link: 'https://example.com/1', title: 'B' });
  const merged = mergeArticles([a], [dup], NOW);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].title, 'A');
});

test('dedupes same story from different feeds by title', () => {
  const a = makeArticle({ link: 'https://feed-a.com/1', title: 'Ceasefire talks resume in Doha' });
  const b = makeArticle({ link: 'https://feed-b.com/9', title: 'Ceasefire Talks Resume in Doha!' });
  const merged = mergeArticles([], [a, b], NOW);
  assert.equal(merged.length, 1);
});

test('existing article wins over incoming duplicate', () => {
  const existing = makeArticle({ link: 'https://example.com/1', conflicts: ['sudan'] });
  const incoming = makeArticle({ link: 'https://example.com/1', conflicts: [] });
  const merged = mergeArticles([existing], [incoming], NOW);
  assert.deepEqual(merged[0].conflicts, ['sudan']);
});

test('prunes articles older than 7 days and future-dated ones', () => {
  const fresh = makeArticle({ title: 'fresh', publishedAt: '2026-07-22T12:00:00Z' });
  const old = makeArticle({ title: 'old', publishedAt: '2026-07-10T12:00:00Z' });
  const future = makeArticle({ title: 'future', publishedAt: '2026-07-30T12:00:00Z' });
  const invalid = makeArticle({ title: 'invalid', publishedAt: 'not-a-date' });
  const merged = mergeArticles([], [fresh, old, future, invalid], NOW);
  assert.deepEqual(
    merged.map((a) => a.title),
    ['fresh'],
  );
});

test('sorts newest first', () => {
  const older = makeArticle({ title: 'older', publishedAt: '2026-07-21T00:00:00Z' });
  const newer = makeArticle({ title: 'newer', publishedAt: '2026-07-23T00:00:00Z' });
  const merged = mergeArticles([], [older, newer], NOW);
  assert.deepEqual(
    merged.map((a) => a.title),
    ['newer', 'older'],
  );
});

test('caps total article count', () => {
  const many = Array.from({ length: MAX_ARTICLES + 50 }, (_, i) =>
    makeArticle({
      link: `https://example.com/${i}`,
      title: `Story number ${i}`,
      publishedAt: '2026-07-23T01:00:00Z',
    }),
  );
  const merged = mergeArticles([], many, NOW);
  assert.equal(merged.length, MAX_ARTICLES);
});
