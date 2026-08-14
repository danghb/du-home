import { dashboardResponseSchema } from '@family-display/contracts';
import { mockDashboard } from '@family-display/test-data';
import type { FastifyPluginAsync } from 'fastify';
import type { AppConfig } from '../../config/config.js';
import type { HomeAssistantHouseholdService } from '../../integrations/home-assistant/home-assistant-household.service.js';

export function createDashboardRoutes(config: AppConfig, householdService: HomeAssistantHouseholdService | null): FastifyPluginAsync {
  return async (app) => {
    app.get('/dashboard', async () => {
      if (config.dataMode === 'mock') return dashboardResponseSchema.parse(mockDashboard);

      const dashboard = structuredClone(mockDashboard);
      dashboard.meta = { generatedAt: new Date().toISOString(), mode: 'live' };
      const household = householdService?.getSnapshot();
      if (household) {
        dashboard.data.todayTodoCount = { status: 'ready', data: household.todayTodos.length, updatedAt: household.updatedAt };
        dashboard.data.memos = { status: 'ready', data: household.memos, updatedAt: household.updatedAt };
        dashboard.data.shopping = { status: 'ready', data: household.shopping, updatedAt: household.updatedAt };
        dashboard.data.householdSummary = { status: 'ready', data: { doorStatus: household.doorStatus, activeDeviceCount: household.activeDeviceCount, alerts: household.alerts }, updatedAt: household.updatedAt };
      } else {
        const reason = householdService ? 'source_unavailable' as const : 'not_configured' as const;
        dashboard.data.todayTodoCount = { status: 'unavailable', data: null, updatedAt: null, reason };
        dashboard.data.memos = { status: 'unavailable', data: null, updatedAt: null, reason };
        dashboard.data.shopping = { status: 'unavailable', data: null, updatedAt: null, reason };
        dashboard.data.householdSummary = { status: 'unavailable', data: null, updatedAt: null, reason };
      }
      return dashboardResponseSchema.parse(dashboard);
    });
  };
}
