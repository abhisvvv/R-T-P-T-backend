// Loads the real Indore AICTSL/Chalo route data (data/aictsl_routes.json) into
// MongoDB as Route documents, using hand-curated coordinates
// (data/stop-coordinates.json) instead of a live geocoding call — so this
// works with NO internet access, unlike importAictslRoutes.js.
//
// Trade-off, stated plainly: those coordinates are approximate, based on
// general knowledge of Indore's geography, not a geocoding/survey source.
// Each stop's `confidence` in stop-coordinates.json says how sure that
// placement is — "landmark" (well-known place, probably accurate to within a
// few hundred meters) or "approximate" (right general area of the city, not
// a precise point). Every route created here is marked accordingly
// (dataSource: 'aictsl-hand-coords', stopsVerified: false) so nothing here
// pretends to be more accurate than it is. Once you have internet access,
// `npm run import:aictsl` re-geocodes everything through Nominatim and
// overwrites these with real coordinates for the same routeCodes.

const fs = require('fs');
const path = require('path');
const Route = require('../models/Route');

const ROUTES_PATH = path.join(__dirname, '..', '..', 'data', 'aictsl_routes.json');
const COORDS_PATH = path.join(__dirname, '..', '..', 'data', 'stop-coordinates.json');

function colorForBusNumber(busNumber) {
  const palette = ['#1F8A70', '#D65F4B', '#6C5CE0', '#B9791F', '#2E8B57', '#3A4556', '#8E44AD', '#C4432E'];
  let hash = 0;
  for (let i = 0; i < busNumber.length; i += 1) hash = (hash * 31 + busNumber.charCodeAt(i)) % palette.length;
  return palette[hash];
}

// Callable from another script (e.g. the main seed.js) with an already-open
// mongoose connection, or run standalone via the CLI block at the bottom.
async function seedAictslRoutes() {
  const entries = JSON.parse(fs.readFileSync(ROUTES_PATH, 'utf8'));
  const coords = JSON.parse(fs.readFileSync(COORDS_PATH, 'utf8'));
  delete coords._note;

  let created = 0;
  let skipped = 0;
  const lowConfidenceStops = new Set();

  for (const entry of entries) {
    const startCoords = coords[entry.startStop];
    const endCoords = coords[entry.endStop];

    if (!startCoords || !endCoords) {
      console.warn(`[seed:aictsl] skipping ${entry.routeId} — no coordinates for "${entry.startStop}" or "${entry.endStop}"`);
      skipped += 1;
      continue;
    }
    if (startCoords.confidence === 'approximate') lowConfidenceStops.add(entry.startStop);
    if (endCoords.confidence === 'approximate') lowConfidenceStops.add(entry.endStop);

    const routeDoc = {
      routeCode: entry.routeId,
      name: `${entry.startStop} → ${entry.endStop}`,
      color: colorForBusNumber(entry.busNumber),
      district: 'Indore',
      dataSource: 'aictsl-hand-coords',
      stopsVerified: false,
      operator: entry.operator || 'AICTSL',
      busNumberLabel: entry.busNumber,
      stops: [
        { name: entry.startStop, lat: startCoords.lat, lng: startCoords.lng, order: 0 },
        { name: entry.endStop, lat: endCoords.lat, lng: endCoords.lng, order: 1 },
      ],
      path: [
        [startCoords.lat, startCoords.lng],
        [endCoords.lat, endCoords.lng],
      ],
    };

    await Route.findOneAndUpdate({ routeCode: routeDoc.routeCode }, routeDoc, { upsert: true, new: true });
    created += 1;
  }

  console.log(`[seed:aictsl] ${created} real AICTSL routes created/updated, ${skipped} skipped.`);
  if (lowConfidenceStops.size) {
    console.log(`[seed:aictsl] ${lowConfidenceStops.size} stop names used an approximate (not landmark-level) placement:`);
    console.log('  ' + [...lowConfidenceStops].join(', '));
    console.log('[seed:aictsl] run `npm run import:aictsl` (needs internet) later for real geocoded coordinates.');
  }

  return { created, skipped };
}

// Allow running this file directly: `node src/seed/seedAictslRoutes.js`
if (require.main === module) {
  require('dotenv').config();
  const connectDB = require('../config/db');
  connectDB()
    .then(seedAictslRoutes)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed:aictsl] failed:', err);
      process.exit(1);
    });
}

module.exports = seedAictslRoutes;
