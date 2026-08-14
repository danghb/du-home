import { mkdtemp, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { PhotoIndexService } from './photo-index.service.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, {
    recursive: true,
    force: true,
    maxRetries: 2,
    retryDelay: 50,
  })));
});

describe('PhotoIndexService', () => {
  it('indexes valid photos, reuses cached thumbnails, and skips damaged files', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'family-display-photo-'));
    temporaryDirectories.push(root);
    const source = path.join(root, 'source');
    const cache = path.join(root, 'cache');
    await mkdir(source);
    const photoPath = path.join(source, 'landscape.jpg');
    await sharp({ create: { width: 800, height: 600, channels: 3, background: '#77aadd' } }).jpeg().toFile(photoPath);
    const errors: Array<string | undefined> = [];
    const service = new PhotoIndexService(source, cache, 60, (_error, filePath) => errors.push(filePath));

    await service.scan();
    expect(service.list()).toHaveLength(1);
    const thumbnailPath = service.thumbnail(service.list()[0]!.id)!;
    const firstThumbnailTime = (await stat(thumbnailPath)).mtimeMs;
    const displayPath = await service.display(service.list()[0]!.id);
    expect(displayPath).not.toBeNull();
    const displayMetadata = await sharp(await readFile(displayPath!)).metadata();
    expect(displayMetadata.format).toBe('webp');
    expect(displayMetadata.width).toBeLessThanOrEqual(1280);
    expect(displayMetadata.height).toBeLessThanOrEqual(1600);
    const firstDisplayTime = (await stat(displayPath!)).mtimeMs;

    await service.scan();
    expect((await stat(thumbnailPath)).mtimeMs).toBe(firstThumbnailTime);
    expect(await service.display(service.list()[0]!.id)).toBe(displayPath);
    expect((await stat(displayPath!)).mtimeMs).toBe(firstDisplayTime);

    await writeFile(path.join(source, 'damaged.jpg'), 'not an image');
    await service.scan();
    expect(service.list()).toHaveLength(1);
    expect(errors.some((filePath) => filePath?.endsWith('damaged.jpg'))).toBe(true);
  });

  it('restores the persisted index before starting a background rescan', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'family-display-photo-'));
    temporaryDirectories.push(root);
    const source = path.join(root, 'source');
    const cache = path.join(root, 'cache');
    await mkdir(source);
    await sharp({ create: { width: 120, height: 90, channels: 3, background: '#aaccee' } }).jpeg().toFile(path.join(source, 'memory.jpg'));

    const first = new PhotoIndexService(source, cache, 60);
    await first.scan();
    expect(first.list()).toHaveLength(1);

    await rename(source, path.join(root, 'source-offline'));
    const restored = new PhotoIndexService(source, cache, 60);
    await restored.start();
    expect(restored.list()).toEqual(first.list());
    restored.stop();
  });

  it('retains the last good index when the source directory is temporarily unavailable', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'family-display-photo-'));
    temporaryDirectories.push(root);
    const source = path.join(root, 'source');
    const cache = path.join(root, 'cache');
    await mkdir(source);
    await sharp({ create: { width: 100, height: 100, channels: 3, background: '#ffffff' } }).jpeg().toFile(path.join(source, 'photo.jpg'));
    const service = new PhotoIndexService(source, cache, 60);

    await service.scan();
    expect(service.list()).toHaveLength(1);
    await rename(source, path.join(root, 'source-offline'));
    await service.scan();
    expect(service.list()).toHaveLength(1);
  });
});
