import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('loadConfig', () => {
  it('treats an empty weather entity as automatic discovery', () => {
    const config = loadConfig({
      APP_DATA_MODE: 'live',
      HA_BASE_URL: 'https://hass.example.test/',
      HA_TOKEN: 'secret',
      HA_WEATHER_ENTITY: '',
    });
    expect(config.homeAssistant?.weatherEntityId).toBeNull();
    expect(config.homeAssistant?.weatherRefreshMinutes).toBe(5);
    expect(config.homeAssistant?.dataRefreshSeconds).toBe(30);
    expect(config.display.pageRotation).toEqual({
      enabled: true,
      durationsSeconds: { home: 30, weather: 30, status: 30, photos: 45 },
    });
    expect(config.display.homePhotoRotationSeconds).toBe(20);
  });

  it('parses per-page rotation durations and supports disabling rotation', () => {
    const config = loadConfig({
      PAGE_ROTATION_ENABLED: 'false',
      PAGE_ROTATION_SCHEDULE: 'home:12, weather:25, invalid:0, broken',
      HOME_PHOTO_ROTATION_SECONDS: '8',
    });
    expect(config.display).toEqual({
      pageRotation: { enabled: false, durationsSeconds: { home: 12, weather: 25 } },
      homePhotoRotationSeconds: 8,
    });
  });
});
