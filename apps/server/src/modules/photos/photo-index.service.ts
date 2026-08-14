import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import exifr from 'exifr';
import sharp from 'sharp';
import type { Photo } from '@family-display/contracts';

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const INDEX_VERSION = 1;
const INDEX_FILE = 'index.json';
const DISPLAY_DIRECTORY = 'display';
const DISPLAY_MAX_WIDTH = 1280;
const DISPLAY_MAX_HEIGHT = 1600;
const IGNORED_DIRECTORY_NAMES = new Set(['@eaDir', '#recycle', '@tmp', '.AppleDouble']);
const CACHED_PHOTO_FILE_PATTERN = /^[a-f0-9]{24}\.webp$/;

function containsIgnoredDirectory(relativePath: string) {
  return relativePath.split(/[\\/]/).some((segment) => IGNORED_DIRECTORY_NAMES.has(segment));
}

interface IndexedPhoto extends Photo {
  sourcePath: string;
  thumbnailPath: string;
  displayPath: string;
  signature: string;
}

interface PersistedPhoto {
  id: string;
  relativePath: string;
  signature: string;
  capturedAt: string;
  title: string;
}

interface PersistedIndex {
  version: number;
  photos: PersistedPhoto[];
}

export class PhotoIndexService {
  private readonly photos = new Map<string, IndexedPhoto>();
  private timer: NodeJS.Timeout | null = null;
  private scanInProgress = false;
  private stopped = false;
  private readonly displayInFlight = new Map<string, Promise<string | null>>();

  constructor(
    private readonly photoRoot: string,
    private readonly cacheRoot: string,
    private readonly intervalMinutes: number,
    private readonly onError: (error: unknown, filePath?: string) => void = () => undefined,
    private readonly concurrency = 2,
  ) {}

  async start() {
    this.stopped = false;
    await this.restore();
    if (this.stopped) return;
    void this.scan().catch((error) => this.onError(error));
    this.timer = setInterval(
      () => void this.scan().catch((error) => this.onError(error)),
      this.intervalMinutes * 60_000,
    );
    this.timer.unref();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  list(): Photo[] {
    return [...this.photos.values()]
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
      .map((photo) => this.toPublicPhoto(photo));
  }

  count() { return this.photos.size; }

  sample(limit: number, random = Math.random): Photo[] {
    const sampleSize = Math.min(Math.max(0, Math.floor(limit)), this.photos.size);
    if (!sampleSize) return [];
    const selected: IndexedPhoto[] = [];
    let seen = 0;
    for (const photo of this.photos.values()) {
      seen += 1;
      if (selected.length < sampleSize) {
        selected.push(photo);
        continue;
      }
      const replacement = Math.floor(random() * seen);
      if (replacement < sampleSize) selected[replacement] = photo;
    }
    return selected.map((photo) => this.toPublicPhoto(photo));
  }

  thumbnail(id: string) { return this.photos.get(id)?.thumbnailPath ?? null; }
  async display(id: string) {
    const photo = this.photos.get(id);
    if (!photo) return null;
    const existing = this.displayInFlight.get(id);
    if (existing) return existing;

    const task = this.ensureDisplayImage(photo).finally(() => this.displayInFlight.delete(id));
    this.displayInFlight.set(id, task);
    return task;
  }
  stream(filePath: string) { return createReadStream(filePath); }

  async restore() {
    await mkdir(this.cacheRoot, { recursive: true });
    const indexPath = path.join(this.cacheRoot, INDEX_FILE);
    let parsed: PersistedIndex;
    try {
      parsed = JSON.parse(await readFile(indexPath, 'utf8')) as PersistedIndex;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') this.onError(error, indexPath);
      return;
    }
    if (parsed.version !== INDEX_VERSION || !Array.isArray(parsed.photos)) {
      this.onError(new Error('Unsupported photo index format'), indexPath);
      return;
    }

    const restored = new Map<string, IndexedPhoto>();
    const rootPath = path.resolve(this.photoRoot);
    let ignoredEntries = 0;
    for (const photo of parsed.photos) {
      if (!this.isPersistedPhoto(photo)) continue;
      if (containsIgnoredDirectory(photo.relativePath)) {
        ignoredEntries += 1;
        continue;
      }
      const sourcePath = path.resolve(rootPath, photo.relativePath);
      if (sourcePath !== rootPath && !sourcePath.startsWith(`${rootPath}${path.sep}`)) continue;
      restored.set(photo.id, {
        id: photo.id,
        mediaUrl: `/media/display/${photo.id}`,
        thumbnailUrl: `/media/thumbnail/${photo.id}`,
        capturedAt: photo.capturedAt,
        title: photo.title,
        sourcePath,
        thumbnailPath: path.join(this.cacheRoot, `${photo.id}.webp`),
        displayPath: path.join(this.cacheRoot, DISPLAY_DIRECTORY, `${photo.id}.webp`),
        signature: photo.signature,
      });
    }
    this.photos.clear();
    for (const [id, photo] of restored) this.photos.set(id, photo);
    if (ignoredEntries > 0) {
      await this.persist().catch((error) => this.onError(error, indexPath));
    }
  }

  async scan() {
    if (this.scanInProgress) return;
    this.scanInProgress = true;
    try {
      await mkdir(this.cacheRoot, { recursive: true });
      let files: string[];
      try {
        files = await this.walk(this.photoRoot);
      } catch (error) {
        this.onError(error, this.photoRoot);
        return;
      }

      const next = new Map<string, IndexedPhoto>();
      let cursor = 0;
      let processed = 0;
      let checkpoint = Promise.resolve();
      const processNext = async () => {
        while (cursor < files.length) {
          const filePath = files[cursor++];
          if (!filePath) continue;
          const relativePath = path.relative(this.photoRoot, filePath);
          const id = createHash('sha256').update(relativePath).digest('hex').slice(0, 24);
          const existing = this.photos.get(id);
          try {
            const indexed = await this.indexFile(filePath, relativePath, id, existing);
            next.set(id, indexed);
            // New and changed photos become visible while the rest of the library is still scanning.
            this.photos.set(id, indexed);
          } catch (error) {
            // A temporarily unreadable file must not remove its last known-good entry.
            if (existing) next.set(id, existing);
            this.onError(error, filePath);
          } finally {
            processed += 1;
            if (processed % 1_000 === 0) {
              checkpoint = checkpoint
                .then(() => this.persist())
                .catch((error) => this.onError(error, path.join(this.cacheRoot, INDEX_FILE)));
            }
          }
        }
      };
      await Promise.all(Array.from(
        { length: Math.min(Math.max(1, this.concurrency), Math.max(1, files.length)) },
        () => processNext(),
      ));
      await checkpoint;

      this.photos.clear();
      for (const [id, photo] of next) this.photos.set(id, photo);
      await this.persist().catch((error) => this.onError(error, path.join(this.cacheRoot, INDEX_FILE)));
      await this.pruneOrphanedCache().catch((error) => this.onError(error, this.cacheRoot));
    } finally {
      this.scanInProgress = false;
    }
  }

  private async indexFile(filePath: string, relativePath: string, id: string, existing: IndexedPhoto | undefined) {
    const fileStat = await stat(filePath);
    const signature = `${relativePath}:${fileStat.size}:${fileStat.mtimeMs}`;
    if (existing?.signature === signature) return existing;

    const thumbnailPath = path.join(this.cacheRoot, `${id}.webp`);
    const displayPath = path.join(this.cacheRoot, DISPLAY_DIRECTORY, `${id}.webp`);
    const thumbnailStat = await stat(thumbnailPath).catch(() => null);
    if (!thumbnailStat || thumbnailStat.mtimeMs < fileStat.mtimeMs) {
      await sharp(filePath).autoOrient().resize({ width: 640, height: 420, fit: 'cover' }).webp({ quality: 80 }).toFile(thumbnailPath);
    }
    const exif = await exifr.parse(filePath, ['DateTimeOriginal']).catch(() => null) as { DateTimeOriginal?: Date } | null;
    const capturedDate = exif?.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal : fileStat.mtime;
    return {
      id,
      mediaUrl: `/media/display/${id}`,
      thumbnailUrl: `/media/thumbnail/${id}`,
      capturedAt: capturedDate.toISOString(),
      title: `${capturedDate.getMonth() + 1}月${capturedDate.getDate()}日的照片`,
      sourcePath: filePath,
      thumbnailPath,
      displayPath,
      signature,
    } satisfies IndexedPhoto;
  }

  private async ensureDisplayImage(photo: IndexedPhoto) {
    const displayStat = await stat(photo.displayPath).catch(() => null);
    const sourceStat = await stat(photo.sourcePath).catch(() => null);
    if (displayStat && (!sourceStat || displayStat.mtimeMs >= sourceStat.mtimeMs)) return photo.displayPath;
    if (!sourceStat) return null;

    await mkdir(path.dirname(photo.displayPath), { recursive: true });
    const temporaryPath = `${photo.displayPath}.tmp`;
    try {
      await sharp(photo.sourcePath)
        .autoOrient()
        .resize({
          width: DISPLAY_MAX_WIDTH,
          height: DISPLAY_MAX_HEIGHT,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toFile(temporaryPath);
      await rename(temporaryPath, photo.displayPath);
      return photo.displayPath;
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      this.onError(error, photo.sourcePath);
      return null;
    }
  }

  private toPublicPhoto(photo: IndexedPhoto): Photo {
    const { sourcePath: _sourcePath, thumbnailPath: _thumbnailPath, displayPath: _displayPath, signature: _signature, ...publicPhoto } = photo;
    return publicPhoto;
  }

  private async persist() {
    const indexPath = path.join(this.cacheRoot, INDEX_FILE);
    const temporaryPath = `${indexPath}.tmp`;
    const persisted: PersistedIndex = {
      version: INDEX_VERSION,
      photos: [...this.photos.values()].map((photo) => ({
        id: photo.id,
        relativePath: path.relative(this.photoRoot, photo.sourcePath),
        signature: photo.signature,
        capturedAt: photo.capturedAt,
        title: photo.title,
      })),
    };
    await writeFile(temporaryPath, JSON.stringify(persisted), 'utf8');
    await rename(temporaryPath, indexPath);
  }

  private isPersistedPhoto(value: unknown): value is PersistedPhoto {
    if (!value || typeof value !== 'object') return false;
    const photo = value as Partial<PersistedPhoto>;
    return typeof photo.id === 'string'
      && /^[a-f0-9]{24}$/.test(photo.id)
      && typeof photo.relativePath === 'string'
      && !path.isAbsolute(photo.relativePath)
      && !photo.relativePath.split(/[\\/]/).includes('..')
      && typeof photo.signature === 'string'
      && typeof photo.capturedAt === 'string'
      && Number.isFinite(Date.parse(photo.capturedAt))
      && typeof photo.title === 'string';
  }

  private async walk(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory() && !IGNORED_DIRECTORY_NAMES.has(entry.name)) files.push(...await this.walk(entryPath));
      if (entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(entryPath);
    }
    return files;
  }

  private async pruneOrphanedCache() {
    const activeIds = new Set(this.photos.keys());
    const pruneDirectory = async (directory: string) => {
      const entries = await readdir(directory, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return [];
        throw error;
      });
      const orphanedEntries = entries
        .filter((entry) => entry.isFile() && CACHED_PHOTO_FILE_PATTERN.test(entry.name))
        .filter((entry) => !activeIds.has(path.basename(entry.name, '.webp')));
      for (let offset = 0; offset < orphanedEntries.length; offset += 32) {
        await Promise.all(orphanedEntries.slice(offset, offset + 32).map((entry) => (
          unlink(path.join(directory, entry.name)).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
          })
        )));
      }
    };
    await pruneDirectory(this.cacheRoot);
    await pruneDirectory(path.join(this.cacheRoot, DISPLAY_DIRECTORY));
  }
}
