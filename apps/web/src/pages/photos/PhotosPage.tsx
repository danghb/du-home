import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import { useApiData } from '../../hooks/useApiData';
import { PhotoImage } from '../../components/PhotoImage/PhotoImage';
import styles from './PhotosPage.module.css';

const ROTATION_SECONDS = 12;

function formatDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Hong_Kong', ...options }).format(new Date(value));
}

export function PhotosPage() {
  const load = useCallback(() => api.photos(), []);
  const state = useApiData(load, { cacheKey: 'photos', refreshIntervalMs: 60_000 });
  const [currentIndex, setCurrentIndex] = useState(0);

  const photos = state.status === 'ready' && state.data.data.photos.status === 'ready'
    ? state.data.data.photos.data
    : [];
  useEffect(() => {
    if (photos.length < 2) return;
    const timer = window.setInterval(() => setCurrentIndex((index) => (index + 1) % photos.length), ROTATION_SECONDS * 1_000);
    return () => window.clearInterval(timer);
  }, [photos.length]);
  useEffect(() => setCurrentIndex((index) => photos.length ? index % photos.length : 0), [photos.length]);

  const current = photos[currentIndex] ?? null;
  const memories = useMemo(() => photos.filter((_, index) => index !== currentIndex).slice(0, 6), [photos, currentIndex]);
  const now = new Date();
  const today = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Hong_Kong', month: 'numeric', day: 'numeric', weekday: 'short' }).format(now);

  if (state.status === 'loading') return <div className="page-message">正在读取家庭相册…</div>;
  if (state.status === 'error') return <div className="page-message">{state.message}</div>;

  return <section className={styles.page}>
    <h1>家庭相册</h1><p>把平常的小日子留在这里</p><time>{today}</time>
    <section className={styles.hero}>
      <PhotoImage key={current?.id ?? 'empty'} className={`${styles.heroArt} ${styles.heroArtEnter}`} photo={current} />
      <div className={styles.caption}>
        <small>{current ? formatDate(current.capturedAt, { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', ' · ') : '家庭相册'}</small>
        <strong>{current?.title ?? '还没有可显示的照片'}</strong>
        <span>{photos.length > 1 ? `下一张照片将在 ${ROTATION_SECONDS} 秒后` : '将照片复制到 sample-photos 后重启服务'}</span>
      </div>
    </section>
    <header className={styles.memories}><h2>最近照片</h2><span>{photos.length} 张</span></header>
    <div className={styles.grid}>{memories.map((photo, index) => <article key={photo.id}>
      <PhotoImage photo={photo} variant={index % 3} />
      <b>{formatDate(photo.capturedAt, { month: 'numeric', day: 'numeric' })}</b>
    </article>)}</div>
    <nav className="page-dots"><i/><i/><i/><i className="active"/></nav>
  </section>;
}
