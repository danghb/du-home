import { useCallback } from 'react';
import { WeatherScene } from '../../components/WeatherScene/WeatherScene';
import { useApiData } from '../../hooks/useApiData';
import { api } from '../../services/api';
import styles from './WeatherPage.module.css';

const fallbackHourly = [
  ['现在', '多云', 26], ['11时', '多云', 27], ['12时', '晴', 28],
  ['13时', '晴', 29], ['14时', '多云', 29], ['15时', '阵雨', 27],
] as const;

const fallbackDaily = [
  ['今天', '多云', 24, 29], ['周四', '阵雨', 23, 28], ['周五', '多云', 24, 30],
  ['周六', '晴', 25, 31], ['周日', '晴', 25, 32],
] as const;

function conditionSymbol(condition: string) {
  if (/雷/.test(condition)) return 'ϟ';
  if (/雨/.test(condition)) return '●';
  if (/雪/.test(condition)) return '✳';
  if (/晴/.test(condition)) return '☀';
  return '☁';
}

export function WeatherPage() {
  const load = useCallback(() => api.dashboard(), []);
  const state = useApiData(load);
  if (state.status === 'loading') return <div className="page-message">正在读取天气…</div>;
  if (state.status === 'error') return <div className="page-message">{state.message}</div>;

  const section = state.data.data.weather;
  if (section.status !== 'ready') return <div className="page-message">天气暂不可用</div>;
  const weather = section.data;
  const hourly = weather.hourly ?? fallbackHourly.map(([time, condition, temperature]) => ({ time, condition, temperature, precipitation: 0 }));
  const daily = weather.daily ?? fallbackDaily.map(([date, condition, low, high]) => ({ date, condition, low, high }));
  const min = Math.min(...daily.map((day) => day.low));
  const max = Math.max(...daily.map((day) => day.high));

  return (
    <section className={styles.page}>
      <div className={styles.skyGlow} />
      <header className={styles.header}>
        <span>家庭天气</span>
        <time>更新于 09:46</time>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span>家里附近</span>
          <strong>{weather.temperature}<small>{weather.unit}</small></strong>
          <b>{weather.condition}</b>
          <p>最高 {daily[0]?.high ?? weather.temperature + 3}°　最低 {daily[0]?.low ?? weather.temperature - 2}°</p>
        </div>
        <WeatherScene condition={weather.condition} large />
      </section>

      <section className={`${styles.glassCard} ${styles.hourly}`}>
        <p>未来几小时天气较为稳定，午后可能出现短时阵雨。</p>
        <div className={styles.hourList}>{hourly.slice(0, 6).map((hour) => (
          <div className={styles.hour} key={hour.time}>
            <time>{hour.time}</time>
            <i className={/雨/.test(hour.condition) ? styles.wet : ''}>{conditionSymbol(hour.condition)}</i>
            <strong>{hour.temperature}°</strong>
            <small>{hour.precipitation ? `${hour.precipitation}%` : '　'}</small>
          </div>
        ))}</div>
      </section>

      <section className={`${styles.glassCard} ${styles.forecast}`}>
        <h2>5 日天气</h2>
        {daily.slice(0, 5).map((day) => {
          const left = ((day.low - min) / Math.max(1, max - min)) * 34;
          const width = Math.max(28, ((day.high - day.low) / Math.max(1, max - min)) * 100);
          return <div className={styles.day} key={day.date}>
            <strong>{day.date}</strong>
            <i>{conditionSymbol(day.condition)}</i>
            <span>{day.low}°</span>
            <div className={styles.range}><b style={{ left: `${left}%`, width: `${width}%` }} /></div>
            <span>{day.high}°</span>
          </div>;
        })}
      </section>

      <section className={styles.metrics}>
        <article className={styles.glassCard}><span>体感温度</span><strong>{weather.feelsLike ?? weather.temperature + 1}°</strong><p>与实际温度接近</p></article>
        <article className={styles.glassCard}><span>湿度</span><strong>{weather.humidity ?? 68}%</strong><p>体感较为舒适</p></article>
        <article className={styles.glassCard}><span>风速</span><strong>{weather.windSpeed ?? 11}<small> km/h</small></strong><p>轻柔的东南风</p></article>
        <article className={styles.glassCard}><span>日落</span><strong>18:52</strong><p>距离日落 7 小时</p></article>
      </section>
      <nav className="page-dots" aria-label="页面位置"><i/><i className="active"/><i/><i/></nav>
    </section>
  );
}
