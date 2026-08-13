import { createApp } from './app/create-app.js';
import { loadConfig } from './config/config.js';

const config = loadConfig();
const app = await createApp(config);

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
