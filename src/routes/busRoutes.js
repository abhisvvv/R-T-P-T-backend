const express = require('express');
const { listBuses, createBus, updateBus, claimBus } = require('../controllers/busController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', listBuses); // public
router.post('/claim', requireAuth, requireRole('driver', 'conductor'), claimBus);
router.post('/', requireAuth, requireRole('admin'), createBus);
router.patch('/:id', requireAuth, requireRole('admin'), updateBus);

module.exports = router;
