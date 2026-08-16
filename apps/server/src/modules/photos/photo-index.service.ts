import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import exifr from 'exifr';
import sharp from 'sharp';
import type { Photo } from '@family-display/contracts';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MOTION_EXTENSIONS = new Set(['.mov']);
const DISCOVERED_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ...MOTION_EXTENSIONS]);
const INDEX_VERSION = 2;
const SCREENSHOT_RULE_VERSION = 1;
const INDEX_FILE = 'index.json';
const DISPLAY_DIRECTORY = 'display';
const MOTION_DIRECTORY = 'motion';
const DISPLAY_MAX_WIDTH = 1280;
const DISPLAY_MAX_HEIGHT = 1600;
const IGNORED_DIRECTORY_NAMES = new Set(['@eaDir', '#recycle', '@tmp', '.AppleDouble']);
const CACHED_IMAGE_FILE_PATTERN = /^[a-f0-9]{24}\.webp$/;
const CACHED_MOTION_FILE_PATTERN = /^[a-f0-9]{24}\.mp4$/;
const SCREENSHOT_NAME_PATTERN = /(?:screenshot|screen[ _-]?shot|截屏|截图|屏幕快照)/i;
const SCREEN_DIMENSIONS = new Set([
  '640x1136', '750x1334', '828x1792', '1080x1920', '1080x2340', '1125x2436',
  '1170x2532', '1179x2556', '1206x2622', '1242x2208', '1242x2688', '1284x2778',
  '1290x2796', '1320x2868', '1536x2048', '1640x2360', '1668x2224', '1668x2388',
  '2048x2732', '2064x2752',
]);

function containsIgnoredDirectory(relativePath: string) {
  return relativePath.split(/[\\/]/).some((segment) => IGNORED_DIRECTORY_NAMES.has(segment));
}

interface IndexedPhoto extends Photo {
  sourcePath: string;
  motionSourcePath: string | null;
  thumbnailPath: string;
  displayPath: string;
  motionPath: string;
  signature: string;
}

interface PersistedPhoto {
  id: string;
  relativePath: string;
  signature: string;
  capturedAt: string;
  title: string;
  motionRelativePath?: string;
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
  private readonly motionInFlight = new Map<string, Promise<string | null>>();

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
  async motion(id: string) {
    const photo = this.photos.get(id);
    if (!photo?.motionSourcePath) return null;
    const existing = this.motionInFlight.get(id);
    if (existing) return existing;

    const task = this.ensureMotionVideo(photo).finally(() => this.motionInFlight.delete(id));
    this.motionInFlight.set(id, task);
    return task;
  }
  stream(filePath: string, range?: { start: number; end: number }) {
    return createReadStream(filePath, range);
  }

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
      await this.persist().catch((error) => this.onError(error, indexPath));
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
      const motionSourcePath = photo.motionRelativePath
        ? path.resolve(rootPath, photo.motionRelativePath)
        : null;
      if (motionSourcePath && motionSourcePath !== rootPath && !motionSourcePath.startsWith(`${rootPath}${path.sep}`)) continue;
      restored.set(photo.id, {
        id: photo.id,
        mediaUrl: `/media/display/${photo.id}`,
        thumbnailUrl: `/media/thumbnail/${photo.id}`,
        ...(motionSourcePath ? { motionUrl: `/media/motion/${photo.id}` } : {}),
        capturedAt: photo.capturedAt,
        title: photo.title,
        sourcePath,
        motionSourcePath,
        thumbnailPath: path.join(this.cacheRoot, `${photo.id}.webp`),
        displayPath: path.join(this.cacheRoot, DISPLAY_DIRECTORY, `${photo.id}.webp`),
        motionPath: path.join(this.cacheRoot, MOTION_DIRECTORY, `${photo.id}.mp4`),
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

      const imageFiles = files.filter((filePath) => IMAGE_EXTENSIONS.has(path.extname(filePath).toLowerCase()));
      const motionByKey = new Map(files
        .filter((filePath) => MOTION_EXTENSIONS.has(path.extname(filePath).toLowerCase()))
        .map((filePath) => [this.mediaPairKey(path.relative(this.photoRoot, filePath)), filePath]));
      const next = new Map<string, IndexedPhoto>();
      let cursor = 0;
      let processed = 0;
      let checkpoint = Promise.resolve();
      const processNext = async () => {
        while (cursor < imageFiles.length) {
          const filePath = imageFiles[cursor++];
          if (!filePath) continue;
          const relativePath = path.relative(this.photoRoot, filePath);
          const id = createHash('sha256').update(relativePath).digest('hex').slice(0, 24);
          const existing = this.photos.get(id);
          try {
            const indexed = await this.indexFile(
              filePath,
              motionByKey.get(this.mediaPairKey(relativePath)) ?? null,
              relativePath,
              id,
              existing,
            );
            if (indexed) {
              next.set(id, indexed);
              // New and changed photos become visible while the rest of the library is still scanning.
              this.photos.set(id, indexed);
            } else {
              this.photos.delete(id);
            }
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
        { length: Math.min(Math.max(1, this.concurrency), Math.max(1, imageFiles.length)) },
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

  private async indexFile(
    filePath: string,
    motionSourcePath: string | null,
    relativePath: string,
    id: string,
    existing: IndexedPhoto | undefined,
  ) {
    const fileStat = await stat(filePath);
    const motionStat = motionSourcePath ? await stat(motionSourcePath).catch(() => null) : null;
    const signature = [
      `screenshot-rules-${SCREENSHOT_RULE_VERSION}`,
      relativePath,
      fileStat.size,
      fileStat.mtimeMs,
      motionSourcePath ? path.relative(this.photoRoot, motionSourcePath) : '',
      motionStat?.size ?? '',
      motionStat?.mtimeMs ?? '',
    ].join(':');
    if (existing?.signature === signature) return existing;

    const metadata = await sharp(filePath).metadata();
    const exif = await exifr.parse(filePath, [
      'DateTimeOriginal', 'Make', 'Model', 'LensModel', 'ExposureTime', 'FNumber', 'ISO',
    ]).catch(() => null) as {
      DateTimeOriginal?: Date;
      Make?: string;
      Model?: string;
      LensModel?: string;
      ExposureTime?: number;
      FNumber?: number;
      ISO?: number;
    } | null;
    if (this.isLikelyScreenshot(relativePath, metadata.width, metadata.height, exif)) return null;

    const thumbnailPath = path.join(this.cacheRoot, `${id}.webp`);
    const displayPath = path.join(this.cacheRoot, DISPLAY_DIRECTORY, `${id}.webp`);
    const motionPath = path.join(this.cacheRoot, MOTION_DIRECTORY, `${id}.mp4`);
    const thumbnailStat = await stat(thumbnailPath).catch(() => null);
    if (!thumbnailStat || thumbnailStat.mtimeMs < fileStat.mtimeMs) {
      await sharp(filePath).autoOrient().resize({ width: 640, height: 420, fit: 'cover' }).webp({ quality: 80 }).toFile(thumbnailPath);
    }
    const capturedDate = exif?.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal : fileStat.mtime;
    return {
      id,
      mediaUrl: `/media/display/${id}`,
      thumbnailUrl: `/media/thumbnail/${id}`,
      ...(motionStat ? { motionUrl: `/media/motion/${id}` } : {}),
      capturedAt: capturedDate.toISOString(),
      title: `${capturedDate.getMonth() + 1}月${capturedDate.getDate()}日的照片`,
      sourcePath: filePath,
      motionSourcePath: motionStat ? motionSourcePath : null,
      thumbnailPath,
      displayPath,
      motionPath,
      signature,
    } satisfies IndexedPhoto;
  }

  private isLikelyScreenshot(
    relativePath: string,
    width: number | undefined,
    height: number | undefined,
    exif: { Make?: string; Model?: string; LensModel?: string; ExposureTime?: number; FNumber?: number; ISO?: number } | null,
  ) {
    if (SCREENSHOT_NAME_PATTERN.test(path.basename(relativePath))) return true;
    if (!width || !height) return false;
    const hasCameraMetadata = Boolean(
      exif?.Make || exif?.Model || exif?.LensModel
      || exif?.ExposureTime !== undefined || exif?.FNumber !== undefined || exif?.ISO !== undefined,
    );
    if (hasCameraMetadata) return false;
    const dimensions = `${Math.min(width, height)}x${Math.max(width, height)}`;
    return SCREEN_DIMENSIONS.has(dimensions);
  }

  private mediaPairKey(relativePath: string) {
    const parsed = path.parse(relativePath);
    return path.join(parsed.dir, parsed.name).toLowerCase();
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

  private async ensureMotionVideo(photo: IndexedPhoto) {
    if (!photo.motionSourcePath) return null;
    const cachedStat = await stat(photo.motionPath).catch(() => null);
    const sourceStat = await stat(photo.motionSourcePath).catch(() => null);
    if (cachedStat && (!sourceStat || cachedStat.mtimeMs >= sourceStat.mtimeMs)) return photo.motionPath;
    if (!sourceStat) return null;

    await mkdir(path.dirname(photo.motionPath), { recursive: true });
    const temporaryPath = `${photo.motionPath}.tmp`;
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(process.env.FFMPEG_PATH ?? 'ffmpeg', [
          '-hide_banner', '-loglevel', 'error', '-y',
          '-i', photo.motionSourcePath!,
          '-map', '0:v:0', '-an',
          '-vf', 'scale=1280:1280:force_original_aspect_ratio=decrease:force_divisible_by=2',
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
          '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
          '-f', 'mp4', temporaryPath,
        ], { windowsHide: true });
        let stderr = '';
        child.stderr.on('data', (chunk: Buffer) => {
          if (stderr.length < 4_096) stderr += chunk.toString().slice(0, 4_096 - stderr.length);
        });
        child.once('error', reject);
        child.once('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg exited with ${code}: ${stderr.trim()}`));
        });
      });
      await rename(temporaryPath, photo.motionPath);
      return photo.motionPath;
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      this.onError(error, photo.motionSourcePath);
      return null;
    }
  }

  private toPublicPhoto(photo: IndexedPhoto): Photo {
    const {
      sourcePath: _sourcePath,
      motionSourcePath: _motionSourcePath,
      thumbnailPath: _thumbnailPath,
      displayPath: _displayPath,
      motionPath: _motionPath,
      signature: _signature,
      ...publicPhoto
    } = photo;
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
        ...(photo.motionSourcePath ? { motionRelativePath: path.relative(this.photoRoot, photo.motionSourcePath) } : {}),
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
      && typeof photo.title === 'string'
      && (photo.motionRelativePath === undefined || (
        typeof photo.motionRelativePath === 'string'
        && !path.isAbsolute(photo.motionRelativePath)
        && !photo.motionRelativePath.split(/[\\/]/).includes('..')
      ));
  }

  private async walk(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory() && !IGNORED_DIRECTORY_NAMES.has(entry.name)) files.push(...await this.walk(entryPath));
      if (entry.isFile() && DISCOVERED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(entryPath);
    }
    return files;
  }

  private async pruneOrphanedCache() {
    const activeIds = new Set(this.photos.keys());
    const activeMotionIds = new Set([...this.photos.values()]
      .filter((photo) => photo.motionSourcePath)
      .map((photo) => photo.id));
    const pruneDirectory = async (directory: string, pattern: RegExp, retainedIds = activeIds) => {
      const entries = await readdir(directory, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') return [];
        throw error;
      });
      const orphanedEntries = entries
        .filter((entry) => entry.isFile() && pattern.test(entry.name))
        .filter((entry) => !retainedIds.has(path.parse(entry.name).name));
      for (let offset = 0; offset < orphanedEntries.length; offset += 32) {
        await Promise.all(orphanedEntries.slice(offset, offset + 32).map((entry) => (
          unlink(path.join(directory, entry.name)).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
          })
        )));
      }
    };
    await pruneDirectory(this.cacheRoot, CACHED_IMAGE_FILE_PATTERN);
    await pruneDirectory(path.join(this.cacheRoot, DISPLAY_DIRECTORY), CACHED_IMAGE_FILE_PATTERN);
    await pruneDirectory(path.join(this.cacheRoot, MOTION_DIRECTORY), CACHED_MOTION_FILE_PATTERN, activeMotionIds);
  }
}
