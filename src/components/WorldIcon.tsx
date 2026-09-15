/**
 * Stylized world map (equirectangular-ish, 64x40 viewBox) with one path per
 * region. All continents render in a muted grey; the highlighted one gets its
 * region color.
 */
const REGION_PATHS: Record<string, string> = {
  americas:
    'M9 4 C13 2.5 18 3.5 19.5 6 C21 8.5 17.5 9.5 16.5 11.5 C15.5 13.5 13.5 14.5 11.5 13.5 C9.5 12.5 6.5 13.5 5.5 11 C4.5 8.5 5.5 5.5 9 4 Z ' +
    'M15 16 C17.5 15 20.5 16.5 21 19.5 C21.5 23 20 27 18 31.5 C17 33.5 15.5 33 15 30.5 C14.5 26 14 22 14.5 18.5 C14.7 17.3 14.2 16.3 15 16 Z',
  europe:
    'M30.5 5 C33 3.5 36.5 3.8 38.5 5 C40 6 39.5 8 37.8 9.2 C36 10.4 33.5 11.5 31.5 10.8 C29.5 10 29 6.5 30.5 5 Z',
  africa:
    'M30 12.5 C33 11.2 36.5 11.5 38 13.5 C39.3 15.3 38.6 17.5 38 20 C37.3 22.8 35.5 25.5 33.8 27.5 C32.4 29 30.8 28.4 30 26.2 C29 23.5 28.3 19.5 28.5 16 C28.6 14.4 29.1 13 30 12.5 Z',
  'middle-east':
    'M40 11.5 C42 10.8 44 11.3 44.7 13 C45.5 15 44.8 17 43.3 18.3 C41.9 19.5 40.3 19 39.7 17.2 C39 15.2 39 12.5 40 11.5 Z',
  asia:
    'M42 3.5 C47 1.8 54 2.2 58 4.5 C61 6.2 61.3 8.8 59 10.5 C56.7 12.2 53.5 12.5 51 14 C48.9 15.3 48.1 17.6 46.8 19.2 C45.6 20.7 43.9 20.3 43.3 18.4 C42.5 16 41.8 13.5 41.4 11 C41 8.5 40.8 5.3 42 3.5 Z',
  oceania:
    'M53 24.5 C55.8 23.3 58.8 23.8 60 26 C61.2 28.2 60 30.6 57.4 31.6 C54.8 32.6 52.4 31.8 51.8 29.6 C51.3 27.6 51.8 25.5 53 24.5 Z ' +
    'M61.2 32.5 C62 32.2 62.7 32.8 62.5 33.7 C62.3 34.6 61.5 35.2 60.8 34.8 C60.1 34.4 60.3 33 61.2 32.5 Z',
};

export function WorldIcon({
  highlight,
  color,
  width = 56,
}: {
  highlight?: string;
  color?: string;
  width?: number;
}) {
  return (
    <svg
      viewBox="1 1 63 35"
      width={width}
      height={(width * 35) / 63}
      aria-hidden="true"
      className="world-icon"
    >
      {Object.entries(REGION_PATHS).map(([id, d]) => (
        <path key={id} d={d} fill={id === highlight && color ? color : 'var(--map-dim)'} />
      ))}
    </svg>
  );
}
