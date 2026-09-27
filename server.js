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
const allowedOrigins = (process.env.CLIENT_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);

async function main() {
  await connectDB();

  // Self-healing: if the database has no routes at all — a fresh install where
  // `npm run seed` was never run, or failed silently — seed it automatically
  // on startup instead of leaving the app permanently empty. This only fires
  // when routes are truly zero, so it never touches a database that already
  // has real data in it.
  const routeCount = await Route.countDocuments();
  if (routeCount === 0) {
    console.log('[server] no routes found in the database — running the seed automatically...');
    try {
      await runFullSeed();
    } catch (err) {
      console.error('[server] automatic seed failed — the app will still start, but with no route data:', err.message);
    }
  }

  const app = buildApp();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: { origin: allowedOrigins.length ? allowedOrigins : '*' },
  });

  // Controllers reach the socket layer via req.app.get('io') so REST actions
  // (e.g. POST /api/trips/start) broadcast the same way the live socket events do.
  app.set('io', io);
  registerSocketHandlers(io);

  server.listen(PORT, () => {
    console.log(`[server] Sheher Transit backend listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
