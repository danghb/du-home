import { statusResponseSchema } from '@family-display/contracts';
import { mockStatus } from '@family-display/test-data';
import type { FastifyPluginAsync } from 'fastify';
import type { AppConfig } from '../../config/config.js';
import type { HomeAssistantHouseholdService } from '../../integrations/home-assistant/home-assistant-household.service.js';

export function createStatusRoutes(config: AppConfig, householdService: HomeAssistantHouseholdService | null): FastifyPluginAsync {
  return async (app) => {
    app.get('/status', async () => {
      if (config.dataMode === 'mock') return statusResponseSchema.parse(mockStatus);
      const household = householdService?.getSnapshot();
      const generatedAt = new Date().toISOString();
      if (!household) {
        const reason = householdService ? 'source_unavailable' as const : 'not_configured' as const;
        return statusResponseSchema.parse({ data: {
          rooms: { status: 'unavailable', data: null, updatedAt: null, reason },
          overview: { status: 'unavailable', data: null, updatedAt: null, reason },
        }, meta: { generatedAt, mode: 'live' } });
      }
      return statusResponseSchema.parse({ data: {
        rooms: { status: 'ready', data: household.rooms, updatedAt: household.updatedAt },
        overview: { status: 'ready', data: { doorStatus: household.doorStatus }, updatedAt: household.updatedAt },
      }, meta: { generatedAt, mode: 'live' } });
    });
  };
}
