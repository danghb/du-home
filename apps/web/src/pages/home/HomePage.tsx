import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useApiData } from '../../hooks/useApiData';
import { PhotoImage } from '../../components/PhotoImage/PhotoImage';
import { WeatherScene } from '../../components/WeatherScene/WeatherScene';
import { pickRandomPhotoIndex } from './home-photo-selection';
import { selectDisplayedMemos } from './memo-display';
import styles from './HomePage.module.css';

export function HomePage() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const load = useCallback(() => api.dashboard(), []);
  const loadPhotos = useCallback(() => api.photos(), []);
  const loadConfig = useCallback(() => api.config(), []);
  const state = useApiData(load, { cacheKey: 'dashboard', refreshIntervalMs: 30_000 });
  const photoState = useApiData(loadPhotos, { cacheKey: 'photos', refreshIntervalMs: 5 * 60_000 });
  const configState = useApiData(loadConfig, { cacheKey: 'display-config' });
  const photos = photoState.status === 'ready' && photoState.data.data.photos.status === 'ready'
    ? photoState.data.data.photos.data.items
    : [];
  const [photoIndex, setPhotoIndex] = useState(() => pickRandomPhotoIndex(photos));
  const photoRotationSeconds = configState.status === 'ready' ? configState.data.data.homePhotoRotationSeconds : 20;
  useEffect(() => {
    if (!photos.length) return setPhotoIndex(-1);
    setPhotoIndex((current) => current >= 0 && current < photos.length
      ? current
      : pickRandomPhotoIndex(photos));
  }, [photos.length]);
  useEffect(() => {
    if (photos.length < 2) return;
    const timer = window.setInterval(
      () => setPhotoIndex((current) => pickRandomPhotoIndex(photos, current)),
      photoRotationSeconds * 1_000,
    );
    return () => window.clearInterval(timer);
  }, [photoRotationSeconds, photos.length]);
  if (state.status === 'loading') return <div className="page-message">正在读取家庭信息…</div>;
  if (state.status === 'error') return <div className="page-message">{state.message}</div>;
  const dashboard = state.data.data;
  const weather = dashboard.weather.status === 'ready' ? dashboard.weather.data : null;
  const todayForecast = weather?.daily?.[0];
  const todayTodos = dashboard.todayTodos.status === 'ready' ? dashboard.todayTodos.data : [];
  const memoItems = dashboard.memos.status === 'ready' ? dashboard.memos.data : [];
  const memos = selectDisplayedMemos(memoItems, now);
  const shopping = dashboard.shopping.status === 'ready' ? dashboard.shopping.data.slice(0, 8) : [];
  const household = dashboard.householdSummary?.status === 'ready' ? dashboard.householdSummary.data : null;
  const recentPhoto = photos[photoIndex] ?? (dashboard.recentPhoto.status === 'ready' ? dashboard.recentPhoto.data : null);
  const allListsEmpty = memos.totalCount === 0 && shopping.length === 0;
  const overviewAlerts = household ? [...household.alerts].sort((a, b) => Number(b.severity === 'warning') - Number(a.severity === 'warning')).slice(0, 2) : [];
  const timeText = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Hong_Kong', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  const dateParts = Object.fromEntries(new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Hong_Kong', month: 'numeric', day: 'numeric', weekday: 'short' }).formatToParts(now).map((part) => [part.type, part.value]));
  const dateText = `${dateParts.month}月${dateParts.day}日 ${dateParts.weekday}`;

  return (
    <section className={styles.page}>
      <header>
        <time className={styles.time}>{timeText}</time>
        <div className={styles.date}>{dateText}</div>
        <div className={styles.weatherPanel}>
          {weather ? (
            <>
              <div className={styles.weatherCopy}>
                <span>今日天气</span>
                <strong>{weather.temperature}<small>{weather.unit}</small></strong>
                <b>{weather.condition}<i />室外</b>
                <small className={styles.weatherRange}>最高 {todayForecast?.high ?? '—'}°　最低 {todayForecast?.low ?? '—'}°</small>
              </div>
              <div className={styles.weatherVisual}><WeatherScene condition={weather.condition} /></div>
            </>
          ) : <div className={styles.weatherUnavailable}>天气暂不可用</div>}
        </div>
        <div className={styles.summary}>今天有 {todayTodos.length} 项家庭事项</div>
      </header>

      <section className={`${styles.card} ${styles.memos} ${allListsEmpty ? styles.compactMemos : ''}`}>
        <div className={styles.cardTitle}>家庭备忘</div><span className={styles.count}>{memos.totalCount} 条</span>
        {memos.totalCount === 0 && <div className={styles.emptyState}>暂无家庭备忘</div>}
        <div className={styles.memoList}>{memos.visible.map((memo) => (
          <div className={`${styles.memoRow} ${memo.item.description ? styles.memoRowWithDescription : ''} ${memo.tone === 'today' ? styles.memoToday : memo.tone === 'overdue' ? styles.memoOverdue : memo.tone === 'soon' ? styles.memoSoon : ''}`} key={memo.item.id}>
            <i />
            <div className={styles.memoCopy}>
              <strong>{memo.item.summary}</strong>
              {memo.item.description && <small>{memo.item.description}</small>}
            </div>
            <span>{memo.label}</span>
          </div>
        ))}</div>
        {memos.hiddenCount > 0 && <div className={styles.memoMore}>还有 {memos.hiddenCount} 条</div>}
      </section>

      <section className={`${styles.card} ${styles.shopping} ${allListsEmpty ? styles.compactShopping : ''}`}>
        <div className={styles.cardTitle}>购物清单</div><span className={styles.count}>{shopping.length} 项</span>
        {shopping.length === 0 && <div className={styles.emptyState}>购物清单是空的</div>}
        <div className={styles.shoppingGrid}>{shopping.map((item) => (
          <div className={styles.shoppingItem} key={item.id}>
            <i className={item.completed ? styles.checked : ''}>{item.completed ? '✓' : ''}</i>
            <span>{item.summary}</span>
          </div>
        ))}</div>
      </section>

      {allListsEmpty && household && <section className={`${styles.card} ${styles.familyOverview}`}>
        <div className={styles.cardTitle}>家庭概览</div>
        <div className={styles.overviewMetrics}>
          <div><span>门锁状态</span><strong>{household.doorStatus}</strong></div>
          <div><span>开启设备</span><strong>{household.activeDeviceCount} 台</strong></div>
        </div>
        <div className={styles.overviewAlerts}>{overviewAlerts.map((alert) => (
          <div key={alert.id}><i className={alert.severity === 'warning' ? styles.alertWarning : ''} /><span>{alert.title}</span><strong>{alert.detail}</strong></div>
        ))}</div>
      </section>}

      <section className={`${styles.card} ${styles.photo} ${allListsEmpty && household ? styles.compactPhoto : ''}`}>
        <div className={styles.cardTitle}>家庭照片</div><span className={styles.photoMore}>随机回忆&nbsp; →</span>
        <PhotoImage className={styles.photoArt} photo={recentPhoto} source="display" />
        <strong className={styles.photoCaption}>{recentPhoto ? recentPhoto.title : '等待加入家庭照片'}</strong>
      </section>
      <nav className="page-dots" aria-label="页面位置"><i className="active" /><i /><i /><i /></nav>
    </section>
  );
}
