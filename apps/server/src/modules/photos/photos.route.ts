import { mockPhotoResponse } from '@family-display/test-data';
import { photosResponseSchema } from '@family-display/contracts';
import type { FastifyPluginAsync } from 'fastify';
import type { AppConfig } from '../../config/config.js';
import type { PhotoIndexService } from './photo-index.service.js';
import path from 'node:path';

const DEFAULT_PHOTO_BATCH_SIZE = 64;
const MAX_PHOTO_BATCH_SIZE = 200;

function parseBatchSize(value: string | undefined) {
  const requested = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(requested)) return DEFAULT_PHOTO_BATCH_SIZE;
  return Math.min(MAX_PHOTO_BATCH_SIZE, Math.max(1, requested));
}

function imageContentType(filePath: string) {
  switch (path.extname(filePath).toLowerCase()) {
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    case '.webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}

export function createPhotosRoutes(config: AppConfig, index: PhotoIndexService): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Querystring: { limit?: string } }>('/photos', async (request) => {
      if (config.dataMode === 'mock') return photosResponseSchema.parse(mockPhotoResponse);
      const photos = index.sample(parseBatchSize(request.query.limit));
      return photosResponseSchema.parse({
        data: { photos: photos.length
          ? { status: 'ready', data: { items: photos, total: index.count() }, updatedAt: new Date().toISOString() }
          : { status: 'empty', data: null, updatedAt: new Date().toISOString() } },
        meta: { generatedAt: new Date().toISOString(), mode: 'live' },
      });
    });
  };
}

export function createMediaRoutes(index: PhotoIndexService): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Params: { photoId: string } }>('/display/:photoId', async (request, reply) => {
      const filePath = await index.display(request.params.photoId);
      if (!filePath) return reply.code(404).send({ error: 'photo_not_found' });
      return reply.type('image/webp').send(index.stream(filePath));
    });
    app.get<{ Params: { photoId: string } }>('/thumbnail/:photoId', async (request, reply) => {
      const filePath = index.thumbnail(request.params.photoId);
      if (!filePath) return reply.code(404).send({ error: 'photo_not_found' });
      return reply.type('image/webp').send(index.stream(filePath));
    });
  };
}
