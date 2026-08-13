import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import exifr from 'exifr';
import sharp from 'sharp';
import type { Photo } from '@family-display/contracts';

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const INDEX_VERSION = 1;
const INDEX_FILE = 'index.json';

interface IndexedPhoto extends Photo {
  sourcePath: string;
  thumbnailPath: string;
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
      .map(({ sourcePath: _sourcePath, thumbnailPath: _thumbnailPath, signature: _signature, ...photo }) => photo);
  }

  original(id: string) { return this.photos.get(id)?.sourcePath ?? null; }
  thumbnail(id: string) { return this.photos.get(id)?.thumbnailPath ?? null; }
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
    for (const photo of parsed.photos) {
      if (!this.isPersistedPhoto(photo)) continue;
      const sourcePath = path.resolve(rootPath, photo.relativePath);
      if (sourcePath !== rootPath && !sourcePath.startsWith(`${rootPath}${path.sep}`)) continue;
      restored.set(photo.id, {
        id: photo.id,
        mediaUrl: `/media/original/${photo.id}`,
        thumbnailUrl: `/media/thumbnail/${photo.id}`,
        capturedAt: photo.capturedAt,
        title: photo.title,
        sourcePath,
        thumbnailPath: path.join(this.cacheRoot, `${photo.id}.webp`),
        signature: photo.signature,
      });
    }
    this.photos.clear();
    for (const [id, photo] of restored) this.photos.set(id, photo);
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
    } finally {
      this.scanInProgress = false;
    }
  }

  private async indexFile(filePath: string, relativePath: string, id: string, existing: IndexedPhoto | undefined) {
    const fileStat = await stat(filePath);
    const signature = `${relativePath}:${fileStat.size}:${fileStat.mtimeMs}`;
    if (existing?.signature === signature) return existing;

    const thumbnailPath = path.join(this.cacheRoot, `${id}.webp`);
    const thumbnailStat = await stat(thumbnailPath).catch(() => null);
    if (!thumbnailStat || thumbnailStat.mtimeMs < fileStat.mtimeMs) {
      await sharp(filePath).autoOrient().resize({ width: 640, height: 420, fit: 'cover' }).webp({ quality: 80 }).toFile(thumbnailPath);
    }
    const exif = await exifr.parse(filePath, ['DateTimeOriginal']).catch(() => null) as { DateTimeOriginal?: Date } | null;
    const capturedDate = exif?.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal : fileStat.mtime;
    return {
      id,
      mediaUrl: `/media/original/${id}`,
      thumbnailUrl: `/media/thumbnail/${id}`,
      capturedAt: capturedDate.toISOString(),
      title: `${capturedDate.getMonth() + 1}月${capturedDate.getDate()}日的照片`,
      sourcePath: filePath,
      thumbnailPath,
      signature,
    } satisfies IndexedPhoto;
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
      if (entry.isDirectory()) files.push(...await this.walk(entryPath));
      if (entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(entryPath);
    }
    return files;
  }
}
