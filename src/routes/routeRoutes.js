const express = require('express');
const { listRoutes, getRoute, createRoute, updateRoute } = require('../controllers/routeController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', listRoutes); // public
router.get('/:id', getRoute); // public
router.post('/', requireAuth, requireRole('admin'), createRoute);
router.patch('/:id', requireAuth, requireRole('admin'), updateRoute);

module.exports = router;
