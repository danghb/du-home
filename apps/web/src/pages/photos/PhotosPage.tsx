import { useCallback, useEffect, useRef, useState } from 'react';
import type { PhotosResponse } from '@family-display/contracts';
import { api } from '../../services/api';
import { readApiData, refreshApiData, useApiData } from '../../hooks/useApiData';
import { PhotoImage } from '../../components/PhotoImage/PhotoImage';
import { PageGlance } from '../../components/PageGlance/PageGlance';
import { movePhotoIndex, nextPhotoIndexInBatch, rememberGalleryPhoto, restoreGalleryPhotoIndex } from './photo-navigation';
import styles from './PhotosPage.module.css';

const ROTATION_SECONDS = 12;

function formatDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Hong_Kong', ...options }).format(new Date(value));
}

export function PhotosPage() {
  const load = useCallback(() => api.photos(), []);
  const loadWeather = useCallback(() => api.weather(), []);
  const state = useApiData(load, { cacheKey: 'photos' });
  const weatherState = useApiData(loadWeather, { cacheKey: 'weather' });
  const [rotationRevision, setRotationRevision] = useState(0);
  const batchRequestInFlight = useRef(false);

  const photos = state.status === 'ready' && state.data.data.photos.status === 'ready'
    ? state.data.data.photos.data.items
    : [];
  const photoBatchKey = photos.map((photo) => photo.id).join('|');
  const [currentIndex, setCurrentIndex] = useState(() => restoreGalleryPhotoIndex(photos));
  useEffect(() => {
    if (photos.length < 2) return;
    const timer = window.setTimeout(() => {
      const nextIndex = nextPhotoIndexInBatch(currentIndex, photos.length);
      if (nextIndex !== null) {
        rememberGalleryPhoto(photos, nextIndex);
        setCurrentIndex(nextIndex);
        return;
      }
      if (batchRequestInFlight.current) return;
      batchRequestInFlight.current = true;
      void refreshApiData(api.photos, { cacheKey: 'photos', force: true })
        .then(() => {
          const refreshed = readApiData<PhotosResponse>('photos');
          const nextPhotos = refreshed?.data.photos.status === 'ready'
            ? refreshed.data.photos.data.items
            : [];
          if (nextPhotos.length) {
            rememberGalleryPhoto(nextPhotos, 0);
            setCurrentIndex(0);
          }
          setRotationRevision((revision) => revision + 1);
        })
        .finally(() => { batchRequestInFlight.current = false; });
    }, ROTATION_SECONDS * 1_000);
    return () => window.clearTimeout(timer);
  }, [currentIndex, photoBatchKey, rotationRevision]);
  useEffect(() => setCurrentIndex(restoreGalleryPhotoIndex(photos)), [photoBatchKey]);
  useEffect(() => {
    if (photos.length < 2) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
      event.preventDefault();
      const offset = event.key === 'ArrowUp' ? -1 : 1;
      setCurrentIndex((index) => {
        const nextIndex = movePhotoIndex(index, offset, photos.length);
        rememberGalleryPhoto(photos, nextIndex);
        return nextIndex;
      });
      setRotationRevision((revision) => revision + 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [photoBatchKey]);

  const current = photos[currentIndex] ?? null;
  const weather = weatherState.status === 'ready' && weatherState.data.data.weather.status === 'ready'
    ? weatherState.data.data.weather.data
    : null;

  if (state.status !== 'ready') return <section className={styles.page}>
    <PageGlance weather={weather} />
    <div className="page-message">{state.status === 'loading' ? '正在读取家庭相册…' : state.message}</div>
    <nav className="page-dots"><i/><i/><i/><i className="active"/></nav>
  </section>;

  return <section className={styles.page}>
    <PageGlance weather={weather} />
    <h1>家庭相册</h1><p>把平常的小日子留在这里</p>
    <section className={styles.hero}>
      <PhotoImage className={styles.heroArt} photo={current} source="display" />
      <div className={styles.caption}>
        <small>{current ? formatDate(current.capturedAt, { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', ' · ') : '家庭相册'}</small>
        <strong>{current?.title ?? '还没有可显示的照片'}</strong>
      </div>
    </section>
    <nav className="page-dots"><i/><i/><i/><i className="active"/></nav>
  </section>;
}
