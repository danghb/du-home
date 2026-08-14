import { weatherResponseSchema } from '@family-display/contracts';
import { mockWeather } from '@family-display/test-data';
import type { FastifyPluginAsync } from 'fastify';
import type { AppConfig } from '../../config/config.js';
import { HomeAssistantClient } from '../../integrations/home-assistant/home-assistant.client.js';
import { HomeAssistantWeatherService } from '../../integrations/home-assistant/home-assistant-weather.service.js';

export function createWeatherRoutes(config: AppConfig): FastifyPluginAsync {
  const homeAssistant = config.homeAssistant ? new HomeAssistantClient({
    ...config.homeAssistant,
    timezone: config.timezone,
  }) : null;

  return async (app) => {
    const weatherService = homeAssistant && config.homeAssistant
      ? new HomeAssistantWeatherService(
          homeAssistant,
          config.homeAssistant.weatherRefreshMinutes * 60_000,
          (error) => app.log.warn({ error }, 'Home Assistant background weather refresh failed'),
        )
      : null;
    if (config.dataMode === 'live' && weatherService) await weatherService.start();
    app.addHook('onClose', async () => weatherService?.stop());

    app.get('/weather', async () => {
      if (config.dataMode === 'mock') return weatherResponseSchema.parse(mockWeather);
      const generatedAt = new Date().toISOString();
      return weatherResponseSchema.parse({
        data: {
          weather: weatherService
            ? weatherService.getSnapshot()
            : { status: 'unavailable', data: null, updatedAt: null, reason: 'not_configured' },
        },
        meta: { generatedAt, mode: 'live' },
      });
    });
  };
}
