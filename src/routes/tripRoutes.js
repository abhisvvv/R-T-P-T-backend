const express = require('express');
const { startTrip, endTrip, flagDelay } = require('../controllers/tripController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/start', requireAuth, requireRole('driver'), startTrip);
router.post('/end', requireAuth, requireRole('driver'), endTrip);
router.post('/delay', requireAuth, requireRole('driver', 'conductor'), flagDelay);

module.exports = router;
