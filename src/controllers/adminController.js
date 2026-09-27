const Bus = require('../models/Bus');
const Announcement = require('../models/Announcement');
const User = require('../models/User');

// GET /api/admin/fleet — admin-only. Same shape the admin dashboard table renders.
async function fleetOverview(req, res) {
  const buses = await Bus.find()
    .populate('route', 'routeCode name color')
    .populate('driver', 'name');
  res.json({ buses });
}

// POST /api/admin/announcements  { routeId?, message } — admin-only.
// Broadcasts immediately over the socket and stores it so late-joining passengers
// can fetch recent history over REST.
async function createAnnouncement(req, res) {
  const { routeId, message } = req.body;
  if (!message) return res.status(400).json({ message: 'message is required.' });

  const announcement = await Announcement.create({
    route: routeId || null,
    message,
    createdBy: req.user._id,
  });

  const io = req.app.get('io');
  io.emit('passenger:notification', {
    text: message,
    routeId: routeId || null,
    delay: false,
    createdAt: announcement.createdAt,
  });

  res.status(201).json({ announcement });
}

// GET /api/announcements — public. Recent announcements for passengers who just opened the app.
async function listAnnouncements(req, res) {
  const announcements = await Announcement.find()
    .sort('-createdAt')
    .limit(25)
    .populate('route', 'routeCode');
  res.json({ announcements });
}

// GET /api/admin/verifications — admin-only. Driver/conductor accounts awaiting
// document review. This is a self-declared honor-system check (license number,
// ID proof number typed in at signup) plus this manual admin approval step —
// there's no connection to a real government ID verification service here.
async function listVerifications(req, res) {
  const users = await User.find({ role: { $in: ['driver', 'conductor'] } })
    .select('name email role phone licenseNumber idProofNumber verificationStatus assignedRoute createdAt')
    .populate('assignedRoute', 'routeCode name')
    .sort('-createdAt');
  res.json({ users });
}

// PATCH /api/admin/verifications/:id  { status: 'verified' | 'rejected' | 'pending' }
async function setVerificationStatus(req, res) {
  const { status } = req.body;
  if (!['verified', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ message: 'status must be verified, rejected, or pending.' });
  }
  const user = await User.findByIdAndUpdate(req.params.id, { verificationStatus: status }, { new: true });
  if (!user) return res.status(404).json({ message: 'User not found.' });
  res.json({ user: user.toSafeObject() });
}

module.exports = { fleetOverview, createAnnouncement, listAnnouncements, listVerifications, setVerificationStatus };
