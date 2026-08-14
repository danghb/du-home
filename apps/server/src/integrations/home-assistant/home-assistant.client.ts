import type { Weather } from '@family-display/contracts';

export interface HomeAssistantState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_updated?: string;
}

export interface HomeAssistantTodoItem {
  uid?: string;
  summary?: string;
  status?: string;
  due?: string;
  description?: string;
  completed?: string;
}

interface ForecastItem {
  datetime?: string;
  condition?: string;
  temperature?: number;
  templow?: number;
  precipitation_probability?: number;
  precipitation?: number;
  humidity?: number;
  wind_speed?: number;
  uv_index?: number;
}

interface HomeAssistantClientOptions {
  baseUrl: string;
  token: string;
  weatherEntityId: string | null;
  timezone: string;
  fetcher?: typeof fetch;
}

export class HomeAssistantError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'HomeAssistantError';
  }
}

const conditionNames: Record<string, string> = {
  'clear-night': '晴夜', cloudy: '多云', exceptional: '异常天气', fog: '有雾', hail: '冰雹',
  lightning: '雷雨', 'lightning-rainy': '雷阵雨', partlycloudy: '多云', pouring: '暴雨',
  rainy: '阵雨', snowy: '下雪', 'snowy-rainy': '雨夹雪', sunny: '晴', windy: '有风',
  'windy-variant': '风和云',
};

function numberAttribute(attributes: Record<string, unknown>, key: string) {
  const value = attributes[key];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function translateCondition(condition: string | undefined) {
  if (!condition) return '天气未知';
  return conditionNames[condition] ?? condition;
}

export class HomeAssistantClient {
  private readonly baseUrl: URL;
  private readonly fetcher: typeof fetch;
  private discoveredWeatherEntityId: string | null = null;

  constructor(private readonly options: HomeAssistantClientOptions) {
    this.baseUrl = new URL(options.baseUrl.endsWith('/') ? options.baseUrl : `${options.baseUrl}/`);
    this.fetcher = options.fetcher ?? fetch;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.fetcher(new URL(path.replace(/^\//, ''), this.baseUrl), {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(15_000),
      headers: {
        Authorization: `Bearer ${this.options.token}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
    if (!response.ok) throw new HomeAssistantError(`Home Assistant 请求失败：${response.status}`, response.status);
    return response.json() as Promise<T>;
  }

  private async weatherState() {
    const configured = this.options.weatherEntityId ?? this.discoveredWeatherEntityId;
    if (configured) return this.request<HomeAssistantState>(`api/states/${configured}`);

    const states = await this.request<HomeAssistantState[]>('api/states');
    const weather = states.find((state) => state.entity_id.startsWith('weather.'));
    if (!weather) throw new HomeAssistantError('Home Assistant 中没有 weather.* 实体');
    this.discoveredWeatherEntityId = weather.entity_id;
    return weather;
  }

  getStates() {
    return this.request<HomeAssistantState[]>('api/states');
  }

  async getTodoItems(entityIds: string[]) {
    const response = await this.request<{ service_response?: Record<string, { items?: HomeAssistantTodoItem[] }> }>(
      'api/services/todo/get_items?return_response',
      { method: 'POST', body: JSON.stringify({ entity_id: entityIds }) },
    );
    return Object.fromEntries(entityIds.map((entityId) => [entityId, response.service_response?.[entityId]?.items ?? []]));
  }

  private async forecast(entityId: string, type: 'hourly' | 'daily') {
    try {
      const response = await this.request<{ service_response?: Record<string, { forecast?: ForecastItem[] }> }>(
        'api/services/weather/get_forecasts?return_response',
        { method: 'POST', body: JSON.stringify({ entity_id: entityId, type }) },
      );
      return response.service_response?.[entityId]?.forecast ?? [];
    } catch (error) {
      if (error instanceof HomeAssistantError && (error.status === 400 || error.status === 404)) return [];
      throw error;
    }
  }

  async getWeather(): Promise<{ data: Weather; updatedAt: string; entityId: string }> {
    const state = await this.weatherState();
    const [hourlyForecast, dailyForecast] = await Promise.all([
      this.forecast(state.entity_id, 'hourly'),
      this.forecast(state.entity_id, 'daily'),
    ]);
    const currentForecast = hourlyForecast[0];
    const temperature = typeof currentForecast?.temperature === 'number' ? currentForecast.temperature : numberAttribute(state.attributes, 'temperature');
    if (temperature === undefined) throw new HomeAssistantError(`${state.entity_id} 缺少 temperature 属性`);

    const unit = typeof state.attributes.temperature_unit === 'string' ? state.attributes.temperature_unit : '°C';
    const hourly = hourlyForecast.slice(0, 6).flatMap((item) => {
        if (!item.datetime || typeof item.temperature !== 'number') return [];
        return [{
          time: new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', hour12: false, timeZone: this.options.timezone }).format(new Date(item.datetime)).replace(':00', '时'),
          condition: translateCondition(item.condition),
          temperature: item.temperature,
          ...(typeof item.precipitation === 'number' ? { precipitation: item.precipitation, precipitationUnit: typeof state.attributes.precipitation_unit === 'string' ? state.attributes.precipitation_unit : 'mm' } : {}),
          ...(typeof item.precipitation_probability === 'number' ? { precipitationProbability: item.precipitation_probability } : {}),
        }];
      });
    const daily = dailyForecast.slice(0, 5).flatMap((item, index) => {
        if (!item.datetime || typeof item.temperature !== 'number') return [];
        const low = typeof item.templow === 'number' ? item.templow : item.temperature;
        return [{
          date: index === 0 ? '今天' : new Intl.DateTimeFormat('zh-CN', { weekday: 'short', timeZone: this.options.timezone }).format(new Date(item.datetime)),
          condition: translateCondition(item.condition), low, high: item.temperature,
        }];
      });
    const data: Weather = {
      condition: translateCondition(currentForecast?.condition ?? state.state),
      temperature,
      unit,
      ...(hourly.length > 0 ? { hourly } : {}),
      ...(daily.length > 0 ? { daily } : {}),
      ...(typeof currentForecast?.humidity === 'number' ? { humidity: currentForecast.humidity } : numberAttribute(state.attributes, 'humidity') !== undefined ? { humidity: numberAttribute(state.attributes, 'humidity') } : {}),
      ...(typeof currentForecast?.wind_speed === 'number' ? { windSpeed: currentForecast.wind_speed } : numberAttribute(state.attributes, 'wind_speed') !== undefined ? { windSpeed: numberAttribute(state.attributes, 'wind_speed') } : {}),
      ...(typeof state.attributes.wind_speed_unit === 'string' ? { windUnit: state.attributes.wind_speed_unit } : {}),
      ...(numberAttribute(state.attributes, 'pressure') !== undefined ? { pressure: numberAttribute(state.attributes, 'pressure') } : {}),
      ...(typeof state.attributes.pressure_unit === 'string' ? { pressureUnit: state.attributes.pressure_unit } : {}),
      ...(typeof currentForecast?.uv_index === 'number' ? { uvIndex: currentForecast.uv_index } : numberAttribute(state.attributes, 'uv_index') !== undefined ? { uvIndex: numberAttribute(state.attributes, 'uv_index') } : {}),
    };

    return { data, updatedAt: state.last_updated ?? new Date().toISOString(), entityId: state.entity_id };
  }
}
