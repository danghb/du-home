import type { DashboardResponse, PhotosResponse, StatusResponse } from '@family-display/contracts';

const generatedAt = '2026-08-12T09:46:00+08:00';

export const mockDashboard: DashboardResponse = {
  data: {
    weather: {
      status: 'ready',
      data: {
        condition: '多云', temperature: 26, unit: '°C', feelsLike: 27, humidity: 68, windSpeed: 11,
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
    todayTodos: {
      status: 'ready',
      data: [
        { id: 'todo-1', summary: '记得拿快递', description: null, due: { kind: 'date', value: '2026-08-12' }, completed: false },
        { id: 'todo-2', summary: '给爸妈打电话', description: '聊聊周末聚餐的安排', due: { kind: 'datetime', value: '2026-08-12T20:00:00+08:00' }, completed: false },
      ],
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
    recentPhoto: {
      status: 'ready',
      data: { id: 'photo-1', mediaUrl: '/mock/photo-1.svg', thumbnailUrl: '/mock/photo-1.svg', capturedAt: '2026-08-06T17:20:00+08:00', title: '8月6日的照片' },
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
        { id: 'living', name: '客厅', temperature: 26.3, humidity: 58, deviceName: '空调', deviceState: '开启', summary: '环境舒适' },
        { id: 'master', name: '主卧', temperature: 25.8, humidity: 61, deviceName: '灯光', deviceState: '关闭', summary: '环境舒适' },
        { id: 'study', name: '书房', temperature: 26.6, humidity: 55, deviceName: '灯光', deviceState: '开启', summary: '环境舒适' },
        { id: 'guest', name: '次卧', temperature: 25.6, humidity: 60, deviceName: '空调', deviceState: '关闭', summary: '环境舒适' },
      ],
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
