import fs from 'node:fs';
import path from 'node:path';

if (fs.existsSync('.env')) process.loadEnvFile('.env');
const baseUrl = process.env.HA_BASE_URL;
const token = process.env.HA_TOKEN;
if (!baseUrl || !token) throw new Error('HA_BASE_URL or HA_TOKEN is missing');

const socketUrl = new URL('api/websocket', baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
socketUrl.protocol = socketUrl.protocol === 'https:' ? 'wss:' : 'ws:';

const socket = new WebSocket(socketUrl);
const queue = [];
const waiters = [];
let commandId = 1;

socket.addEventListener('message', (event) => {
  const message = JSON.parse(String(event.data));
  const waiterIndex = waiters.findIndex((waiter) => waiter.predicate(message));
  if (waiterIndex >= 0) {
    const [waiter] = waiters.splice(waiterIndex, 1);
    waiter.resolve(message);
  } else queue.push(message);
});

function receive(predicate, timeoutMs = 20_000) {
  const queuedIndex = queue.findIndex(predicate);
  if (queuedIndex >= 0) return Promise.resolve(queue.splice(queuedIndex, 1)[0]);
  return new Promise((resolve, reject) => {
    const waiter = { predicate, resolve };
    waiters.push(waiter);
    const timer = setTimeout(() => {
      const index = waiters.indexOf(waiter);
      if (index >= 0) waiters.splice(index, 1);
      reject(new Error('Home Assistant WebSocket response timed out'));
    }, timeoutMs);
    timer.unref();
  });
}

async function call(command) {
  const id = commandId++;
  socket.send(JSON.stringify({ id, ...command }));
  const response = await receive((message) => message.id === id && message.type === 'result');
  if (!response.success) throw new Error(response.error?.message ?? `Command failed: ${command.type}`);
  return response.result;
}

async function optionalCall(command) {
  try { return { ok: true, data: await call(command) }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
}

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', () => reject(new Error('Unable to open Home Assistant WebSocket')), { once: true });
});
await receive((message) => message.type === 'auth_required');
socket.send(JSON.stringify({ type: 'auth', access_token: token }));
const auth = await receive((message) => message.type === 'auth_ok' || message.type === 'auth_invalid');
if (auth.type !== 'auth_ok') throw new Error('Home Assistant authentication failed');

const [states, config, areasResult, devicesResult, entitiesResult, panelsResult, dashboardsResult] = await Promise.all([
  call({ type: 'get_states' }),
  call({ type: 'get_config' }),
  optionalCall({ type: 'config/area_registry/list' }),
  optionalCall({ type: 'config/device_registry/list' }),
  optionalCall({ type: 'config/entity_registry/list' }),
  optionalCall({ type: 'get_panels' }),
  optionalCall({ type: 'lovelace/dashboards/list' }),
]);

const areas = areasResult.ok ? areasResult.data : [];
const devices = devicesResult.ok ? devicesResult.data : [];
const registryEntities = entitiesResult.ok ? entitiesResult.data : [];
const areaById = new Map(areas.map((area) => [area.area_id, area]));
const deviceById = new Map(devices.map((device) => [device.id, device]));
const registryByEntity = new Map(registryEntities.map((entity) => [entity.entity_id, entity]));

const domainCounts = {};
for (const state of states) {
  const domain = state.entity_id.split('.')[0];
  domainCounts[domain] = (domainCounts[domain] ?? 0) + 1;
}

const usefulDomains = new Set([
  'weather', 'climate', 'light', 'switch', 'fan', 'cover', 'lock', 'vacuum', 'media_player',
  'person', 'zone', 'device_tracker', 'sun', 'sensor', 'binary_sensor', 'input_boolean', 'scene',
  'script', 'automation', 'todo', 'calendar',
]);
const usefulDeviceClasses = new Set([
  'temperature', 'humidity', 'door', 'window', 'opening', 'motion', 'occupancy', 'presence',
  'moisture', 'smoke', 'gas', 'carbon_monoxide', 'illuminance', 'aqi', 'pm25', 'power', 'energy',
]);

const candidateEntities = states.flatMap((state) => {
  const domain = state.entity_id.split('.')[0];
  const registry = registryByEntity.get(state.entity_id);
  const device = registry?.device_id ? deviceById.get(registry.device_id) : null;
  const areaId = registry?.area_id ?? device?.area_id ?? null;
  const deviceClass = state.attributes.device_class ?? null;
  if (!usefulDomains.has(domain) && !usefulDeviceClasses.has(deviceClass)) return [];
  if (registry?.disabled_by || registry?.entity_category === 'diagnostic') return [];
  return [{
    entityId: state.entity_id,
    name: state.attributes.friendly_name ?? registry?.name ?? registry?.original_name ?? state.entity_id,
    domain,
    state: state.state,
    unit: state.attributes.unit_of_measurement ?? null,
    deviceClass,
    area: areaId ? areaById.get(areaId)?.name ?? areaId : null,
    device: device?.name_by_user ?? device?.name ?? null,
    platform: registry?.platform ?? null,
  }];
});

const dashboards = dashboardsResult.ok ? dashboardsResult.data : [];
const dashboardInventory = [];
function cardSummary(card) {
  const entityIds = new Set();
  const visit = (value) => {
    if (typeof value === 'string' && /^[a-z_]+\.[a-z0-9_]+$/.test(value)) entityIds.add(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  visit(card);
  return { type: card?.type ?? 'unknown', entityIds: [...entityIds] };
}
for (const dashboard of dashboards) {
  const urlPath = dashboard.url_path ?? null;
  const result = await optionalCall({ type: 'lovelace/config', ...(urlPath ? { url_path: urlPath } : {}) });
  const views = result.ok && Array.isArray(result.data?.views) ? result.data.views : [];
  dashboardInventory.push({
    id: dashboard.id ?? urlPath ?? 'default',
    title: dashboard.title ?? dashboard.id ?? '默认仪表盘',
    urlPath,
    mode: dashboard.mode ?? null,
    showInSidebar: dashboard.show_in_sidebar ?? null,
    views: views.map((view, index) => ({
      index,
      title: view.title ?? `视图 ${index + 1}`,
      path: view.path ?? null,
      icon: view.icon ?? null,
      type: view.type ?? 'masonry',
      cardCount: Array.isArray(view.cards) ? view.cards.length : 0,
      cards: Array.isArray(view.cards) ? view.cards.map(cardSummary) : [],
    })),
    configError: result.ok ? null : result.error,
  });
}

const inventory = {
  inspectedAt: new Date().toISOString(),
  homeAssistant: { version: auth.ha_version, locationName: config.location_name, timezone: config.time_zone },
  counts: {
    states: states.length,
    registryEntities: registryEntities.length,
    devices: devices.length,
    areas: areas.length,
    dashboards: dashboards.length,
  },
  domains: Object.fromEntries(Object.entries(domainCounts).sort((a, b) => b[1] - a[1])),
  areas: areas.map((area) => ({ id: area.area_id, name: area.name, floorId: area.floor_id ?? null })),
  candidates: candidateEntities,
  dashboards: dashboardInventory,
  panels: panelsResult.ok
    ? Object.entries(panelsResult.data).map(([pathName, panel]) => ({ path: pathName, title: panel.title ?? null, component: panel.component_name ?? null }))
    : [],
  unavailableCommands: {
    areas: areasResult.ok ? null : areasResult.error,
    devices: devicesResult.ok ? null : devicesResult.error,
    entities: entitiesResult.ok ? null : entitiesResult.error,
    panels: panelsResult.ok ? null : panelsResult.error,
    dashboards: dashboardsResult.ok ? null : dashboardsResult.error,
  },
};

const outputDirectory = path.resolve('output', 'ha-inventory');
fs.mkdirSync(outputDirectory, { recursive: true });
const outputPath = path.join(outputDirectory, 'inventory.json');
fs.writeFileSync(outputPath, JSON.stringify(inventory, null, 2), 'utf8');
socket.close();

console.log(JSON.stringify({
  outputPath,
  homeAssistant: inventory.homeAssistant,
  counts: inventory.counts,
  domains: inventory.domains,
  areas: inventory.areas,
  dashboards: inventory.dashboards,
  candidates: inventory.candidates,
  unavailableCommands: inventory.unavailableCommands,
}, null, 2));
