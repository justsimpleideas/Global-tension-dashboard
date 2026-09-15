import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeSource, stripNonLatinTitleSuffix, stripSourceSuffix } from './sources';

test('strips the outlet suffix under its English or original name', () => {
  assert.equal(
    stripSourceSuffix('2 Gazans killed in latest ceasefire violations - Anadolu Ajansı', 'Anadolu Agency'),
    '2 Gazans killed in latest ceasefire violations',
  );
  assert.equal(stripSourceSuffix('Talks resume - Reuters', 'Reuters'), 'Talks resume');
  assert.equal(stripSourceSuffix('Talks resume - Reuters', 'BBC News'), 'Talks resume - Reuters');
});

test('known outlets map to their English names', () => {
  assert.equal(normalizeSource('共同通信'), 'Kyodo News');
  assert.equal(normalizeSource('سانا'), 'SANA');
  assert.equal(normalizeSource('Anadolu Ajansı'), 'Anadolu Agency');
});

test('photo credits collapse to the agency name', () => {
  assert.equal(normalizeSource('© Manu Fernandez, AP'), 'AP');
  assert.equal(normalizeSource('© France 24'), 'France 24');
});

test('unknown non-Latin names get a generic label', () => {
  assert.equal(normalizeSource('未知的新闻来源'), 'International Press');
});

test('ordinary Latin names pass through, including diacritics', () => {
  assert.equal(normalizeSource('The Guardian'), 'The Guardian');
  assert.equal(normalizeSource('Hürriyet Daily News'), 'Hürriyet Daily News');
  assert.equal(normalizeSource('Türkiye Today'), 'Türkiye Today');
});

test('strips trailing non-Latin source suffixes from titles', () => {
  assert.equal(
    stripNonLatinTitleSuffix('Rainy Season Ends This Week - 朝日新聞'),
    'Rainy Season Ends This Week',
  );
  assert.equal(
    stripNonLatinTitleSuffix('Ceasefire holds - BBC News'),
    'Ceasefire holds - BBC News',
  );
  assert.equal(
    stripNonLatinTitleSuffix('Self-driving cars reach Cairo'),
    'Self-driving cars reach Cairo',
  );
});
