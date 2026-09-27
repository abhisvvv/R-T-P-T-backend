const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  });
}

// POST /api/auth/login  { email, password }
// Used by both drivers and admins — the role on the returned user decides what the client shows.
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !user.isActive) {
    return res.status(401).json({ message: 'Incorrect email or password.' });
  }

  const matches = await user.comparePassword(password);
  if (!matches) {
    return res.status(401).json({ message: 'Incorrect email or password.' });
  }

  const token = signToken(user);
  res.json({ token, user: user.toSafeObject() });
}

// GET /api/auth/me — confirms the current token and returns the profile.
async function me(req, res) {
  res.json({ user: req.user.toSafeObject() });
}

// POST /api/auth/drivers — admin-only. Creates a driver account for a given route.
async function createDriver(req, res) {
  const { name, email, password, assignedRoute } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'name, email and password are required.' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: 'An account with that email already exists.' });
  }

  const driver = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    role: 'driver',
    assignedRoute: assignedRoute || null,
  });

  res.status(201).json({ user: driver.toSafeObject() });
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // ~2MB — this is stored inline on the User doc (see model comment)

function avatarTooLarge(avatarUrl) {
  if (!avatarUrl) return false;
  // Rough byte-size check for a base64 data URL without decoding the whole thing.
  const base64Part = avatarUrl.split(',')[1] || '';
  return base64Part.length * 0.75 > MAX_AVATAR_BYTES;
}

// POST /api/auth/register — public. Lets a driver OR conductor create their own
// account and pick the route they'll work. Admin accounts are never self-service —
// those stay behind createDriver (admin-only) or the seed script.
async function registerDriver(req, res) {
  const { name, email, password, assignedRoute, role, avatarUrl, phone, licenseNumber, idProofNumber } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'name, email and password are required.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  }
  const staffRole = role === 'conductor' ? 'conductor' : 'driver';
  if (avatarTooLarge(avatarUrl)) {
    return res.status(400).json({ message: 'Profile picture is too large (max ~2MB).' });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: 'An account with that email already exists.' });
  }

  const staff = await User.create({
    name,
    email: email.toLowerCase(),
    password,
    role: staffRole,
    assignedRoute: assignedRoute || null,
    avatarUrl: avatarUrl || null,
    phone: phone || null,
    licenseNumber: staffRole === 'driver' ? licenseNumber || null : null,
    idProofNumber: idProofNumber || null,
  });

  const token = signToken(staff);
  res.status(201).json({ token, user: staff.toSafeObject() });
}

// POST /api/auth/google  { credential, assignedRoute?, role? }
// `credential` is the ID token the frontend gets from Google Identity Services.
// If the email already has an account (driver, conductor, or admin, created via
// seed, admin panel, password signup, or a previous Google sign-in), we log them
// in as-is — their existing role never changes. A brand-new email is created as
// a driver or conductor (whichever the frontend's signup screen was for). Admin
// accounts are never created here.
async function googleAuth(req, res) {
  const { credential, assignedRoute, role } = req.body;
  if (!credential) {
    return res.status(400).json({ message: 'Missing Google credential.' });
  }
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(500).json({ message: 'Google sign-in is not configured on this server.' });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    return res.status(401).json({ message: 'Could not verify Google credential.' });
  }

  const email = payload.email.toLowerCase();
  let user = await User.findOne({ email });

  if (user) {
    if (!user.googleId) {
      user.googleId = payload.sub;
      if (!user.avatarUrl && payload.picture) user.avatarUrl = payload.picture;
      await user.save();
    }
  } else {
    user = await User.create({
      name: payload.name || email,
      email,
      googleId: payload.sub,
      avatarUrl: payload.picture || null,
      role: role === 'conductor' ? 'conductor' : 'driver',
      assignedRoute: assignedRoute || null,
    });
  }

  if (!user.isActive) {
    return res.status(401).json({ message: 'This account has been disabled.' });
  }

  const token = signToken(user);
  res.json({ token, user: user.toSafeObject() });
}

module.exports = { login, me, createDriver, registerDriver, googleAuth };
