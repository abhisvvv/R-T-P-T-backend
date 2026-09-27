const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Passengers are not represented here — the public tracking endpoints are read-only
// and need no account. Only drivers, conductors, and admins authenticate.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: {
      type: String,
      minlength: 6,
      select: false,
      required: function passwordRequired() {
        return !this.googleId; // Google-authenticated accounts never set a local password
      },
    },
  googleId: {
  type: String,
  default: undefined,
},
    role: { type: String, enum: ['driver', 'conductor', 'admin'], required: true, default: 'driver' },
    assignedRoute: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', default: null },
    isActive: { type: Boolean, default: true },

    // Profile picture — either the Google account's photo URL, or a base64 data URL
    // uploaded at signup. There's no cloud file storage wired up in this project,
    // so uploads are stored inline; fine for a demo, not for real scale (see README).
    avatarUrl: { type: String, default: null },
    phone: { type: String, default: null, trim: true },

    // Self-declared at signup, for driver/conductor accounts only. This is NOT
    // connected to any government verification service (DigiLocker, Aadhaar, etc.)
    // — it's an honesty-on-the-honor-system field plus an admin approval step,
    // which is what's realistically buildable without a paid verification API.
    licenseNumber: { type: String, default: null, trim: true }, // driver only
    idProofNumber: { type: String, default: null, trim: true }, // driver + conductor
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: function defaultVerification() {
        return this.role === 'admin' ? 'verified' : 'pending';
      },
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function hashPassword(next) {
  if (!this.password || !this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    assignedRoute: this.assignedRoute,
    avatarUrl: this.avatarUrl,
    phone: this.phone,
    verificationStatus: this.verificationStatus,
  };
};

module.exports = mongoose.model('User', userSchema);
