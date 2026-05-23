const http = require('http');
const app = require('./app');
const env = require('./config/env');
const connectDB = require('./config/db');
const configureSocket = require('./config/socket');
const { startSchedulers } = require('./services/scheduler.service');

async function bootstrap() {
  const server = http.createServer(app);
  configureSocket(server, app);

  server.listen(env.port, () => {
    console.log(`[server] TutorLink API running at http://localhost:${env.port}`);
  });

  try {
    await connectDB();
    startSchedulers();
  } catch (error) {
    console.error('[database] failed to connect', error.message);
    console.error('[database] server is still running, but DB-backed APIs will fail until MongoDB is reachable');
  }
}

bootstrap().catch((error) => {
  console.error('[server] failed to start', error);
  process.exit(1);
});
