import { useCallback } from 'react';
import { useApiData } from '../../hooks/useApiData';
import { api } from '../../services/api';
import styles from './WeatherAtmosphere.module.css';

function weatherKind(condition: string) {
  if (/雷|暴/.test(condition)) return 'storm';
  if (/雨|雪|冰/.test(condition)) return 'rain';
  if (/晴/.test(condition) && !/云|阴/.test(condition)) return 'clear';
  return 'cloudy';
}

export function WeatherAtmosphere() {
  const load = useCallback(() => api.weather(), []);
  const state = useApiData(load, { cacheKey: 'weather' });
  const condition = state.status === 'ready' && state.data.data.weather.status === 'ready' ? state.data.data.weather.data.condition : '多云';
  const kind = weatherKind(condition);
  return <div className={`${styles.atmosphere} ${styles[kind]}`} aria-hidden="true">
    <div className={styles.glow} />
    <div className={`${styles.cloud} ${styles.cloudOne}`} />
    <div className={`${styles.cloud} ${styles.cloudTwo}`} />
    <div className={styles.rainLines}>{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
  </div>;
}
