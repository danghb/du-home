import { useCallback } from 'react';
import { api } from '../../services/api';
import { useApiData } from '../../hooks/useApiData';
import { PhotoArtwork } from '../../components/PhotoArtwork/PhotoArtwork';
import { WeatherScene } from '../../components/WeatherScene/WeatherScene';
import styles from './HomePage.module.css';

const memoTimes = ['下午 3:00', '今天', '周日', '今晚', '现在'];

export function HomePage() {
  const load = useCallback(() => api.dashboard(), []);
  const state = useApiData(load);
  if (state.status === 'loading') return <div className="page-message">正在读取家庭信息…</div>;
  if (state.status === 'error') return <div className="page-message">{state.message}</div>;
  const dashboard = state.data.data;
  const weather = dashboard.weather.status === 'ready' ? dashboard.weather.data : null;
  const todos = dashboard.todayTodos.status === 'ready' ? dashboard.todayTodos.data.slice(0, 2) : [];
  const memos = dashboard.memos.status === 'ready' ? dashboard.memos.data.slice(0, 5) : [];
  const shopping = dashboard.shopping.status === 'ready' ? dashboard.shopping.data.slice(0, 8) : [];

  return (
    <section className={styles.page}>
      <header>
        <time className={styles.time}>09:46</time>
        <div className={styles.date}>8月12日 周三</div>
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
        <div className={styles.summary}>今天有 {todos.length} 项待办</div>
      </header>

      <section className={`${styles.card} ${styles.todos}`}>
        <div className={styles.cardTitle}>今日待办</div><span className={styles.todoCount}>{todos.length} 项</span>
        {todos.map((todo, index) => (
          <div className={styles.todoRow} key={todo.id}>
            <i className={index === 0 ? styles.red : styles.orange} />
            <strong>{todo.summary}</strong>
            <span>{index === 0 ? '今天' : '今晚'} · 待完成</span>
          </div>
        ))}
      </section>

      <section className={`${styles.card} ${styles.memos}`}>
        <div className={styles.cardTitle}>家庭备忘</div><span className={styles.count}>{memos.length} 条</span>
        <div className={styles.memoList}>{memos.map((memo, index) => (
          <div className={styles.memoRow} key={memo.id}><i /><strong>{memo.summary}</strong><span>{memoTimes[index]}</span></div>
        ))}</div>
      </section>

      <section className={`${styles.card} ${styles.shopping}`}>
        <div className={styles.cardTitle}>购物清单</div><span className={styles.count}>{shopping.length} 项</span>
        <div className={styles.shoppingGrid}>{shopping.map((item) => (
          <div className={styles.shoppingItem} key={item.id}>
            <i className={item.completed ? styles.checked : ''}>{item.completed ? '✓' : ''}</i>
            <span>{item.summary}</span>
          </div>
        ))}</div>
      </section>

      <section className={`${styles.card} ${styles.photo}`}>
        <div className={styles.cardTitle}>家庭照片</div><span className={styles.photoMore}>最近照片&nbsp; →</span>
        <PhotoArtwork className={styles.photoArt} />
        <strong className={styles.photoCaption}>最近照片 · 8月6日</strong>
      </section>
      <nav className="page-dots" aria-label="页面位置"><i className="active" /><i /><i /><i /></nav>
    </section>
  );
}
