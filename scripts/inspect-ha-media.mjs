import fs from 'node:fs';

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
  if (waiterIndex >= 0) waiters.splice(waiterIndex, 1)[0].resolve(message);
  else queue.push(message);
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

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', () => reject(new Error('Unable to open Home Assistant WebSocket')), { once: true });
});
await receive((message) => message.type === 'auth_required');
socket.send(JSON.stringify({ type: 'auth', access_token: token }));
const auth = await receive((message) => message.type === 'auth_ok' || message.type === 'auth_invalid');
if (auth.type !== 'auth_ok') throw new Error('Home Assistant authentication failed');

function summarize(item, children = item.children) {
  return {
    title: item.title,
    mediaClass: item.media_class,
    mediaContentType: item.media_content_type,
    mediaContentId: item.media_content_id,
    canPlay: item.can_play,
    canExpand: item.can_expand,
    thumbnail: item.thumbnail ?? null,
    children: Array.isArray(children) ? children : [],
  };
}

async function browse(mediaContentId, depth) {
  const item = await call({ type: 'media_source/browse_media', media_content_id: mediaContentId });
  const children = [];
  for (const child of item.children ?? []) {
    if (depth > 0 && child.can_expand) {
      try { children.push(await browse(child.media_content_id, depth - 1)); }
      catch { children.push(summarize(child)); }
    } else children.push(summarize(child));
  }
  return summarize(item, children);
}

const resolveOnly = process.argv[2] === '--resolve';
const requestedId = resolveOnly ? process.argv[3] : (process.argv[2] ?? 'media-source://');
const requestedDepth = Number.parseInt(process.argv[3] ?? '1', 10);
const root = resolveOnly
  ? await call({ type: 'media_source/resolve_media', media_content_id: requestedId })
  : await browse(requestedId, Number.isFinite(requestedDepth) ? requestedDepth : 1);
socket.close();
console.log(JSON.stringify(resolveOnly ? root : summarize(root), null, 2));
