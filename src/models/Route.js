const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    order: { type: Number, required: true },
  },
  { _id: false }
);

const routeSchema = new mongoose.Schema(
  {
    routeCode: { type: String, required: true, unique: true, uppercase: true, trim: true }, // e.g. "IND-001" or "R1"
    name: { type: String, required: true }, // e.g. "Advanced Academy to Rajwada"
    color: { type: String, default: '#1F8A70' },
    district: { type: String, default: 'Indore', trim: true },
    // Where this route's data came from, and how much to trust its geometry.
    // Real operator data (e.g. AICTSL bus numbers) only gives start/end names —
    // coordinates are geocoded from those names and the path between them is a
    // straight line, NOT the actual road-following alignment. Fabricated demo
    // data says so plainly instead of pretending to be more accurate than it is.
    dataSource: { type: String, default: 'demo' }, // 'demo' | 'aictsl-chalo-partial'
    stopsVerified: { type: Boolean, default: false },
    operator: { type: String, default: null }, // e.g. "AICTSL"
    busNumberLabel: { type: String, default: null }, // the real-world bus number this route corresponds to, if any
    stops: {
      type: [stopSchema],
      validate: (v) => Array.isArray(v) && v.length >= 2,
    },
    // Polyline the bus physically follows — used to interpolate position from GPS progress.
    path: {
      type: [[Number]], // array of [lat, lng]
      validate: (v) => Array.isArray(v) && v.length >= 2,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Route', routeSchema);
