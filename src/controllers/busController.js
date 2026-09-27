const Bus = require('../models/Bus');

// GET /api/buses — public. Powers the passenger map's initial marker positions
// (live movement after that comes over the 'bus:update' socket event).
async function listBuses(req, res) {
  const filter = {};
  if (req.query.route) filter.route = req.query.route;

  const buses = await Bus.find(filter)
    .populate('route', 'routeCode name color')
    .populate('driver', 'name')
    .populate('conductor', 'name');
  res.json({ buses });
}

// POST /api/buses — admin-only. Registers a new vehicle against a route.
async function createBus(req, res) {
  const { busNumber, route, driver } = req.body;
  if (!busNumber || !route) {
    return res.status(400).json({ message: 'busNumber and route are required.' });
  }

  const exists = await Bus.findOne({ busNumber });
  if (exists) return res.status(409).json({ message: `Bus ${busNumber} already exists.` });

  const bus = await Bus.create({ busNumber, route, driver: driver || null });
  res.status(201).json({ bus });
}

// PATCH /api/buses/:id — admin-only. E.g. reassign driver, deactivate.
async function updateBus(req, res) {
  const bus = await Bus.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!bus) return res.status(404).json({ message: 'Bus not found.' });
  res.json({ bus });
}

// POST /api/buses/claim  { busNumber, routeId } — driver or conductor, self-service.
// This is what a newly-registered driver/conductor uses each day to say "I'm on
// this bus, this route, today" — without needing an admin to pre-provision every
// vehicle. If the bus number already exists (e.g. the driver already claimed it,
// or a conductor is joining the same physical bus), we just update whichever
// seat (driver/conductor) matches the caller's role rather than erroring.
async function claimBus(req, res) {
  const { busNumber, routeId } = req.body;
  if (!busNumber || !routeId) {
    return res.status(400).json({ message: 'busNumber and routeId are required.' });
  }
  if (!['driver', 'conductor'].includes(req.user.role)) {
    return res.status(403).json({ message: 'Only drivers and conductors can claim a bus.' });
  }

  let bus = await Bus.findOne({ busNumber: busNumber.trim() });

  if (!bus) {
    bus = await Bus.create({
      busNumber: busNumber.trim(),
      route: routeId,
      [req.user.role]: req.user._id,
    });
  } else {
    bus.route = routeId; // today's route, may differ from yesterday's for this bus
    bus[req.user.role] = req.user._id;
    await bus.save();
  }

  await bus.populate('route', 'routeCode name color');
  await bus.populate('driver', 'name phone');
  await bus.populate('conductor', 'name phone');

  const io = req.app.get('io');
  io.emit('fleet:changed'); // tells passenger clients to refetch the bus list

  res.status(201).json({ bus });
}

module.exports = { listBuses, createBus, updateBus, claimBus };
