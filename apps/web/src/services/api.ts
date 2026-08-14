import {
  dashboardResponseSchema,
  photosResponseSchema,
  displayConfigResponseSchema,
  statusResponseSchema,
  type DashboardResponse,
  type PhotosResponse,
  type DisplayConfigResponse,
  type StatusResponse,
} from '@family-display/contracts';

async function fetchJson<T>(url: string, parse: (input: unknown) => T): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`请求失败：${response.status}`);
  return parse(await response.json());
}

export const api = {
  dashboard: (): Promise<DashboardResponse> => fetchJson('/api/v1/dashboard', dashboardResponseSchema.parse),
  status: (): Promise<StatusResponse> => fetchJson('/api/v1/status', statusResponseSchema.parse),
  photos: (): Promise<PhotosResponse> => fetchJson('/api/v1/photos', photosResponseSchema.parse),
  config: (): Promise<DisplayConfigResponse> => fetchJson('/api/v1/config', displayConfigResponseSchema.parse),
};
