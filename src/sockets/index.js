const jwt = require('jsonwebtoken');
const Bus = require('../models/Bus');
const Trip = require('../models/Trip');

// Driver sockets authenticate with the same JWT issued at login; passenger sockets
// connect anonymously (tracking is public). We only verify the token when it's present.
async function socketAuth(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) {
    socket.user = null; // anonymous passenger connection
    return next();
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    next(new Error('Invalid token'));
  }
}

function registerSocketHandlers(io) {
  io.use(socketAuth);

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.id} (${socket.user ? socket.user.role : 'passenger'})`);

    // ---- Driver events ----
    // Sent frequently (e.g. every 2-3s) with the phone's GPS-derived progress along
    // the route. We update the Bus doc and immediately fan the new position out to
    // every connected passenger client.
    socket.on('driver:locationUpdate', async ({ busId, progress, lat, lng }) => {
      if (!socket.user || socket.user.role !== 'driver') return;

      try {
        const update = { lastUpdated: new Date() };
        if (typeof progress === 'number') update.progress = progress;
        if (typeof lat === 'number' && typeof lng === 'number') {
          update.currentLocation = { lat, lng };
        }

        const bus = await Bus.findByIdAndUpdate(busId, update, { new: true });
        if (!bus) return;

        io.emit('bus:update', {
          busId: bus._id,
          progress: bus.progress,
          currentLocation: bus.currentLocation,
          status: bus.status,
        });
      } catch (err) {
        console.error('[socket] locationUpdate error:', err.message);
      }
    });

    socket.on('driver:startTrip', async ({ busId }) => {
      if (!socket.user || socket.user.role !== 'driver') return;
      const bus = await Bus.findByIdAndUpdate(
        busId,
        { status: 'running', lastUpdated: new Date() },
        { new: true }
      );
      if (!bus) return;
      await Trip.create({ bus: bus._id, driver: socket.user.id, route: bus.route });
      io.emit('bus:update', { busId: bus._id, status: bus.status });
    });

    socket.on('driver:endTrip', async ({ busId }) => {
      if (!socket.user || socket.user.role !== 'driver') return;
      const bus = await Bus.findByIdAndUpdate(
        busId,
        { status: 'idle', lastUpdated: new Date() },
        { new: true }
      );
      if (!bus) return;
      const trip = await Trip.findOne({ bus: bus._id, endedAt: null }).sort('-startedAt');
      if (trip) {
        trip.endedAt = new Date();
        await trip.save();
      }
      io.emit('bus:update', { busId: bus._id, status: bus.status });
    });

    socket.on('driver:flagDelay', async ({ busId, reason, delayed }) => {
      if (!socket.user || !['driver', 'conductor'].includes(socket.user.role)) return;
      const bus = await Bus.findByIdAndUpdate(
        busId,
        { status: delayed ? 'delayed' : 'running', delayReason: delayed ? reason : null },
        { new: true }
      );
      if (!bus) return;
      io.emit('bus:update', { busId: bus._id, status: bus.status, delayReason: bus.delayReason });
      io.emit('passenger:notification', {
        text: `${bus.busNumber} — ${bus.delayReason || 'back on schedule'}`,
        delay: delayed,
        createdAt: new Date(),
      });
    });

    // ---- Admin events ----
    socket.on('admin:announcement', ({ routeId, message }) => {
      if (!socket.user || socket.user.role !== 'admin') return;
      io.emit('passenger:notification', {
        text: message,
        routeId: routeId || null,
        delay: false,
        createdAt: new Date(),
      });
    });

    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.id}`);
    });
  });
}

module.exports = registerSocketHandlers;
