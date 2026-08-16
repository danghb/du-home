import type { RoomStatus, StatusResponse } from '@family-display/contracts';
import { useCallback } from 'react';
import {
  Blinds,
  CookingPot,
  Droplets,
  Flame,
  House,
  Lamp,
  Lightbulb,
  LockKeyhole,
  Power,
  Refrigerator,
  Shirt,
  Snowflake,
  Thermometer,
  WashingMachine,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../../services/api';
import { useApiData } from '../../hooks/useApiData';
import styles from './StatusPage.module.css';

function DeviceIcon({ label }: { label: string }) {
  if (label.includes('空调')) return <Snowflake />;
  if (label.includes('地暖')) return <Flame />;
  if (label.includes('帘') || label.includes('晾衣')) return <Blinds />;
  if (label.includes('床头')) return <Lamp />;
  if (label.includes('洗衣机')) return <WashingMachine />;
  if (label.includes('干衣机')) return <Shirt />;
  if (label.includes('冰箱')) return <Refrigerator />;
  if (label.includes('电饭煲')) return <CookingPot />;
  if (label.includes('灯')) return <Lightbulb />;
  return <Power />;
}

type Device = NonNullable<RoomStatus['devices']>[number];

function DeviceState({ device }: { device: Device }) {
  const toneClass = device.tone === 'active'
    ? styles.toneActive
    : device.tone === 'success'
      ? styles.toneSuccess
      : device.tone === 'warning'
        ? styles.toneWarning
        : '';
  return <div>
    <span><DeviceIcon label={device.label}/>{device.label}</span>
    <span className={styles.deviceValue}>
      <strong className={toneClass}>{device.state}</strong>
      {device.detail && <small>{device.detail}</small>}
    </span>
  </div>;
}

export function StatusPageContent({ response }: { response: StatusResponse }) {
  const rooms = response.data.rooms.status === 'ready' ? response.data.rooms.data : [];
  const temperatures = rooms.map((room) => room.temperature).filter((value): value is number => value !== null);
  const humidities = rooms.map((room) => room.humidity).filter((value): value is number => value !== null);
  const overviewTemperature = temperatures.length ? temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length : null;
  const overviewHumidity = humidities.length ? humidities.reduce((sum, value) => sum + value, 0) / humidities.length : null;
  const overview = response.data.overview?.status === 'ready' ? response.data.overview.data : null;
  const updatedAt = response.data.rooms.updatedAt;
  const updatedTime = updatedAt ? new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(updatedAt)) : null;
  const environmentRooms = rooms.filter((room) => room.temperature !== null || room.humidity !== null);
  const deviceRooms = rooms.filter((room) => room.temperature === null && room.humidity === null && room.devices?.length);
  const metrics: Array<{ label: string; value: string; icon: LucideIcon }> = [];
  if (overviewTemperature !== null) metrics.push({ label: '室内温度', value: `${overviewTemperature.toFixed(1)}°C`, icon: Thermometer });
  if (overviewHumidity !== null) metrics.push({ label: '平均湿度', value: `${overviewHumidity.toFixed(1)}%`, icon: Droplets });
  if (overview?.doorStatus && overview.doorStatus !== '未知') metrics.push({ label: '门锁状态', value: overview.doorStatus, icon: LockKeyhole });

  return <section className={styles.page}>
    <div className={styles.eyebrow}>家庭状态</div><h1>家里现在怎么样</h1>
    {metrics.length > 0 && <section className={styles.overview}><h2>全屋概览</h2><div className={styles.metrics} style={{ gridTemplateColumns: `repeat(${metrics.length}, 1fr)` }}>
      {metrics.map(({ label, value, icon: Icon }) => <div className={styles.metric} key={label}><span><Icon />{label}</span><strong>{value}</strong></div>)}
    </div></section>}
    <div className={styles.roomsHeading}><h2>房间状态</h2>{updatedTime && <span>更新于 {updatedTime}</span>}</div>
    <div className={styles.primaryRooms}>{environmentRooms.map((room, index) => <article className={`${styles.primaryRoom} ${room.id === 'master' ? styles.masterRoom : ''} ${room.id === 'kitchen' ? styles.kitchenRoom : ''}`} key={room.id}>
      <div className={styles.roomTitle}><h3><House className={index ? styles.green : styles.orange}/>{room.name}</h3><b>{room.summary}</b></div>
      <div className={styles.environmentData}>
        {room.temperature !== null && <div><span><Thermometer />温度</span><strong>{room.temperature.toFixed(1)}°C</strong></div>}
        {room.humidity !== null && <div><span><Droplets />湿度</span><strong>{room.humidity}%</strong></div>}
      </div>
      {room.devices?.length ? <div className={styles.primaryDevices}>{room.devices.map((device) => <DeviceState key={device.label} device={device}/>)}</div> : null}
    </article>)}</div>
    <div className={styles.secondaryGrid}>{deviceRooms.map((room, index) => <article className={room.id === 'balcony' ? styles.balconyRoom : ''} key={room.id}>
      <h3><House className={index ? styles.green : styles.orange}/>{room.name}</h3>
      <div className={styles.secondaryDevices}>{room.devices?.map((device) => <DeviceState key={device.label} device={device}/>)}</div>
    </article>)}</div>
    <nav className="page-dots"><i/><i/><i className="active"/><i/></nav>
  </section>;
}

export function StatusPage() {
  const load = useCallback(() => api.status(), []);
  const state = useApiData(load, { cacheKey: 'status' });
  if (state.status !== 'ready') return <div className="page-message">{state.status === 'loading' ? '正在读取家庭状态…' : state.message}</div>;
  return <StatusPageContent response={state.data}/>;
}
