const mongoose = require('mongoose');

// A Trip is one start-to-end run. Keeping trip history separate from the live Bus
// document lets the admin dashboard show past performance (on-time %, delay frequency)
// without cluttering the live-tracking model.
const tripSchema = new mongoose.Schema(
  {
    bus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    route: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    wasDelayed: { type: Boolean, default: false },
    delayReason: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Trip', tripSchema);
