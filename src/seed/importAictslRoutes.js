// Imports the real Indore AICTSL/Chalo bus route data (data/aictsl_routes.json)
// into MongoDB as Route documents.
//
// This MUST be run somewhere with internet access, because it geocodes every
// stop name through Nominatim (OpenStreetMap's free geocoding service) to get
// real coordinates — the source data only has stop NAMES, no lat/lng. That's
// why this couldn't just be baked into the seed script: geocoding needs a live
// network call per unique stop name.
//
// Honesty about data quality (also stored on each Route as `dataSource` /
// `stopsVerified`): the source file only lists each route's start and end
// stop, not the intermediate stops a real rider would pass. So each imported
// route is a 2-point path — a STRAIGHT LINE between the geocoded start and
// end coordinates, not the actual road-following route a bus takes. That's
// a real limitation of the source data, not something to paper over.
//
// Usage:
//   cd backend
//   npm install
//   cp .env.example .env   (set MONGO_URI)
//   node src/seed/importAictslRoutes.js [path/to/routes.json]

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/db');
const Route = require('../models/Route');

const DEFAULT_INPUT = path.join(__dirname, '..', '..', 'data', 'aictsl_routes.json');
const CACHE_PATH = path.join(__dirname, '..', '..', 'data', 'geocode-cache.json');
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const REQUEST_DELAY_MS = 1100; // stay under Nominatim's ~1 req/sec usage policy

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadCache() {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function geocode(stopName, cache) {
  const key = stopName.trim().toLowerCase();
  if (cache[key]) return cache[key];

  const query = `${stopName}, Indore, Madhya Pradesh, India`;
  const url = `${NOMINATIM_BASE}/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`;

  const res = await fetch(url, {
    headers: {
      // Nominatim's usage policy requires an identifying User-Agent for scripted use.
      'User-Agent': 'SheherTransit-CollegeProject/1.0 (contact: set-your-email-here)',
    },
  });
  if (!res.ok) throw new Error(`Nominatim request failed for "${stopName}": ${res.status}`);

  const data = await res.json();
  if (!data.length) {
    cache[key] = null;
    return null;
  }

  const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  cache[key] = result;
  return result;
}

// Deterministic color per physical bus number, so a bus's outbound and return
// legs render in the same color on the map.
function colorForBusNumber(busNumber) {
  const palette = ['#1F8A70', '#D65F4B', '#6C5CE0', '#B9791F', '#2E8B57', '#3A4556', '#8E44AD', '#C4432E'];
  let hash = 0;
  for (let i = 0; i < busNumber.length; i += 1) hash = (hash * 31 + busNumber.charCodeAt(i)) % palette.length;
  return palette[hash];
}

async function run() {
  const inputPath = process.argv[2] || DEFAULT_INPUT;
  if (!fs.existsSync(inputPath)) {
    console.error(`[import] input file not found: ${inputPath}`);
    process.exit(1);
  }

  const entries = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  console.log(`[import] loaded ${entries.length} route entries from ${inputPath}`);

  const cache = loadCache();
  const uniqueStops = [...new Set(entries.flatMap((e) => e.stops))];
  console.log(`[import] geocoding ${uniqueStops.length} unique stop names (this respects a ~1/sec rate limit, so it's slow the first time)...`);

  for (const stop of uniqueStops) {
    const key = stop.trim().toLowerCase();
    if (cache[key] !== undefined) continue; // already cached, including cached misses (null)
    try {
      const coords = await geocode(stop, cache);
      console.log(coords ? `[import] geocoded "${stop}" -> ${coords.lat}, ${coords.lng}` : `[import] NOT FOUND: "${stop}"`);
    } catch (err) {
      console.warn(`[import] geocode error for "${stop}":`, err.message);
    }
    saveCache(cache); // persist incrementally so a crash doesn't lose progress
    await sleep(REQUEST_DELAY_MS);
  }

  await connectDB();

  let created = 0;
  let skipped = 0;
  for (const entry of entries) {
    const startCoords = cache[entry.startStop.trim().toLowerCase()];
    const endCoords = cache[entry.endStop.trim().toLowerCase()];

    if (!startCoords || !endCoords) {
      console.warn(`[import] skipping ${entry.routeId} — could not geocode "${entry.startStop}" or "${entry.endStop}"`);
      skipped += 1;
      continue;
    }

    const routeDoc = {
      routeCode: entry.routeId,
      name: `${entry.startStop} → ${entry.endStop}`,
      color: colorForBusNumber(entry.busNumber),
      district: 'Indore',
      dataSource: 'aictsl-chalo-partial',
      stopsVerified: Boolean(entry.stopsVerified),
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

  console.log(`\n[import] done. ${created} routes created/updated, ${skipped} skipped (see warnings above).`);
  console.log('[import] reminder: each route\'s path is a straight line between geocoded stop coordinates,');
  console.log('[import] not the actual road-following route — the source data has no intermediate stops.');
  process.exit(0);
}

run().catch((err) => {
  console.error('[import] failed:', err);
  process.exit(1);
});
