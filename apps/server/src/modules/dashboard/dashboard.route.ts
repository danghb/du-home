import { dashboardResponseSchema } from '@family-display/contracts';
import { mockDashboard } from '@family-display/test-data';
import type { FastifyPluginAsync } from 'fastify';
import type { AppConfig } from '../../config/config.js';
import { HomeAssistantClient } from '../../integrations/home-assistant/home-assistant.client.js';
import { HomeAssistantWeatherService } from '../../integrations/home-assistant/home-assistant-weather.service.js';
import type { HomeAssistantHouseholdService } from '../../integrations/home-assistant/home-assistant-household.service.js';
import type { PhotoIndexService } from '../photos/photo-index.service.js';

export function createDashboardRoutes(config: AppConfig, householdService: HomeAssistantHouseholdService | null, photoIndex: PhotoIndexService): FastifyPluginAsync {
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

    app.get('/dashboard', async () => {
      if (config.dataMode === 'mock') return dashboardResponseSchema.parse(mockDashboard);

      const dashboard = structuredClone(mockDashboard);
      dashboard.meta = { generatedAt: new Date().toISOString(), mode: 'live' };
      const recentPhoto = photoIndex.list()[0];
      dashboard.data.recentPhoto = recentPhoto
        ? { status: 'ready', data: recentPhoto, updatedAt: new Date().toISOString() }
        : { status: 'empty', data: null, updatedAt: new Date().toISOString() };
      if (!weatherService) {
        dashboard.data.weather = { status: 'unavailable', data: null, updatedAt: null, reason: 'not_configured' };
      } else {
        dashboard.data.weather = weatherService.getSnapshot();
      }
      const household = householdService?.getSnapshot();
      if (household) {
        dashboard.data.todayTodos = { status: 'ready', data: household.todayTodos, updatedAt: household.updatedAt };
        dashboard.data.memos = { status: 'ready', data: household.memos, updatedAt: household.updatedAt };
        dashboard.data.shopping = { status: 'ready', data: household.shopping, updatedAt: household.updatedAt };
        dashboard.data.householdSummary = { status: 'ready', data: { doorStatus: household.doorStatus, activeDeviceCount: household.activeDeviceCount, alerts: household.alerts }, updatedAt: household.updatedAt };
      } else {
        const reason = householdService ? 'source_unavailable' as const : 'not_configured' as const;
        dashboard.data.todayTodos = { status: 'unavailable', data: null, updatedAt: null, reason };
        dashboard.data.memos = { status: 'unavailable', data: null, updatedAt: null, reason };
        dashboard.data.shopping = { status: 'unavailable', data: null, updatedAt: null, reason };
        dashboard.data.householdSummary = { status: 'unavailable', data: null, updatedAt: null, reason };
      }
      return dashboardResponseSchema.parse(dashboard);
    });
  };
}
