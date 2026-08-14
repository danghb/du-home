import fs from 'node:fs';
import path from 'node:path';
import fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import type { AppConfig } from '../config/config.js';
import { createDashboardRoutes } from '../modules/dashboard/dashboard.route.js';
import { healthRoutes } from '../modules/health/health.route.js';
import { createMediaRoutes, createPhotosRoutes } from '../modules/photos/photos.route.js';
import { PhotoIndexService } from '../modules/photos/photo-index.service.js';
import { createStatusRoutes } from '../modules/status/status.route.js';
import { createDisplayConfigRoutes } from '../modules/display/display-config.route.js';
import { createWeatherRoutes } from '../modules/weather/weather.route.js';
import { HomeAssistantClient } from '../integrations/home-assistant/home-assistant.client.js';
import { HomeAssistantHouseholdService } from '../integrations/home-assistant/home-assistant-household.service.js';

export async function createApp(config: AppConfig) {
  const app = fastify({ logger: true });
  const photoIndex = new PhotoIndexService(
    config.photoRoot,
    config.photoCacheRoot,
    config.photoScanIntervalMinutes,
    (error, filePath) => app.log.warn({ error, filePath }, 'Photo indexing failed'),
  );
  const householdClient = config.homeAssistant ? new HomeAssistantClient({ ...config.homeAssistant, timezone: config.timezone }) : null;
  const householdService = householdClient && config.homeAssistant
    ? new HomeAssistantHouseholdService(householdClient, config.timezone, config.homeAssistant.dataRefreshSeconds * 1_000,
        (error) => app.log.warn({ error }, 'Home Assistant background household refresh failed'))
    : null;
  if (config.dataMode === 'live') await photoIndex.start().catch((error) => app.log.warn({ error }, 'Initial photo index restore failed'));
  if (config.dataMode === 'live' && householdService) await householdService.start();
  app.addHook('onClose', async () => photoIndex.stop());
  app.addHook('onClose', async () => householdService?.stop());

  await app.register(createWeatherRoutes(config), { prefix: '/api/v1' });
  await app.register(createDashboardRoutes(config, householdService), { prefix: '/api/v1' });
  await app.register(createStatusRoutes(config, householdService), { prefix: '/api/v1' });
  await app.register(createPhotosRoutes(config, photoIndex), { prefix: '/api/v1' });
  await app.register(createDisplayConfigRoutes(config), { prefix: '/api/v1' });
  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(createMediaRoutes(photoIndex), { prefix: '/media' });

  if (fs.existsSync(config.webDistRoot)) {
    await app.register(fastifyStatic, {
      root: config.webDistRoot,
      prefix: '/',
    });

    app.setNotFoundHandler(async (request, reply) => {
      const pathname = new URL(request.url, 'http://local').pathname;
      if (pathname.startsWith('/api/') || pathname.startsWith('/media/')) {
        return reply.code(404).send({ error: 'not_found' });
      }
      return reply.sendFile('index.html');
    });
  }

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    return reply.code(500).send({ error: 'internal_error' });
  });

  return app;
}
