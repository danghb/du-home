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
  });
});
