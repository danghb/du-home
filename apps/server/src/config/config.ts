import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const configSchema = z.object({
  APP_HOST: z.string().default('0.0.0.0'),
  APP_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  APP_TIMEZONE: z.string().default('Asia/Hong_Kong'),
  APP_DATA_MODE: z.enum(['mock', 'live']).default('mock'),
  WEB_DIST_ROOT: z.string().optional(),
  PHOTO_ROOT: z.string().default('./sample-photos'),
  PHOTO_CACHE_ROOT: z.string().default('./cache/photos'),
  PHOTO_SCAN_INTERVAL_MINUTES: z.coerce.number().positive().default(60),
  HOME_PHOTO_ROTATION_SECONDS: z.coerce.number().positive().default(20),
  PAGE_ROTATION_ENABLED: z.enum(['true', 'false']).default('true'),
  PAGE_ROTATION_SCHEDULE: z.string().default('home:30,weather:30,status:30,photos:45'),
  HA_BASE_URL: z.string().optional(),
  HA_TOKEN: z.string().optional(),
  HA_WEATHER_ENTITY: z.preprocess(
    (value) => value === '' ? undefined : value,
    z.string().regex(/^weather\.[a-z0-9_]+$/).optional(),
  ),
  HA_WEATHER_REFRESH_MINUTES: z.coerce.number().positive().default(5),
  HA_DATA_REFRESH_SECONDS: z.coerce.number().positive().default(30),
});

function parsePageRotationSchedule(value: string) {
  const durations: Record<string, number> = {};
  for (const entry of value.split(',')) {
    const [pageId, secondsText] = entry.split(':').map((part) => part.trim());
    const seconds = Number(secondsText);
    if (pageId && Number.isFinite(seconds) && seconds > 0) durations[pageId] = seconds;
  }
  return durations;
}

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  const parsed = configSchema.parse(env);
  return {
    host: parsed.APP_HOST,
    port: parsed.APP_PORT,
    timezone: parsed.APP_TIMEZONE,
    dataMode: parsed.APP_DATA_MODE,
    webDistRoot: parsed.WEB_DIST_ROOT
      ? path.resolve(parsed.WEB_DIST_ROOT)
      : fileURLToPath(new URL('../../../web/dist', import.meta.url)),
    photoRoot: path.resolve(parsed.PHOTO_ROOT),
    photoCacheRoot: path.resolve(parsed.PHOTO_CACHE_ROOT),
    photoScanIntervalMinutes: parsed.PHOTO_SCAN_INTERVAL_MINUTES,
    display: {
      pageRotation: {
        enabled: parsed.PAGE_ROTATION_ENABLED === 'true',
        durationsSeconds: parsePageRotationSchedule(parsed.PAGE_ROTATION_SCHEDULE),
      },
      homePhotoRotationSeconds: parsed.HOME_PHOTO_ROTATION_SECONDS,
    },
    homeAssistant: parsed.HA_BASE_URL && parsed.HA_TOKEN
      ? {
          baseUrl: parsed.HA_BASE_URL,
          token: parsed.HA_TOKEN,
          weatherEntityId: parsed.HA_WEATHER_ENTITY ?? null,
          weatherRefreshMinutes: parsed.HA_WEATHER_REFRESH_MINUTES,
          dataRefreshSeconds: parsed.HA_DATA_REFRESH_SECONDS,
        }
      : null,
  };
}
