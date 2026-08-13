import { useCallback } from 'react';
import { api } from '../../services/api';
import { useApiData } from '../../hooks/useApiData';
import styles from './StatusPage.module.css';

const scenes = [
  ['全屋关灯', '关闭当前仍开启的灯光'],
  ['回家模式', '打开玄关灯并调整客厅环境'],
  ['睡眠模式', '关闭公共区域设备并保留夜灯'],
];

export function StatusPage() {
  const load = useCallback(() => api.status(), []);
  const state = useApiData(load);
  if (state.status !== 'ready') return <div className="page-message">{state.status === 'loading' ? '正在读取家庭状态…' : state.message}</div>;
  const rooms = state.data.data.rooms.status === 'ready' ? state.data.data.rooms.data : [];
  const temperatures = rooms.map((room) => room.temperature).filter((value): value is number => value !== null);
  const humidities = rooms.map((room) => room.humidity).filter((value): value is number => value !== null);
  const overviewTemperature = temperatures[0] ?? 0;
  const overviewHumidity = humidities[0] ?? 0;
  const enabled = rooms.filter((room) => room.deviceState === '开启').length;
  return (
    <section className={styles.page}>
      <div className={styles.eyebrow}>家庭状态</div><h1>家里现在怎么样</h1><div className={styles.good}>全部正常</div>
      <section className={styles.overview}><h2>全屋概览</h2><div className={styles.metrics}>
        {[["室内温度", `${overviewTemperature.toFixed(1)}°C`],["平均湿度", `${overviewHumidity}%`],["开启设备", `${enabled} 台`],["门窗状态", '1 台']].map(([label,value],i)=><div className={styles.metric} key={label}><span><i className={styles[`dot${i}`]} />{label}</span><strong>{value}</strong></div>)}
      </div></section>
      <div className={styles.roomsHeading}><h2>房间状态</h2><span>最后更新 09:44</span></div>
      <div className={styles.roomGrid}>{rooms.map((room,index)=><article className={styles.room} key={room.id}><h3><i className={index%2 ? styles.green : styles.orange}/>{room.name}</h3><div className={styles.roomData}><div><span>{room.deviceName}</span><strong>{room.deviceState}</strong></div><div><span>温度</span><strong>{room.temperature?.toFixed(1)}°C</strong><span>湿度</span><strong>{room.humidity}%</strong></div></div><b>{room.summary}</b></article>)}</div>
      <section className={styles.scenes}><h2>快捷场景</h2>{scenes.map((scene,index)=><div className={styles.scene} key={scene[0]}><i className={styles[`scene${index}`]}/><strong>{scene[0]}</strong><span>{scene[1]}</span><b>›</b></div>)}</section>
      <nav className="page-dots"><i/><i/><i className="active"/><i/></nav>
    </section>
  );
}
