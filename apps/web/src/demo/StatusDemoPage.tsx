import type { StatusResponse, Weather } from '@family-display/contracts';
import { StatusPageContent } from '../pages/status/StatusPage';

const updatedAt = '2026-08-16T13:08:00+08:00';

const demoWeather: Weather = {
  condition: '多云',
  temperature: 30,
  unit: '°C',
  humidity: 70,
  hourly: [],
  daily: [{ date: '今天', condition: '多云', low: 26, high: 33 }],
};

const demoStatus: StatusResponse = {
  data: {
    rooms: {
      status: 'ready',
      updatedAt,
      data: [
        {
          id: 'living', name: '客厅', temperature: 27.5, humidity: 70, summary: '环境舒适',
          devices: [
            { label: '空调', state: '制冷', tone: 'active' },
            { label: '地暖', state: '关闭', tone: 'normal' },
            { label: '灯光', state: '全部关闭', tone: 'normal' },
          ],
        },
        {
          id: 'master', name: '主卧', temperature: 28.7, humidity: 75.4, summary: '环境舒适',
          devices: [
            { label: '空调', state: '关闭', tone: 'normal' },
            { label: '地暖', state: '关闭', tone: 'normal' },
            { label: '布帘', state: '打开', tone: 'normal' },
            { label: '纱帘', state: '打开', tone: 'normal' },
            { label: '床头灯', state: '关闭', tone: 'normal' },
          ],
        },
        {
          id: 'kitchen', name: '厨房', temperature: 30, humidity: 70, summary: '请留意环境',
          devices: [
            { label: '冰箱', state: '正常', tone: 'success' },
            { label: '电饭煲', state: '待机中', tone: 'normal' },
          ],
        },
        {
          id: 'study', name: '书房', temperature: null, humidity: null, summary: '设备状态',
          devices: [
            { label: '空调', state: '关闭', tone: 'normal' },
            { label: '地暖', state: '关闭', tone: 'normal' },
            { label: '灯光', state: '离线', tone: 'warning' },
          ],
        },
        {
          id: 'guest', name: '次卧', temperature: null, humidity: null, summary: '设备状态',
          devices: [
            { label: '空调', state: '关闭', tone: 'normal' },
            { label: '地暖', state: '关闭', tone: 'normal' },
          ],
        },
        {
          id: 'balcony', name: '阳台', temperature: null, humidity: null, summary: '设备状态',
          devices: [
            { label: '晾衣架', state: '离线', tone: 'warning' },
            { label: '阳台灯', state: '离线', tone: 'warning' },
            { label: '夜灯', state: '离线', tone: 'warning' },
            { label: '洗衣机', state: '关闭', tone: 'normal' },
            { label: '干衣机', state: '关闭', tone: 'normal' },
          ],
        },
      ],
    },
    overview: { status: 'ready', data: { doorStatus: '已上锁' }, updatedAt },
  },
  meta: { generatedAt: updatedAt, mode: 'mock' },
};

export function StatusDemoPage() {
  return <StatusPageContent response={demoStatus} weather={demoWeather}/>;
}
