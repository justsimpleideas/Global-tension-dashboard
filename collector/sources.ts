import { readFileSync } from 'node:fs';

const romanizations = JSON.parse(
  readFileSync(new URL('../shared/config/source-names.json', import.meta.url), 'utf8'),
) as Record<string, string>;

// Latin scripts plus common punctuation/symbols; anything else counts as non-Latin.
// Ranges: ASCII, Latin-1 Supplement + Latin Extended-A/B (U+00A0-U+024F),
// Latin Extended Additional (U+1E00-U+1EFF), General Punctuation (U+2000-U+206F),
// and the euro sign.
const NON_LATIN = new RegExp(
  '[^\\x20-\\x7E\\u00A0-\\u024F\\u1E00-\\u1EFF\\u2000-\\u206F\\u20AC]',
);

/**
 * Normalizes source names for an English-language dashboard:
 * - Known outlets get their English name (see shared/config/source-names.json).
 * - Photo-credit junk like "© Manu Fernandez, AP" collapses to the agency name.
 * - Anything still in a non-Latin script falls back to a generic label.
 */
export function normalizeSource(name: string): string {
  const trimmed = name.trim();
  const mapped = romanizations[trimmed];
  if (mapped) return mapped;
  if (trimmed.startsWith('©')) {
    const parts = trimmed.replace(/^©\s*/, '').split(',');
    const last = parts[parts.length - 1].trim();
    return NON_LATIN.test(last) || !last ? 'Agency photo' : last;
  }
  if (NON_LATIN.test(trimmed)) return 'International Press';
  return trimmed;
}

/**
 * Strips a trailing " - Source" segment naming the article's own outlet, under
 * either its English name or the original name it maps from — Google News
 * titles say "... - Anadolu Ajansı" while the source shows "Anadolu Agency".
 */
export function stripSourceSuffix(title: string, source: string): string {
  const names = [source, ...Object.keys(romanizations).filter((k) => romanizations[k] === source)];
  for (const name of names) {
    const suffix = ` - ${name}`;
    if (title.endsWith(suffix) && title.length > suffix.length) {
      return title.slice(0, -suffix.length).trim();
    }
  }
  return title;
}

/**
 * Strips a trailing "· - Source" segment when that segment is in a non-Latin
 * script (Google News appends localized outlet names to titles).
 */
export function stripNonLatinTitleSuffix(title: string): string {
  for (const sep of [' - ', ' – ', ' — ', ' | ']) {
    const idx = title.lastIndexOf(sep);
    if (idx > 0) {
      const suffix = title.slice(idx + sep.length);
      if (suffix && NON_LATIN.test(suffix)) {
        return title.slice(0, idx).trim();
      }
    }
  }
  return title;
}
