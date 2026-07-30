import 'dotenv/config';
import { createApp } from './app.js';
import { loadEnvironment } from './config/environment.js';

const environment = loadEnvironment();
const app = createApp(environment);

const server = app.listen(environment.port, environment.host, () => {
  console.info(`API listening on http://${environment.host}:${environment.port}`);
});

function closeServer(): void {
  server.close((error) => {
    if (error !== undefined) {
      console.error('API shutdown failed.', error);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', closeServer);
process.once('SIGTERM', closeServer);
