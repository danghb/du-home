import fs from 'node:fs';
import { createApp } from './app/create-app.js';
import { loadConfig } from './config/config.js';

if (fs.existsSync('.env')) process.loadEnvFile('.env');

const config = loadConfig();
const app = await createApp(config);

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  process.exitCode = 1;
}
