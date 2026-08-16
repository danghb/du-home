import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useApiData } from '../../hooks/useApiData';
import { PhotoImage } from '../../components/PhotoImage/PhotoImage';
import { PageGlance } from '../../components/PageGlance/PageGlance';
import { pickRandomPhotoIndex, restoreHomePhotoIndex } from './home-photo-selection';
import { selectDisplayedMemos } from './memo-display';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import styles from './HomePage.module.css';

export function HomePage() {
  const now = useCurrentTime();
  const load = useCallback(() => api.dashboard(), []);
  const loadWeather = useCallback(() => api.weather(), []);
  const loadPhotos = useCallback(() => api.photos(), []);
  const loadConfig = useCallback(() => api.config(), []);
  const state = useApiData(load, { cacheKey: 'dashboard' });
  const weatherState = useApiData(loadWeather, { cacheKey: 'weather' });
  const photoState = useApiData(loadPhotos, { cacheKey: 'photos' });
  const configState = useApiData(loadConfig, { cacheKey: 'display-config' });
  const photos = photoState.status === 'ready' && photoState.data.data.photos.status === 'ready'
    ? photoState.data.data.photos.data.items
    : [];
  const photoBatchKey = photos.map((photo) => photo.id).join('|');
  const [photoIndex, setPhotoIndex] = useState(() => restoreHomePhotoIndex(photos));
  const photoRotationSeconds = configState.status === 'ready' ? configState.data.data.homePhotoRotationSeconds : 20;
  useEffect(() => {
    if (!photos.length) return setPhotoIndex(-1);
    setPhotoIndex(restoreHomePhotoIndex(photos));
  }, [photoBatchKey]);
  useEffect(() => {
    if (photos.length < 2) return;
    const timer = window.setInterval(
      () => setPhotoIndex((current) => pickRandomPhotoIndex(photos, current)),
      photoRotationSeconds * 1_000,
    );
    return () => window.clearInterval(timer);
  }, [photoBatchKey, photoRotationSeconds]);
  const weather = weatherState.status === 'ready' && weatherState.data.data.weather.status === 'ready'
    ? weatherState.data.data.weather.data
    : null;
  if (state.status !== 'ready') return <section className={styles.page}>
    <PageGlance weather={weather} />
    <div className="page-message">{state.status === 'loading' ? '正在读取家庭信息…' : state.message}</div>
    <nav className="page-dots" aria-label="页面位置"><i className="active"/><i/><i/><i/></nav>
  </section>;
  const dashboard = state.data.data;
  const todayTodoCount = dashboard.todayTodoCount.status === 'ready' ? dashboard.todayTodoCount.data : 0;
  const memoItems = dashboard.memos.status === 'ready' ? dashboard.memos.data : [];
  const memos = selectDisplayedMemos(memoItems, now);
  const shopping = dashboard.shopping.status === 'ready' ? dashboard.shopping.data.slice(0, 8) : [];
  const household = dashboard.householdSummary?.status === 'ready' ? dashboard.householdSummary.data : null;
  const recentPhoto = photos[photoIndex] ?? null;
  const allListsEmpty = memos.totalCount === 0 && shopping.length === 0;
  const overviewAlerts = household ? [...household.alerts].sort((a, b) => Number(b.severity === 'warning') - Number(a.severity === 'warning')).slice(0, 2) : [];

  return (
    <section className={styles.page}>
      <PageGlance weather={weather} />
      <div className={styles.summary}>今天有 {todayTodoCount} 项家庭事项</div>

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
