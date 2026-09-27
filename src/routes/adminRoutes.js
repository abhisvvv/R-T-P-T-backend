const express = require('express');
const {
  fleetOverview,
  createAnnouncement,
  listAnnouncements,
  listVerifications,
  setVerificationStatus,
} = require('../controllers/adminController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/fleet', requireAuth, requireRole('admin'), fleetOverview);
router.post('/announcements', requireAuth, requireRole('admin'), createAnnouncement);
router.get('/announcements/public', listAnnouncements); // public, read-only
router.get('/verifications', requireAuth, requireRole('admin'), listVerifications);
router.patch('/verifications/:id', requireAuth, requireRole('admin'), setVerificationStatus);

module.exports = router;
