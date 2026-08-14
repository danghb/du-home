import { describe, expect, it, vi } from 'vitest';
import { HomeAssistantClient } from './home-assistant.client.js';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('HomeAssistantClient', () => {
  it('maps current weather and forecast responses', async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/states/weather.home')) {
        return jsonResponse({
          entity_id: 'weather.home', state: 'partlycloudy', last_updated: '2026-08-13T03:00:00Z',
          attributes: { temperature: 28, temperature_unit: '°C', apparent_temperature: 30, humidity: 73, wind_speed: 12, wind_speed_unit: 'km/h', precipitation_unit: 'mm', pressure: 1001, pressure_unit: 'hPa', uv_index: 6 },
        });
      }
      const request = JSON.parse(String(init?.body)) as { type: string };
      const forecast = request.type === 'hourly'
        ? [{ datetime: '2026-08-13T04:00:00Z', condition: 'rainy', temperature: 27, precipitation: 1.2, precipitation_probability: 60, humidity: 88, wind_speed: 15.5, uv_index: 7 }]
        : [{ datetime: '2026-08-13T00:00:00Z', condition: 'partlycloudy', temperature: 31, templow: 25 }];
      return jsonResponse({ service_response: { 'weather.home': { forecast } } });
    }) as typeof fetch;

    const client = new HomeAssistantClient({
      baseUrl: 'https://hass.example.test/', token: 'secret', weatherEntityId: 'weather.home',
      timezone: 'Asia/Hong_Kong', fetcher,
    });
    const result = await client.getWeather();

    expect(result.entityId).toBe('weather.home');
    expect(result.data).toMatchObject({ condition: '阵雨', temperature: 27, humidity: 88, windSpeed: 15.5, pressure: 1001, uvIndex: 7 });
    expect(result.data.hourly?.[0]).toMatchObject({ condition: '阵雨', temperature: 27, precipitation: 1.2, precipitationUnit: 'mm', precipitationProbability: 60 });
    expect(result.data.daily?.[0]).toMatchObject({ date: '今天', low: 25, high: 31 });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('discovers the first weather entity when none is configured', async () => {
    const fetcher = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.endsWith('/api/states')) {
        return jsonResponse([{ entity_id: 'weather.local', state: 'sunny', attributes: { temperature: 26, temperature_unit: '°C' } }]);
      }
      return jsonResponse({ service_response: { 'weather.local': { forecast: [] } } });
    }) as typeof fetch;
    const client = new HomeAssistantClient({
      baseUrl: 'https://hass.example.test', token: 'secret', weatherEntityId: null,
      timezone: 'Asia/Hong_Kong', fetcher,
    });

    await expect(client.getWeather()).resolves.toMatchObject({ entityId: 'weather.local', data: { condition: '晴', temperature: 26 } });
  });
});
