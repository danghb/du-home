import { useCallback } from 'react';
import { api } from '../../services/api';
import { useApiData } from '../../hooks/useApiData';
import { PhotoArtwork } from '../../components/PhotoArtwork/PhotoArtwork';
import styles from './PhotosPage.module.css';

const labels = ['周一','周二','周三','周四','周五','周末'];

export function PhotosPage(){
  const load=useCallback(()=>api.photos(),[]);const state=useApiData(load);
  if(state.status!=='ready')return <div className="page-message">{state.status==='loading'?'正在读取家庭相册…':state.message}</div>;
  const photos=state.data.data.photos.status==='ready'?state.data.data.photos.data:[];
  return <section className={styles.page}><h1>家庭相册</h1><p>把平常的小日子留在这里</p><time>8月12日 · 周三</time>
    <section className={styles.hero}><PhotoArtwork className={styles.heroArt}/><div className={styles.caption}><small>2026 · 08 · 06</small><strong>{photos[0]?.title??'8月6日的照片'}</strong><span>下一张照片将在 12 秒后</span></div></section>
    <header className={styles.memories}><h2>本周回忆</h2><span>查看全部&nbsp; →</span></header><div className={styles.grid}>{labels.map((label,index)=><article key={label}><PhotoArtwork variant={index%3}/><b>{label}</b></article>)}</div>
    <nav className="page-dots"><i/><i/><i/><i className="active"/></nav>
  </section>;
}
