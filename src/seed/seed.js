// Populates demo accounts, 3 fictional routes, and the real Indore AICTSL
// route data. Run directly with `npm run seed`, or it's called automatically
// by server.js on startup if the database has no routes yet — see the note
// at the bottom of this file.
const connectDB = require('../config/db');
const Route = require('../models/Route');
const Bus = require('../models/Bus');
const User = require('../models/User');
const seedAictslRoutes = require('./seedAictslRoutes');

const routeSeeds = [
  {
    routeCode: 'R1',
    name: 'Vijay Nagar to Palasia',
    color: '#1F8A70',
    stops: [
      { name: 'Vijay Nagar Square', lat: 22.753, lng: 75.8933, order: 0 },
      { name: 'C21 Mall', lat: 22.746, lng: 75.889, order: 1 },
      { name: 'LIG Square', lat: 22.739, lng: 75.885, order: 2 },
      { name: 'Geeta Bhawan', lat: 22.73, lng: 75.883, order: 3 },
      { name: 'Palasia Square', lat: 22.7196, lng: 75.88, order: 4 },
    ],
    path: [
      [22.753, 75.8933],
      [22.746, 75.889],
      [22.739, 75.885],
      [22.73, 75.883],
      [22.7196, 75.88],
    ],
  },
  {
    routeCode: 'R2',
    name: 'Rajwada to Bhawarkuan',
    color: '#D65F4B',
    stops: [
      { name: 'Rajwada', lat: 22.718, lng: 75.8555, order: 0 },
      { name: 'Sarafa Bazaar', lat: 22.715, lng: 75.86, order: 1 },
      { name: 'Rajmohalla', lat: 22.708, lng: 75.865, order: 2 },
      { name: 'Nehru Stadium', lat: 22.701, lng: 75.87, order: 3 },
      { name: 'Bhawarkuan Square', lat: 22.695, lng: 75.875, order: 4 },
    ],
    path: [
      [22.718, 75.8555],
      [22.715, 75.86],
      [22.708, 75.865],
      [22.701, 75.87],
      [22.695, 75.875],
    ],
  },
  {
    routeCode: 'R3',
    name: 'MR10 to Sarwate Bus Stand',
    color: '#6C5CE0',
    stops: [
      { name: 'MR10 Crossing', lat: 22.748, lng: 75.905, order: 0 },
      { name: 'Bombay Hospital Square', lat: 22.74, lng: 75.899, order: 1 },
      { name: 'AB Road Junction', lat: 22.73, lng: 75.89, order: 2 },
      { name: 'Regal Square', lat: 22.722, lng: 75.88, order: 3 },
      { name: 'Sarwate Bus Stand', lat: 22.716, lng: 75.87, order: 4 },
    ],
    path: [
      [22.748, 75.905],
      [22.74, 75.899],
      [22.73, 75.89],
      [22.722, 75.88],
      [22.716, 75.87],
    ],
  },
  {
    // A direct Rajwada<->Palasia pair — fictional/demo like R1-R3 above, NOT
    // real AICTSL data. Added because a from/to search between these two
    // exact stops kept coming up "no direct route" against the other demo
    // routes (Rajwada is on R2, Palasia is on R1, but neither route runs
    // between them directly) — this just gives that specific search pair a
    // direct match to test with. Only 2 stops (straight line), same honesty
    // rule as the AICTSL import: no invented intermediate stop.
    routeCode: 'R4',
    name: 'Rajwada to Palasia',
    color: '#B9791F',
    dataSource: 'demo',
    stops: [
      { name: 'Rajwada', lat: 22.718, lng: 75.8555, order: 0 },
      { name: 'Palasia Square', lat: 22.7196, lng: 75.88, order: 1 },
    ],
    path: [
      [22.718, 75.8555],
      [22.7196, 75.88],
    ],
  },
  {
    routeCode: 'R5',
    name: 'Palasia to Rajwada',
    color: '#B9791F',
    dataSource: 'demo',
    stops: [
      { name: 'Palasia Square', lat: 22.7196, lng: 75.88, order: 0 },
      { name: 'Rajwada', lat: 22.718, lng: 75.8555, order: 1 },
    ],
    path: [
      [22.7196, 75.88],
      [22.718, 75.8555],
    ],
  },
];

const driverSeeds = [
  { name: 'Manoj Sisodiya', email: 'manoj.driver@shehertransit.test', routeCode: 'R1', busNumber: 'MP09-BUS-011' },
  { name: 'Farhan Qureshi', email: 'farhan.driver@shehertransit.test', routeCode: 'R2', busNumber: 'MP09-BUS-022' },
  { name: 'Deepak Vishwakarma', email: 'deepak.driver@shehertransit.test', routeCode: 'R3', busNumber: 'MP09-BUS-033' },
];

const DEMO_PASSWORD = 'password123'; // change immediately in any real deployment

// The actual seeding work, with no connectDB() and no process.exit() — so it
// can be called either from the CLI entrypoint below, or from server.js on
// startup. Safe to call more than once: everything here is delete-then-create
// or upsert, so re-running just re-creates the same demo state.
async function runFullSeed() {
  console.log('[seed] clearing existing demo routes/buses/users before re-creating them...');
  await Route.deleteMany({ routeCode: { $in: routeSeeds.map((r) => r.routeCode) } });
  await Bus.deleteMany({ busNumber: { $in: driverSeeds.map((d) => d.busNumber) } });
  await User.deleteMany({ email: { $in: driverSeeds.map((d) => d.email).concat('admin@shehertransit.test') } });

  const routesByCode = {};
  for (const r of routeSeeds) {
    const route = await Route.create(r);
    routesByCode[r.routeCode] = route;
    console.log(`[seed] created route ${r.routeCode}`);
  }

  await User.create({
    name: 'Transport Admin',
    email: 'admin@shehertransit.test',
    password: DEMO_PASSWORD,
    role: 'admin',
  });
  console.log('[seed] created admin account: admin@shehertransit.test');

  for (const d of driverSeeds) {
    const route = routesByCode[d.routeCode];
    const driver = await User.create({
      name: d.name,
      email: d.email,
      password: DEMO_PASSWORD,
      role: 'driver',
      assignedRoute: route._id,
      phone: '9000000000',
      licenseNumber: 'DEMO-LIC-0000',
      idProofNumber: 'DEMO-ID-0000',
      verificationStatus: 'verified', // pre-approved so the seeded demo works immediately
    });
    await Bus.create({ busNumber: d.busNumber, route: route._id, driver: driver._id });
    console.log(`[seed] created driver ${d.name} + bus ${d.busNumber} on ${d.routeCode}`);
  }

  await User.deleteOne({ email: 'priya.conductor@shehertransit.test' });
  const conductor = await User.create({
    name: 'Priya Malviya',
    email: 'priya.conductor@shehertransit.test',
    password: DEMO_PASSWORD,
    role: 'conductor',
    assignedRoute: routesByCode.R1._id,
    phone: '9000000001',
    idProofNumber: 'DEMO-ID-0001',
    verificationStatus: 'verified',
  });
  await Bus.findOneAndUpdate({ busNumber: 'MP09-BUS-011' }, { conductor: conductor._id });
  console.log('[seed] created conductor Priya Malviya on bus MP09-BUS-011 (R1)');

  console.log('[seed] loading the real Indore AICTSL route data (hand-placed coordinates, no internet needed)...');
  await seedAictslRoutes();

  console.log(`[seed] done. Demo accounts use the password: ${DEMO_PASSWORD}`);
}

// CLI entrypoint: `npm run seed` or `node src/seed/seed.js`.
// server.js requires this file for runFullSeed and does its OWN connectDB —
// this block only runs when the file is executed directly, so requiring it
// elsewhere never opens a second, unwanted database connection or calls
// process.exit() out from under the running server.
if (require.main === module) {
  require('dotenv').config();
  connectDB()
    .then(runFullSeed)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[seed] failed:', err);
      process.exit(1);
    });
}

module.exports = runFullSeed;
