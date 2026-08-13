import { useCallback } from 'react';
import { Blinds, Droplets, Flame, House, Lamp, Lightbulb, LockKeyhole, Power, Snowflake, Thermometer } from 'lucide-react';
import { api } from '../../services/api';
import { useApiData } from '../../hooks/useApiData';
import styles from './StatusPage.module.css';

function DeviceIcon({ label }: { label: string }) {
  if (label.includes('空调')) return <Snowflake />;
  if (label.includes('地暖')) return <Flame />;
  if (label.includes('帘')) return <Blinds />;
  if (label.includes('床头')) return <Lamp />;
  if (label.includes('灯')) return <Lightbulb />;
  return <Power />;
}

export function StatusPage() {
  const load = useCallback(() => api.status(), []);
  const state = useApiData(load, { refreshIntervalMs: 30_000 });
  if (state.status !== 'ready') return <div className="page-message">{state.status === 'loading' ? '正在读取家庭状态…' : state.message}</div>;
  const rooms = state.data.data.rooms.status === 'ready' ? state.data.data.rooms.data : [];
  const temperatures = rooms.map((room) => room.temperature).filter((value): value is number => value !== null);
  const humidities = rooms.map((room) => room.humidity).filter((value): value is number => value !== null);
  const overviewTemperature = temperatures.length ? temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length : 0;
  const overviewHumidity = humidities.length ? humidities.reduce((sum, value) => sum + value, 0) / humidities.length : 0;
  const enabled = rooms.filter((room) => room.deviceState === '开启').length;
  const overview = state.data.data.overview?.status === 'ready' ? state.data.data.overview.data : null;
  const activeDeviceCount = overview?.activeDeviceCount ?? enabled;
  const doorStatus = overview?.doorStatus ?? '未知';
  const updatedAt = state.data.data.rooms.updatedAt;
  const updatedTime = updatedAt ? new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(updatedAt)) : '--:--';
  const environmentRooms = rooms.filter((room) => room.temperature !== null || room.humidity !== null);
  const deviceRooms = rooms.filter((room) => room.temperature === null && room.humidity === null);
  const metrics = [
    { label: '室内温度', value: `${overviewTemperature.toFixed(1)}°C`, icon: Thermometer },
    { label: '平均湿度', value: `${overviewHumidity.toFixed(1)}%`, icon: Droplets },
    { label: '开启设备', value: `${activeDeviceCount} 台`, icon: Power },
    { label: '门锁状态', value: doorStatus, icon: LockKeyhole },
  ];
  return (
    <section className={styles.page}>
      <div className={styles.eyebrow}>家庭状态</div><h1>家里现在怎么样</h1>
      <section className={styles.overview}><h2>全屋概览</h2><div className={styles.metrics}>
        {metrics.map(({ label, value, icon: Icon })=><div className={styles.metric} key={label}><span><Icon />{label}</span><strong>{value}</strong></div>)}
      </div></section>
      <div className={styles.roomsHeading}><h2>房间状态</h2><span>更新于 {updatedTime}</span></div>
      <div className={styles.primaryRooms}>{environmentRooms.map((room,index)=><article className={`${styles.primaryRoom} ${room.id === 'master' ? styles.masterRoom : ''}`} key={room.id}>
        <div className={styles.roomTitle}><h3><House className={index ? styles.green : styles.orange}/>{room.name}</h3><b>{room.summary}</b></div>
        <div className={styles.environmentData}>
          {room.temperature !== null && <div><span><Thermometer />温度</span><strong>{room.temperature.toFixed(1)}°C</strong></div>}
          {room.humidity !== null && <div><span><Droplets />湿度</span><strong>{room.humidity}%</strong></div>}
        </div>
        <div className={styles.primaryDevices}>{room.devices?.map((device)=><div key={device.label}><span><DeviceIcon label={device.label}/>{device.label}</span><strong className={device.tone === 'active' ? styles.toneActive : device.tone === 'warning' ? styles.toneWarning : ''}>{device.state}</strong></div>)}</div>
      </article>)}</div>
      <div className={styles.secondaryGrid}>{deviceRooms.map((room,index)=><article key={room.id}>
        <h3><House className={index ? styles.green : styles.orange}/>{room.name}</h3>
        {room.devices?.length ? <div className={styles.secondaryDevices}>{room.devices.map((device)=><div key={device.label}><span><DeviceIcon label={device.label}/>{device.label}</span><strong className={device.tone === 'active' ? styles.toneActive : device.tone === 'warning' ? styles.toneWarning : ''}>{device.state}</strong></div>)}</div> : <div className={styles.noDevices}>暂无可显示设备</div>}
      </article>)}</div>
      <nav className="page-dots"><i/><i/><i className="active"/><i/></nav>
    </section>
  );
}
