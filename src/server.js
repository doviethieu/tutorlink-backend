const http = require('http');
const app = require('./app');
const env = require('./config/env');
const connectDB = require('./config/db');
const configureSocket = require('./config/socket');

async function bootstrap() {
  await connectDB();

  const server = http.createServer(app);
  configureSocket(server, app);

  server.listen(env.port, () => {
    console.log(`[server] TutorLink API running at http://localhost:${env.port}`);
  });
}

bootstrap().catch((error) => {
  console.error('[server] failed to start', error);
  process.exit(1);
});
