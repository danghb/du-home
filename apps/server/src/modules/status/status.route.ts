import { statusResponseSchema } from '@family-display/contracts';
import { mockStatus } from '@family-display/test-data';
import type { FastifyPluginAsync } from 'fastify';

export const statusRoutes: FastifyPluginAsync = async (app) => {
  app.get('/status', async () => statusResponseSchema.parse(mockStatus));
};
