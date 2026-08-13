import type { DashboardResponse } from '@family-display/contracts';
import type { HomeAssistantClient } from './home-assistant.client.js';

type WeatherSection = DashboardResponse['data']['weather'];
type WeatherSource = Pick<HomeAssistantClient, 'getWeather'>;

export class HomeAssistantWeatherService {
  private current: WeatherSection = {
    status: 'unavailable', data: null, updatedAt: null, reason: 'source_unavailable',
  };
  private timer: NodeJS.Timeout | null = null;
  private refreshing: Promise<void> | null = null;

  constructor(
    private readonly source: WeatherSource,
    private readonly refreshIntervalMs: number,
    private readonly onError: (error: unknown) => void = () => undefined,
  ) {}

  async start() {
    await this.refresh();
    this.timer = setInterval(() => void this.refresh(), this.refreshIntervalMs);
    this.timer.unref();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  getSnapshot(): WeatherSection {
    return structuredClone(this.current);
  }

  refresh(): Promise<void> {
    if (this.refreshing) return this.refreshing;
    this.refreshing = this.update().finally(() => { this.refreshing = null; });
    return this.refreshing;
  }

  private async update() {
    try {
      const weather = await this.source.getWeather();
      this.current = { status: 'ready', data: weather.data, updatedAt: weather.updatedAt };
    } catch (error) {
      this.onError(error);
      if (this.current.status !== 'ready') {
        this.current = { status: 'unavailable', data: null, updatedAt: null, reason: 'source_unavailable' };
      }
    }
  }
}
