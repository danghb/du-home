import { describe, expect, it } from 'vitest';
import { createApp } from './create-app.js';
import { loadConfig } from '../config/config.js';

describe('API', () => {
  it('returns a valid mock dashboard', async () => {
    const app = await createApp(loadConfig({ APP_DATA_MODE: 'mock' }));
    const response = await app.inject({ method: 'GET', url: '/api/v1/dashboard' });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.todayTodos.status).toBe('ready');
    await app.close();
  });
});
