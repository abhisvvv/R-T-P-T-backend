const mongoose = require('mongoose');

const busSchema = new mongoose.Schema(
  {
    busNumber: { type: String, required: true, unique: true, trim: true }, // e.g. "C-01" (real AICTSL bus number)
    route: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    conductor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: ['idle', 'running', 'delayed'], default: 'idle' },
    // progress is 0..1 along the route's path — the same representation the frontend simulation used.
    progress: { type: Number, default: 0, min: 0, max: 1 },
    currentLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    lastUpdated: { type: Date, default: null },
    delayReason: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Bus', busSchema);
