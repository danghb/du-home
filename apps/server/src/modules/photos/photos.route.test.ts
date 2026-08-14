import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import fastify from 'fastify';
import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';
import { PhotoIndexService } from './photo-index.service.js';
import { createMediaRoutes } from './photos.route.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {
    recursive: true, force: true, maxRetries: 2, retryDelay: 50,
  })));
});

describe('photo media routes', () => {
  it('serves display images with private caching and supports conditional requests', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'family-display-media-'));
    temporaryDirectories.push(root);
    const source = path.join(root, 'source');
    const cache = path.join(root, 'cache');
    await mkdir(source);
    await sharp({ create: { width: 1800, height: 2400, channels: 3, background: '#77aadd' } })
      .jpeg().toFile(path.join(source, 'portrait.jpg'));
    const index = new PhotoIndexService(source, cache, 60);
    await index.scan();
    const photo = index.list()[0]!;
    const app = fastify();
    await app.register(createMediaRoutes(index), { prefix: '/media' });

    const first = await app.inject({ method: 'GET', url: photo.mediaUrl });
    expect(first.statusCode).toBe(200);
    expect(first.headers['content-type']).toContain('image/webp');
    expect(first.headers['cache-control']).toBe('private, max-age=86400');
    expect(first.headers.etag).toBeTruthy();
    expect(first.headers['last-modified']).toBeTruthy();

    const cached = await app.inject({ method: 'GET', url: photo.mediaUrl, headers: { 'if-none-match': first.headers.etag! } });
    expect(cached.statusCode).toBe(304);
    expect(cached.body).toBe('');
    const original = await app.inject({ method: 'GET', url: `/media/original/${photo.id}` });
    expect(original.statusCode).toBe(404);
    await app.close();
  });
});
