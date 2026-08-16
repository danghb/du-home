import { mockPhotoResponse } from '@family-display/test-data';
import { photosResponseSchema } from '@family-display/contracts';
import type { FastifyPluginAsync } from 'fastify';
import type { AppConfig } from '../../config/config.js';
import type { PhotoIndexService } from './photo-index.service.js';
import path from 'node:path';
import { stat } from 'node:fs/promises';
import type { FastifyReply, FastifyRequest } from 'fastify';

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

async function sendCachedImage(request: FastifyRequest, reply: FastifyReply, index: PhotoIndexService, filePath: string) {
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat) return reply.code(404).send({ error: 'photo_not_found' });
  const modifiedAt = new Date(fileStat.mtimeMs);
  const etag = `"${fileStat.size.toString(16)}-${Math.trunc(fileStat.mtimeMs).toString(16)}"`;
  reply
    .header('Cache-Control', 'private, max-age=86400')
    .header('ETag', etag)
    .header('Last-Modified', modifiedAt.toUTCString());

  const ifNoneMatch = request.headers['if-none-match'];
  const ifModifiedSince = request.headers['if-modified-since'];
  const notModifiedByTag = typeof ifNoneMatch === 'string' && ifNoneMatch.split(',').map((value) => value.trim()).includes(etag);
  const modifiedSince = typeof ifModifiedSince === 'string' ? Date.parse(ifModifiedSince) : Number.NaN;
  const notModifiedByDate = !ifNoneMatch && Number.isFinite(modifiedSince)
    && Math.floor(fileStat.mtimeMs / 1_000) <= Math.floor(modifiedSince / 1_000);
  if (notModifiedByTag || notModifiedByDate) return reply.code(304).send();
  return reply.type(imageContentType(filePath)).send(index.stream(filePath));
}

async function sendCachedVideo(request: FastifyRequest, reply: FastifyReply, index: PhotoIndexService, filePath: string) {
  const fileStat = await stat(filePath).catch(() => null);
  if (!fileStat) return reply.code(404).send({ error: 'motion_not_found' });
  const modifiedAt = new Date(fileStat.mtimeMs);
  const etag = `"${fileStat.size.toString(16)}-${Math.trunc(fileStat.mtimeMs).toString(16)}"`;
  reply
    .header('Cache-Control', 'private, max-age=86400')
    .header('ETag', etag)
    .header('Last-Modified', modifiedAt.toUTCString())
    .header('Accept-Ranges', 'bytes')
    .type('video/mp4');

  const range = request.headers.range;
  if (!range) {
    reply.header('Content-Length', fileStat.size);
    return reply.send(index.stream(filePath));
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) return reply.code(416).header('Content-Range', `bytes */${fileStat.size}`).send();
  const suffixLength = !match[1] && match[2] ? Number.parseInt(match[2], 10) : null;
  const requestedStart = match[1] ? Number.parseInt(match[1], 10) : 0;
  const requestedEnd = match[2] ? Number.parseInt(match[2], 10) : fileStat.size - 1;
  const start = suffixLength === null
    ? Math.max(0, requestedStart)
    : Math.max(0, fileStat.size - suffixLength);
  const end = suffixLength === null
    ? Math.min(fileStat.size - 1, requestedEnd)
    : fileStat.size - 1;
  if (start > end || start >= fileStat.size) {
    return reply.code(416).header('Content-Range', `bytes */${fileStat.size}`).send();
  }
  reply
    .code(206)
    .header('Content-Range', `bytes ${start}-${end}/${fileStat.size}`)
    .header('Content-Length', end - start + 1);
  return reply.send(index.stream(filePath, { start, end }));
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
      return sendCachedImage(request, reply, index, filePath);
    });
    app.get<{ Params: { photoId: string } }>('/thumbnail/:photoId', async (request, reply) => {
      const filePath = index.thumbnail(request.params.photoId);
      if (!filePath) return reply.code(404).send({ error: 'photo_not_found' });
      return sendCachedImage(request, reply, index, filePath);
    });
    app.get<{ Params: { photoId: string } }>('/motion/:photoId', async (request, reply) => {
      const filePath = await index.motion(request.params.photoId);
      if (!filePath) return reply.code(404).send({ error: 'motion_not_found' });
      return sendCachedVideo(request, reply, index, filePath);
    });
  };
}
