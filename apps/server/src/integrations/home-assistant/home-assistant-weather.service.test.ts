import { describe, expect, it, vi } from 'vitest';
import { HomeAssistantWeatherService } from './home-assistant-weather.service.js';

const liveWeather = {
  data: { condition: '阵雨', temperature: 28.5, unit: '°C' },
  updatedAt: '2026-08-13T02:51:21Z',
  entityId: 'weather.home',
};

describe('HomeAssistantWeatherService', () => {
  it('serves the preloaded in-memory snapshot', async () => {
    const source = { getWeather: vi.fn().mockResolvedValue(liveWeather) };
    const service = new HomeAssistantWeatherService(source, 300_000);
    await service.start();

    expect(service.getSnapshot()).toMatchObject({ status: 'ready', data: { temperature: 28.5 } });
    expect(source.getWeather).toHaveBeenCalledTimes(1);
    service.stop();
  });

  it('keeps the last successful snapshot when a refresh fails', async () => {
    const source = { getWeather: vi.fn().mockResolvedValueOnce(liveWeather).mockRejectedValueOnce(new Error('offline')) };
    const onError = vi.fn();
    const service = new HomeAssistantWeatherService(source, 300_000, onError);
    await service.start();
    await service.refresh();

    expect(service.getSnapshot()).toMatchObject({ status: 'ready', data: { condition: '阵雨' } });
    expect(onError).toHaveBeenCalledOnce();
    service.stop();
  });
});
