const Route = require('../models/Route');

// GET /api/routes — public. Passengers use this to populate the route list / search.
async function listRoutes(req, res) {
  const routes = await Route.find({ isActive: true }).sort('routeCode');
  res.json({ routes });
}

// GET /api/routes/:id — public.
async function getRoute(req, res) {
  const route = await Route.findById(req.params.id);
  if (!route) return res.status(404).json({ message: 'Route not found.' });
  res.json({ route });
}

// POST /api/routes — admin-only.
async function createRoute(req, res) {
  const { routeCode, name, color, stops, path } = req.body;
  if (!routeCode || !name || !stops || !path) {
    return res.status(400).json({ message: 'routeCode, name, stops and path are required.' });
  }

  const exists = await Route.findOne({ routeCode: routeCode.toUpperCase() });
  if (exists) return res.status(409).json({ message: `Route ${routeCode} already exists.` });

  const route = await Route.create({ routeCode: routeCode.toUpperCase(), name, color, stops, path });
  res.status(201).json({ route });
}

// PATCH /api/routes/:id — admin-only. Partial update (e.g. edit stops or deactivate).
async function updateRoute(req, res) {
  const route = await Route.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!route) return res.status(404).json({ message: 'Route not found.' });
  res.json({ route });
}

module.exports = { listRoutes, getRoute, createRoute, updateRoute };
