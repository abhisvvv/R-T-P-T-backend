require('express-async-errors'); // lets async controllers `throw`/reject and still hit the error handler below
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const routeRoutes = require('./routes/routeRoutes');
const busRoutes = require('./routes/busRoutes');
const tripRoutes = require('./routes/tripRoutes');
const adminRoutes = require('./routes/adminRoutes');

function buildApp() {
  const app = express();

  const allowedOrigins = (process.env.CLIENT_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
  app.use(cors({ origin: allowedOrigins.length ? allowedOrigins : '*' }));
  app.use(express.json({ limit: '4mb' })); // base64 avatar uploads need more than the 100kb default

  app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  app.use('/api/auth', authRoutes);
  app.use('/api/routes', routeRoutes);
  app.use('/api/buses', busRoutes);
  app.use('/api/trips', tripRoutes);
  app.use('/api/admin', adminRoutes);

  // 404 for anything unmatched under /api
  app.use('/api', (req, res) => res.status(404).json({ message: 'Not found.' }));

  // Central error handler — controllers can just `throw` or reject; this catches the rest.
  app.use((err, req, res, next) => {
    console.error('[error]', err);
    res.status(err.status || 500).json({ message: err.message || 'Something went wrong.' });
  });

  return app;
}

module.exports = buildApp;
