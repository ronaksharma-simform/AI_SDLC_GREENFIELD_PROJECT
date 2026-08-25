# ADR 0003 — Trip start & live location tracking

- **Status:** Accepted
- **Date:** 2026-08-24

## Context

The platform gained an Uber-style trip lifecycle: a Provider starts a trip once
their ride is Active/Full, the ride enters an **In Progress** state during which
the Provider broadcasts their live position, and the trip is completed (or
cancelled) afterwards. Accepted Seekers need to follow the Provider's position
live on a map and be notified when the trip starts and completes.

This required several decisions that future readers would otherwise have to
rediscover:

1. Where the "In Progress" state lives in the existing state machine.
2. Where the live position is stored and how history is captured.
3. What transport delivers real-time position to Seekers (no WebSocket/SSE
   infrastructure exists in the codebase).
4. How the existing `/complete` endpoint interacts with the new lifecycle.

## Decision

### 1. Ride lifecycle state machine

`RideStatus` gains `IN_PROGRESS` between `FULL` and `COMPLETED`. The transitions
are enforced by pure helpers in `lib/trip-tracking.ts` and reused by the API
routes:

- `canStartTrip(status)` — only `ACTIVE` or `FULL` may start (Section 11).
- `canAcceptLocationUpdates(status)` — only `IN_PROGRESS` may broadcast
  (REQ-7).
- `canCompleteTrip(status)` — only `IN_PROGRESS` may complete (Section 11).

`POST /api/rides/{id}/complete` now requires the ride to be In Progress; it is
otherwise idempotent for already-Completed rides and rejects Cancelled rides. It
also sets `completedAt`, closes the ride's conversations (REQ-6), freezes any
declared cost split (PAY-4), and notifies every Accepted Seeker (Section 10.4).

### 2. Live position storage: single current-position fields + history table

The live map reads **single current-position fields on the `Ride` entity**
(`currentLatitude`, `currentLongitude`, `locationUpdatedAt`) — never the history
table. This keeps the hot read path cheap and matches how often the Provider's
device produces updates.

`RideLocationSnapshot` (trip location history, Section 4.2) captures the same
position at a **lower frequency** (`LOCATION_SNAPSHOT_INTERVAL_MS = 30s`) for
dispute resolution and safety review after the trip. Snapshot cadence is
decided server-side, independent of the frontend.

Rate limiting is server-side and absolute:
`MIN_LOCATION_UPDATE_INTERVAL_MS = 2s`. A Provider submitting faster than that
receives `429`. A stale location (no update for `LOCATION_STALE_AFTER_MS =
45s`) is surfaced to Seekers as a lost-signal indicator.

### 3. Real-time transport is polling (no WebSocket/SSE)

No real-time infrastructure exists in this codebase, and the spec explicitly
permits a polling fallback (Section 10.3). The Seeker view polls
`GET /api/rides/{id}/location` every 5s while the trip is In Progress and stops
polling as soon as the ride leaves In Progress. The Provider's device reports
via `navigator.geolocation.watchPosition` to
`POST /api/rides/{id}/location` every 5s.

Access control is explicit: only the ride's Provider may write location; only
the Provider and Seekers with an **Accepted** request on that ride may read
(REQ-8 / Section 13).

### 4. Frontend surfaces

- **Provider Ride Detail:** `ProviderTripControl` renders "Start trip" (with
  confirmation) once the ride is Active/Full and departure is at or near, and
  an "End trip" + "Location sharing active" indicator while In Progress.
- **Seeker feed detail:** `LiveTripView` renders a Leaflet map with pickup /
  destination pins and a moving Provider marker, plus a staleness readout
  ("Last updated Xs ago"). On completion it auto-transitions to a summary
  state.

## Consequences

- A trip cannot be completed without being started; the old "complete from any
  state" behaviour is gone. Existing tests were updated to reflect the
  requirement change.
- The live read path touches only the `rides` row; history writes are
  amortised to one snapshot per 30s per active trip.
- Polling keeps the feature shippable without new infrastructure; a later move
  to WebSockets/SSE would only replace the transport inside `LiveTripView` and
  the API's polling contract.
- Client and server intervals are independent: the server's 2s minimum is the
  hard floor, so a misbehaving client cannot flood the database.
- Full suite (309 tests) passes and `next build` succeeds.
