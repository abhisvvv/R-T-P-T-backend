const Bus = require('../models/Bus');
const Trip = require('../models/Trip');

// These REST endpoints do the same job as the 'driver:startTrip' / 'driver:endTrip' /
// 'driver:flagDelay' socket events (see src/sockets/index.js). Keep both: the socket
// path is what the driver app uses live, REST is a fallback for flaky connections and
// for anything (like an admin tool) that isn't holding a socket open.

// POST /api/trips/start  { busId }  — driver-only, must be assigned that bus.
async function startTrip(req, res) {
  const { busId } = req.body;
  const bus = await Bus.findById(busId);
  if (!bus) return res.status(404).json({ message: 'Bus not found.' });
  if (String(bus.driver) !== String(req.user._id)) {
    return res.status(403).json({ message: 'You are not assigned to this bus.' });
  }

  bus.status = 'running';
  bus.progress = bus.progress || 0;
  bus.lastUpdated = new Date();
  await bus.save();

  const trip = await Trip.create({ bus: bus._id, driver: req.user._id, route: bus.route });

  const io = req.app.get('io');
  io.emit('bus:update', { busId: bus._id, status: bus.status, progress: bus.progress });

  res.status(201).json({ bus, trip });
}

// POST /api/trips/end  { busId }
async function endTrip(req, res) {
  const { busId } = req.body;
  const bus = await Bus.findById(busId);
  if (!bus) return res.status(404).json({ message: 'Bus not found.' });
  if (String(bus.driver) !== String(req.user._id)) {
    return res.status(403).json({ message: 'You are not assigned to this bus.' });
  }

  bus.status = 'idle';
  bus.lastUpdated = new Date();
  await bus.save();

  const trip = await Trip.findOne({ bus: bus._id, endedAt: null }).sort('-startedAt');
  if (trip) {
    trip.endedAt = new Date();
    await trip.save();
  }

  const io = req.app.get('io');
  io.emit('bus:update', { busId: bus._id, status: bus.status });

  res.json({ bus });
}

// POST /api/trips/delay  { busId, reason, delayed } — driver or conductor
async function flagDelay(req, res) {
  const { busId, reason, delayed } = req.body;
  const bus = await Bus.findById(busId);
  if (!bus) return res.status(404).json({ message: 'Bus not found.' });
  const isDriver = String(bus.driver) === String(req.user._id);
  const isConductor = String(bus.conductor) === String(req.user._id);
  if (!isDriver && !isConductor) {
    return res.status(403).json({ message: 'You are not assigned to this bus.' });
  }

  bus.status = delayed ? 'delayed' : 'running';
  bus.delayReason = delayed ? reason || 'Delay reported by driver' : null;
  await bus.save();

  const trip = await Trip.findOne({ bus: bus._id, endedAt: null }).sort('-startedAt');
  if (trip && delayed) {
    trip.wasDelayed = true;
    trip.delayReason = bus.delayReason;
    await trip.save();
  }

  const io = req.app.get('io');
  io.emit('bus:update', { busId: bus._id, status: bus.status, delayReason: bus.delayReason });
  io.emit('passenger:notification', {
    text: `${bus.busNumber} — ${bus.delayReason || 'back on schedule'}`,
    delay: delayed,
    createdAt: new Date(),
  });

  res.json({ bus });
}

module.exports = { startTrip, endTrip, flagDelay };
