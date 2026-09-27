# Sheher Transit — Backend

Express + MongoDB + Socket.IO backend for the real-time bus tracking system
described in the project synopsis. Pairs with the `sheher-transit-tracker.html`
frontend prototype — same three demo routes (R1, R2, R3), same data shapes.

## Stack

- **Express** — REST API (routes, buses, trips, admin, auth)
- **MongoDB / Mongoose** — persistence
- **Socket.IO** — live position updates, delay flags, passenger notifications
- **JWT (jsonwebtoken + bcryptjs)** — driver and admin authentication

Passenger tracking itself needs no login — every read-heavy endpoint
(`GET /api/routes`, `GET /api/buses`, the `bus:update` / `passenger:notification`
socket events) is public. Only actions that change state — starting a trip,
flagging a delay, sending an announcement, editing a route — require a token.

## Setup

```bash
npm install
cp .env.example .env      # then fill in MONGO_URI and JWT_SECRET
npm run seed               # creates 3 demo routes + 98 real AICTSL routes (hand-placed
                            # coordinates, no internet needed) + demo accounts, see below
npm run dev                 # starts on http://localhost:5000
```

**You can actually skip `npm run seed` entirely if you forget** — `server.js`
checks the database on every startup, and if it finds zero routes (a fresh
database, or a seed that failed partway), it runs the exact same seeding
automatically before accepting requests. Watch the terminal on first boot:
you'll see `[server] no routes found in the database — running the seed
automatically...` followed by the same `[seed:aictsl] ...` lines `npm run
seed` would print. If instead you see nothing route-related in that log and
the frontend still shows "No routes loaded yet", the problem is almost
certainly that the backend never connected to MongoDB in the first place
(wrong `MONGO_URI`, or MongoDB isn't running/reachable) — check the very
first few lines the server prints on startup for a connection error.

Seeded accounts (all use password `password123`):

| Role   | Email                              | Route |
|--------|-------------------------------------|-------|
| admin  | admin@shehertransit.test            | —     |
| driver | manoj.driver@shehertransit.test     | R1    |
| driver | farhan.driver@shehertransit.test    | R2    |
| driver | deepak.driver@shehertransit.test    | R3    |

## REST API

| Method | Path                          | Auth        | Purpose |
|--------|-------------------------------|-------------|---------|
| POST   | `/api/auth/login`             | —           | Get a JWT for a driver/conductor/admin account |
| POST   | `/api/auth/register`          | —           | Public self-signup — driver or conductor (role in body) |
| POST   | `/api/auth/google`            | —           | Sign in with a Google ID token; creates a driver/conductor account for a new email, logs in as-is for an existing one |
| GET    | `/api/auth/me`                | any         | Confirm the current token |
| POST   | `/api/auth/drivers`           | admin       | Create a driver account |
| POST   | `/api/buses/claim`            | driver/conductor | Self-service: "I'm on this bus/route today" — creates the bus if it doesn't exist yet, or joins an existing one |
| GET    | `/api/admin/verifications`    | admin       | List driver/conductor accounts and their self-declared license/ID numbers |
| PATCH  | `/api/admin/verifications/:id`| admin       | Mark an account verified/rejected/pending |
| GET    | `/api/routes`                 | —           | List all routes (passenger map/search) |
| GET    | `/api/routes/:id`             | —           | Route detail |
| POST   | `/api/routes`                 | admin       | Create a route |
| PATCH  | `/api/routes/:id`             | admin       | Edit a route |
| GET    | `/api/buses`                  | —           | List buses + last known position |
| POST   | `/api/buses`                  | admin       | Register a bus |
| PATCH  | `/api/buses/:id`               | admin       | Edit/reassign a bus |
| POST   | `/api/trips/start`            | driver      | Start a trip (REST fallback for the socket event) |
| POST   | `/api/trips/end`              | driver      | End a trip |
| POST   | `/api/trips/delay`            | driver      | Flag/clear a delay |
| GET    | `/api/admin/fleet`            | admin       | Fleet status table |
| POST   | `/api/admin/announcements`    | admin       | Send an announcement |
| GET    | `/api/admin/announcements/public` | —       | Recent announcements, for passengers |

## Socket.IO events

Connect with `io(url, { auth: { token } })` — pass no token for a read-only
passenger connection.

**Driver → server**
- `driver:locationUpdate` `{ busId, progress, lat, lng }` — send every 2–3s while a trip is running
- `driver:startTrip` `{ busId }`
- `driver:endTrip` `{ busId }`
- `driver:flagDelay` `{ busId, reason, delayed }`

**Admin → server**
- `admin:announcement` `{ routeId?, message }`

**Server → everyone (including anonymous passenger sockets)**
- `bus:update` `{ busId, progress, currentLocation, status, delayReason? }`
- `passenger:notification` `{ text, routeId?, delay, createdAt }`

## Driver, conductor, and the self-claim flow

A brand-new driver or conductor account has no bus assigned yet — instead of
needing an admin to pre-provision every vehicle, they call `POST
/api/buses/claim` with a route + bus number the moment they start their shift.
If that bus number doesn't exist yet, it's created; if it does (e.g. the
driver already claimed it and now the conductor is joining), the caller just
fills whichever seat (`driver` or `conductor`) matches their role. This is
also how a driver/conductor switches to a different bus the next day — same
endpoint, same bus number reused or a new one typed in.

## Document verification — what this actually is

`licenseNumber` and `idProofNumber` are **self-declared** at signup — typed in
by the driver/conductor, not checked against any government database. There
is no free API for verifying an Indian driving license or ID proof, so
building real verification would mean either paying for a commercial KYC
service or not verifying at all. What's built instead: the self-declared
numbers are visible to an admin via `GET /api/admin/verifications`, who can
mark each account `verified` or `rejected` by hand. That's an honest
approximation of a real onboarding process, not a replacement for one.

## Route data — what `npm run seed` actually loads

`npm run seed` now loads **three kinds of routes** in one go, no internet
required:

1. Five fictional demo routes (R1-R5) — for exercising the app with made-up
   data. R4/R5 are a direct Rajwada↔Palasia pair specifically so that
   from/to search pair has a direct match to test against (R1 and R2 each
   touch one of those stops but don't connect them directly, which is
   realistic — not every two stops in a city have a direct bus).
2. All 98 real Indore AICTSL bus route entries from `data/aictsl_routes.json`
   (real bus numbers, real terminus stop names, sourced from the Chalo app),
   placed using **hand-curated coordinates** in `data/stop-coordinates.json`
   — this is what makes the driver/conductor "which route will you work?"
   dropdown populated immediately without waiting on a live geocoding call.

**Be clear-eyed about accuracy here.** Those hand-placed coordinates are my
best estimate from general knowledge of Indore's geography, not a survey or
geocoding result. Each stop in `stop-coordinates.json` is tagged
`"confidence": "landmark"` (a well-known place — city center, a named
square, a well-known hospital/mall — probably accurate to within a few
hundred meters) or `"confidence": "approximate"` (right general area of the
city, not a precise point). Every route created this way is stored with
`dataSource: 'aictsl-hand-coords'` and `stopsVerified: false` so nothing
pretends to be more accurate than it is, and each route is still only a
2-point straight line between its start and end stop — the source data has
no intermediate stops, so there's no real road-following path to draw either
way.

**For real accuracy**, once you have internet access, run:

```bash
npm run import:aictsl
```

This re-geocodes every stop name through Nominatim (OpenStreetMap's free
geocoding service) and overwrites the same routeCodes with real coordinates.
See the comments at the top of `src/seed/importAictslRoutes.js` for exactly
what it does and its own limitations (rate-limited demo service, still a
straight-line path between two points since the source data has no
intermediate stops). `npm run seed:aictsl` re-runs just the hand-coordinate
version on its own, if you ever need to reset back to it.

## Connecting the frontend prototype

The HTML prototype currently simulates bus movement client-side with
`setInterval`. To wire it to this backend:

1. Replace the `tick()` simulation loop with a Socket.IO client (`socket.io-client`
   from the same CDN pattern) listening for `bus:update` and moving markers to
   the received `currentLocation` (or re-deriving position from `progress` with
   the existing `pointOnPath` helper — `src/utils/eta.js` has the same logic
   server-side for consistency).
2. Replace the driver view's local `state` mutations with emits:
   `driver:startTrip`, `driver:locationUpdate` (fed by `navigator.geolocation.watchPosition`
   on an actual phone), and `driver:flagDelay`.
3. Replace the admin announcement handler with a POST to
   `/api/admin/announcements` or an `admin:announcement` emit.
4. Fetch `/api/routes` and `/api/buses` on load instead of the hardcoded
   `routes` array, so route/stop edits made by an admin show up immediately.

## What's intentionally left out

This is a synopsis-stage scaffold, not a production system. Before deploying:
add request validation (e.g. `zod`/`joi`), rate limiting on the auth and
announcement endpoints, refresh tokens (the current JWT is a single
long-lived access token), input sanitization, and tests. The AI + n8n
notification pipeline from the synopsis isn't implemented here — the
`passenger:notification` socket event is exactly the hook n8n would call
into (e.g. via a webhook that POSTs to `/api/admin/announcements`) once that
workflow is built.
