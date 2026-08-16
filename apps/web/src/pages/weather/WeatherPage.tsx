import { useCallback } from 'react';
import { WeatherScene } from '../../components/WeatherScene/WeatherScene';
import { PageGlance } from '../../components/PageGlance/PageGlance';
import { useApiData } from '../../hooks/useApiData';
import { api } from '../../services/api';
import styles from './WeatherPage.module.css';

function conditionSymbol(condition: string) {
  if (/雷/.test(condition)) return 'ϟ';
  if (/雨/.test(condition)) return '●';
  if (/雪/.test(condition)) return '✳';
  if (/晴/.test(condition)) return '☀';
  return '☁';
}

export function WeatherPage() {
  const load = useCallback(() => api.weather(), []);
  const state = useApiData(load, { cacheKey: 'weather' });
  if (state.status !== 'ready') return <section className={styles.page}>
    <div className={styles.skyGlow} />
    <PageGlance compact />
    <div className="page-message">{state.status === 'loading' ? '正在读取天气…' : state.message}</div>
    <nav className="page-dots" aria-label="页面位置"><i/><i className="active"/><i/><i/></nav>
  </section>;

  const section = state.data.data.weather;
  if (section.status !== 'ready') return <section className={styles.page}>
    <div className={styles.skyGlow} />
    <PageGlance compact />
    <div className="page-message">天气暂不可用</div>
    <nav className="page-dots" aria-label="页面位置"><i/><i className="active"/><i/><i/></nav>
  </section>;
  const weather = section.data;
  const hourly = weather.hourly ?? [];
  const daily = weather.daily ?? [];
  const min = daily.length ? Math.min(...daily.map((day) => day.low)) : 0;
  const max = daily.length ? Math.max(...daily.map((day) => day.high)) : 1;
  const hourlySummary = hourly.some((hour) => /雨|雷/.test(hour.condition)) ? '未来几小时有降雨，出门记得带伞。' : '未来几小时天气较为稳定。';

  return (
    <section className={styles.page}>
      <div className={styles.skyGlow} />
      <PageGlance compact />

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
        <p>{hourlySummary}</p>
        <div className={styles.hourList}>{hourly.slice(0, 6).map((hour) => (
          <div className={styles.hour} key={hour.time}>
            <time>{hour.time}</time>
            <WeatherScene condition={hour.condition} compact />
            <strong>{hour.temperature}°</strong>
            <small>{hour.precipitationProbability !== undefined ? `${hour.precipitationProbability}%` : hour.precipitation ? `${hour.precipitation}${hour.precipitationUnit ?? 'mm'}` : '　'}</small>
          </div>
        ))}{hourly.length === 0 && <div className={styles.noForecast}>HA 暂无逐小时预报</div>}</div>
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
        })}{daily.length === 0 && <div className={styles.noDaily}>HA 暂无每日预报</div>}
      </section>

      <section className={styles.metrics}>
        {weather.humidity !== undefined && <article className={styles.glassCard}><span>湿度</span><strong>{weather.humidity}%</strong></article>}
        {weather.windSpeed !== undefined && <article className={styles.glassCard}><span>风速</span><strong>{weather.windSpeed}<small> {weather.windUnit ?? 'km/h'}</small></strong></article>}
        {weather.pressure !== undefined && <article className={styles.glassCard}><span>气压</span><strong>{weather.pressure}<small> {weather.pressureUnit ?? 'hPa'}</small></strong></article>}
        {weather.uvIndex !== undefined && <article className={styles.glassCard}><span>紫外线指数</span><strong>{weather.uvIndex}</strong></article>}
      </section>
      <nav className="page-dots" aria-label="页面位置"><i/><i className="active"/><i/><i/></nav>
    </section>
  );
}
