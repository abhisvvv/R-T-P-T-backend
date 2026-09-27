
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();

const http = require('http');
const { Server } = require('socket.io');

const buildApp = require('./src/app');
const connectDB = require('./src/config/db');
const registerSocketHandlers = require('./src/sockets');
const Route = require('./src/models/Route');
const runFullSeed = require('./src/seed/seed');

const PORT = process.env.PORT || 5000;

// Allowed frontend origins from Render environment variables
const allowedOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

async function main() {
  await connectDB();

  // Automatically seed routes if the database is empty
  const routeCount = await Route.countDocuments();

  if (routeCount === 0) {
    console.log(
      '[server] no routes found — running automatic seed...'
    );

    try {
      await runFullSeed();
    } catch (err) {
      console.error(
        '[server] automatic seed failed:',
        err.message
      );
    }
  }

  const app = buildApp();
  const server = http.createServer(app);

  // Socket.IO CORS configuration
  const io = new Server(server, {
    cors: {
      origin: allowedOrigins.length ? allowedOrigins : '*',
      methods: ['GET', 'POST'],
    },
  });

  // Make Socket.IO available to API controllers
  app.set('io', io);

  // Register socket event handlers
  registerSocketHandlers(io);

  server.listen(PORT, () => {
    console.log(
      `[server] Sheher Transit backend listening on port ${PORT}`
    );
    console.log(
      '[server] Allowed frontend origins:',
      allowedOrigins.length ? allowedOrigins : '*'
    );
  });
}

main().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});