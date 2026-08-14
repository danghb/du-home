import { describe, expect, it } from 'vitest';
import { createApp } from './create-app.js';
import { loadConfig } from '../config/config.js';

describe('API', () => {
  it('returns a valid mock dashboard', async () => {
    const app = await createApp(loadConfig({ APP_DATA_MODE: 'mock' }));
    const response = await app.inject({ method: 'GET', url: '/api/v1/dashboard' });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.todayTodoCount).toMatchObject({ status: 'ready', data: 2 });
    await app.close();
  });

  it('returns weather independently from home dashboard data', async () => {
    const app = await createApp(loadConfig({ APP_DATA_MODE: 'mock' }));
    const response = await app.inject({ method: 'GET', url: '/api/v1/weather' });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.weather.data).toMatchObject({ condition: '多云', temperature: 26 });
    expect(response.json().data.weather.data.hourly).toHaveLength(6);
    expect(response.json().data.weather.data.daily).toHaveLength(5);
    await app.close();
  });

  it('returns a bounded photo batch with the full library total', async () => {
    const app = await createApp(loadConfig({ APP_DATA_MODE: 'mock' }));
    const response = await app.inject({ method: 'GET', url: '/api/v1/photos?limit=64' });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.photos.data.items).toHaveLength(8);
    expect(response.json().data.photos.data.total).toBe(8);
    await app.close();
  });
});
