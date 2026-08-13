import { mockPhotoResponse } from '@family-display/test-data';
import { photosResponseSchema } from '@family-display/contracts';
import type { FastifyPluginAsync } from 'fastify';
import type { AppConfig } from '../../config/config.js';
import type { PhotoIndexService } from './photo-index.service.js';

export function createPhotosRoutes(config: AppConfig, index: PhotoIndexService): FastifyPluginAsync {
  return async (app) => {
    app.get('/photos', async () => {
      if (config.dataMode === 'mock') return photosResponseSchema.parse(mockPhotoResponse);
      const photos = index.list();
      return photosResponseSchema.parse({
        data: { photos: photos.length
          ? { status: 'ready', data: photos, updatedAt: new Date().toISOString() }
          : { status: 'empty', data: null, updatedAt: new Date().toISOString() } },
        meta: { generatedAt: new Date().toISOString(), mode: 'live' },
      });
    });
  };
}

export function createMediaRoutes(index: PhotoIndexService): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Params: { photoId: string } }>('/original/:photoId', async (request, reply) => {
      const filePath = index.original(request.params.photoId);
      if (!filePath) return reply.code(404).send({ error: 'photo_not_found' });
      return reply.type('application/octet-stream').send(index.stream(filePath));
    });
    app.get<{ Params: { photoId: string } }>('/thumbnail/:photoId', async (request, reply) => {
      const filePath = index.thumbnail(request.params.photoId);
      if (!filePath) return reply.code(404).send({ error: 'photo_not_found' });
      return reply.type('image/webp').send(index.stream(filePath));
    });
  };
}
