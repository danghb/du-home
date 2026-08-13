import { dashboardResponseSchema } from '@family-display/contracts';
import { mockDashboard } from '@family-display/test-data';
import type { FastifyPluginAsync } from 'fastify';

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get('/dashboard', async () => dashboardResponseSchema.parse(mockDashboard));
};
