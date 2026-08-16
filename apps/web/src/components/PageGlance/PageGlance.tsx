import type { Weather } from '@family-display/contracts';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import { formatLunarDate } from '../../utils/date-display';
import { WeatherScene } from '../WeatherScene/WeatherScene';
import styles from './PageGlance.module.css';

interface PageGlanceProps {
  compact?: boolean;
  weather?: Weather | null;
}

const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
});

export function PageGlance({ compact = false, weather }: PageGlanceProps) {
  const now = useCurrentTime();
  const showWeather = weather !== undefined;
  const todayForecast = weather?.daily?.[0];

  return <header className={`${styles.header} ${compact ? styles.compact : ''}`}>
    <div className={styles.clock}>
      <time>{timeFormatter.format(now)}</time>
      <span><b>{dateFormatter.format(now)}</b><small>· {formatLunarDate(now)}</small></span>
    </div>
    {showWeather && <div className={styles.weather}>
      {weather ? <>
        <div className={styles.weatherCopy}>
          <span>今日天气</span>
          <strong>{weather.temperature}<small>{weather.unit}</small></strong>
          <b>{weather.condition}<i />室外</b>
          {todayForecast && <small className={styles.weatherRange}>最高 {todayForecast.high}°　最低 {todayForecast.low}°</small>}
        </div>
        <div className={styles.weatherVisual}><WeatherScene condition={weather.condition} /></div>
      </> : <span className={styles.unavailable}>天气暂不可用</span>}
    </div>}
  </header>;
}
