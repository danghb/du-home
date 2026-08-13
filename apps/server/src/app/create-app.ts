import fs from 'node:fs';
import path from 'node:path';
import fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import type { AppConfig } from '../config/config.js';
import { dashboardRoutes } from '../modules/dashboard/dashboard.route.js';
import { healthRoutes } from '../modules/health/health.route.js';
import { createMediaRoutes, createPhotosRoutes } from '../modules/photos/photos.route.js';
import { PhotoIndexService } from '../modules/photos/photo-index.service.js';
import { statusRoutes } from '../modules/status/status.route.js';

export async function createApp(config: AppConfig) {
  const app = fastify({ logger: true });
  const photoIndex = new PhotoIndexService(config.photoRoot, config.photoCacheRoot, config.photoScanIntervalMinutes);
  if (config.dataMode === 'live') await photoIndex.start();
  app.addHook('onClose', async () => photoIndex.stop());

  await app.register(dashboardRoutes, { prefix: '/api/v1' });
  await app.register(statusRoutes, { prefix: '/api/v1' });
  await app.register(createPhotosRoutes(config, photoIndex), { prefix: '/api/v1' });
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
