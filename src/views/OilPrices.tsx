import type { MarketsData } from '../../shared/types';
import { OilChart } from '../components/OilChart';
import { OilToday } from '../components/OilToday';

export function OilPrices({ markets }: { markets: MarketsData | null }) {
  return (
    <div className="view">
      <p className="view-intro">
        International crude oil benchmarks — a barometer for how geopolitical tension feeds
        into energy markets. Daily history comes from FRED's public data (no API key);
        intraday quotes are optional with an OilPriceAPI key.
      </p>
      {markets ? (
        <>
          <OilToday markets={markets} />
          <OilChart markets={markets} />
        </>
      ) : (
        <p className="empty-message">
          No oil price data collected yet. Run <code>npm run collect</code> to fetch it.
        </p>
      )}
    </div>
  );
}
