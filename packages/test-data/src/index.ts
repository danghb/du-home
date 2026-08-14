import type { DashboardResponse, PhotosResponse, StatusResponse, WeatherResponse } from '@family-display/contracts';

const generatedAt = '2026-08-12T09:46:00+08:00';

export const mockDashboard: DashboardResponse = {
  data: {
    todayTodoCount: {
      status: 'ready',
      data: 2,
      updatedAt: generatedAt,
    },
    memos: {
      status: 'ready',
      data: [
        { id: 'memo-1', summary: '周六全家体检', description: '带上身份证和上次的体检报告', due: { kind: 'datetime', value: '2026-08-15T15:00:00+08:00' }, completed: false },
        { id: 'memo-2', summary: '记得拿快递', description: null, due: { kind: 'date', value: '2026-08-12' }, completed: false },
        { id: 'memo-3', summary: '周末换净水器滤芯', description: null, due: { kind: 'date', value: '2026-08-16' }, completed: false },
        { id: 'memo-4', summary: '给爸妈打电话', description: '确认周末几点到家', due: { kind: 'datetime', value: '2026-08-12T20:00:00+08:00' }, completed: false },
        { id: 'memo-5', summary: '洗衣机里的衣服晾一下', description: null, due: null, completed: false },
      ],
      updatedAt: generatedAt,
    },
    shopping: {
      status: 'ready',
      data: ['牛奶', '鸡蛋', '咖啡豆', '洗衣液', '抽纸', '面包', '水果', '猫粮'].map((summary, index) => ({
        id: `shopping-${index + 1}`,
        summary,
        completed: summary === '咖啡豆',
      })),
      updatedAt: generatedAt,
    },
  },
  meta: { generatedAt, mode: 'mock' },
};

export const mockWeather: WeatherResponse = {
  data: {
    weather: {
      status: 'ready',
      data: {
        condition: '多云', temperature: 26, unit: '°C', humidity: 68, windSpeed: 11,
        hourly: [
          { time: '现在', condition: '多云', temperature: 26, precipitation: 10 },
          { time: '11时', condition: '多云', temperature: 27, precipitation: 10 },
          { time: '12时', condition: '晴', temperature: 28, precipitation: 0 },
          { time: '13时', condition: '晴', temperature: 29, precipitation: 0 },
          { time: '14时', condition: '多云', temperature: 29, precipitation: 10 },
          { time: '15时', condition: '阵雨', temperature: 27, precipitation: 40 },
        ],
        daily: [
          { date: '今天', condition: '多云', low: 24, high: 29 },
          { date: '周四', condition: '阵雨', low: 23, high: 28 },
          { date: '周五', condition: '多云', low: 24, high: 30 },
          { date: '周六', condition: '晴', low: 25, high: 31 },
          { date: '周日', condition: '晴', low: 25, high: 32 },
        ],
      },
      updatedAt: generatedAt,
    },
  },
  meta: { generatedAt, mode: 'mock' },
};

export const mockStatus: StatusResponse = {
  data: {
    rooms: {
      status: 'ready',
      data: [
        {
          id: 'living', name: '客厅', temperature: 26.3, humidity: 58, summary: '环境舒适',
          devices: [{ label: '空调', state: '制冷', tone: 'active' }, { label: '地暖', state: '关闭', tone: 'normal' }],
        },
        {
          id: 'master', name: '主卧', temperature: 25.8, humidity: 61, summary: '环境舒适',
          devices: [{ label: '空调', state: '关闭', tone: 'normal' }, { label: '床头灯', state: '开启', tone: 'active' }],
        },
        {
          id: 'study', name: '书房', temperature: null, humidity: null, summary: '设备正常',
          devices: [{ label: '空调', state: '关闭', tone: 'normal' }, { label: '灯', state: '关闭', tone: 'normal' }],
        },
        {
          id: 'guest', name: '次卧', temperature: null, humidity: null, summary: '设备正常',
          devices: [{ label: '空调', state: '关闭', tone: 'normal' }, { label: '地暖', state: '关闭', tone: 'normal' }],
        },
      ],
      updatedAt: generatedAt,
    },
    overview: {
      status: 'ready',
      data: { activeDeviceCount: 2, doorStatus: '已上锁' },
      updatedAt: generatedAt,
    },
  },
  meta: { generatedAt, mode: 'mock' },
};

const mockPhotos = Array.from({ length: 8 }, (_, index) => ({
  id: `photo-${index + 1}`,
  mediaUrl: `/mock/photo-${index + 1}.svg`,
  thumbnailUrl: `/mock/photo-${index + 1}.svg`,
  capturedAt: `2026-08-${String(6 + index).padStart(2, '0')}T17:20:00+08:00`,
  title: `8月${6 + index}日的照片`,
}));

export const mockPhotoResponse: PhotosResponse = {
  data: { photos: { status: 'ready', data: { items: mockPhotos, total: mockPhotos.length }, updatedAt: generatedAt } },
  meta: { generatedAt, mode: 'mock' },
};
