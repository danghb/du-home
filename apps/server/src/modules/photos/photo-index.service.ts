import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import exifr from 'exifr';
import sharp from 'sharp';
import type { Photo } from '@family-display/contracts';

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

interface IndexedPhoto extends Photo {
  sourcePath: string;
  thumbnailPath: string;
  signature: string;
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
  ) {}

  async start() {
    this.stopped = false;
    await this.scan();
    if (this.stopped) return;
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
      for (const filePath of files) {
        try {
          const relativePath = path.relative(this.photoRoot, filePath);
          const fileStat = await stat(filePath);
          const signature = `${relativePath}:${fileStat.size}:${fileStat.mtimeMs}`;
          const id = createHash('sha256').update(relativePath).digest('hex').slice(0, 24);
          const existing = this.photos.get(id);
          if (existing?.signature === signature) {
            next.set(id, existing);
            continue;
          }
          const thumbnailPath = path.join(this.cacheRoot, `${id}.webp`);
          const thumbnailStat = await stat(thumbnailPath).catch(() => null);
          if (!thumbnailStat || thumbnailStat.mtimeMs < fileStat.mtimeMs) {
            await sharp(filePath).autoOrient().resize({ width: 640, height: 420, fit: 'cover' }).webp({ quality: 80 }).toFile(thumbnailPath);
          }
          const exif = await exifr.parse(filePath, ['DateTimeOriginal']).catch(() => null) as { DateTimeOriginal?: Date } | null;
          const capturedDate = exif?.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal : fileStat.mtime;
          next.set(id, {
            id,
            mediaUrl: `/media/original/${id}`,
            thumbnailUrl: `/media/thumbnail/${id}`,
            capturedAt: capturedDate.toISOString(),
            title: `${capturedDate.getMonth() + 1}月${capturedDate.getDate()}日的照片`,
            sourcePath: filePath,
            thumbnailPath,
            signature,
          });
        } catch (error) {
          // A damaged or unsupported file must not prevent the rest of the library from being indexed.
          this.onError(error, filePath);
        }
      }
      this.photos.clear();
      for (const [id, photo] of next) this.photos.set(id, photo);
    } finally {
      this.scanInProgress = false;
    }
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
