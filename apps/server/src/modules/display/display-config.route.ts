import { displayConfigResponseSchema } from '@family-display/contracts';
import type { FastifyPluginAsync } from 'fastify';
import type { AppConfig } from '../../config/config.js';

export function createDisplayConfigRoutes(config: AppConfig): FastifyPluginAsync {
  return async (app) => {
    app.get('/config', async () => displayConfigResponseSchema.parse({
      data: config.display,
      meta: { generatedAt: new Date().toISOString(), mode: config.dataMode },
    }));
  };
}
