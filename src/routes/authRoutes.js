const express = require('express');
const { login, me, createDriver, registerDriver, googleAuth } = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/login', login);
router.post('/register', registerDriver); // public self-signup, driver role only
router.post('/google', googleAuth); // public — Google Identity Services credential
router.get('/me', requireAuth, me);
router.post('/drivers', requireAuth, requireRole('admin'), createDriver);

module.exports = router;
