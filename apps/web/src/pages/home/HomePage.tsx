import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useApiData } from '../../hooks/useApiData';
import { PhotoImage } from '../../components/PhotoImage/PhotoImage';
import { WeatherScene } from '../../components/WeatherScene/WeatherScene';
import styles from './HomePage.module.css';

export function HomePage() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const load = useCallback(() => api.dashboard(), []);
  const state = useApiData(load, { cacheKey: 'dashboard', refreshIntervalMs: 30_000 });
  if (state.status === 'loading') return <div className="page-message">正在读取家庭信息…</div>;
  if (state.status === 'error') return <div className="page-message">{state.message}</div>;
  const dashboard = state.data.data;
  const weather = dashboard.weather.status === 'ready' ? dashboard.weather.data : null;
  const todayTodos = dashboard.todayTodos.status === 'ready' ? dashboard.todayTodos.data : [];
  const memos = dashboard.memos.status === 'ready' ? dashboard.memos.data.slice(0, 5) : [];
  const shopping = dashboard.shopping.status === 'ready' ? dashboard.shopping.data.slice(0, 8) : [];
  const household = dashboard.householdSummary?.status === 'ready' ? dashboard.householdSummary.data : null;
  const recentPhoto = dashboard.recentPhoto.status === 'ready' ? dashboard.recentPhoto.data : null;
  const allListsEmpty = memos.length === 0 && shopping.length === 0;
  const todayIds = new Set(todayTodos.map((todo) => todo.id));
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
              </div>
              <div className={styles.weatherVisual}><WeatherScene condition={weather.condition} /></div>
            </>
          ) : <div className={styles.weatherUnavailable}>天气暂不可用</div>}
        </div>
        <div className={styles.summary}>今天有 {todayTodos.length} 项家庭事项</div>
      </header>

      <section className={`${styles.card} ${styles.memos} ${allListsEmpty ? styles.compactMemos : ''}`}>
        <div className={styles.cardTitle}>家庭备忘</div><span className={styles.count}>{memos.length} 条</span>
        {memos.length === 0 && <div className={styles.emptyState}>暂无家庭备忘</div>}
        <div className={styles.memoList}>{memos.map((memo, index) => (
          <div className={`${styles.memoRow} ${todayIds.has(memo.id) ? styles.memoToday : ''}`} key={memo.id}><i /><strong>{memo.summary}</strong><span>{todayIds.has(memo.id) ? '今日事项' : memo.due ? '已安排' : '备忘'}</span></div>
        ))}</div>
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
        <div className={styles.cardTitle}>家庭照片</div><span className={styles.photoMore}>最近照片&nbsp; →</span>
        <PhotoImage className={styles.photoArt} photo={recentPhoto} />
        <strong className={styles.photoCaption}>{recentPhoto ? recentPhoto.title : '等待加入家庭照片'}</strong>
      </section>
      <nav className="page-dots" aria-label="页面位置"><i className="active" /><i /><i /><i /></nav>
    </section>
  );
}
