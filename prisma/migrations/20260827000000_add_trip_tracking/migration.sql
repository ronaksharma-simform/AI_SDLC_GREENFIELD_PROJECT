-- Trip Start & Live Location Tracking (Sections 4.1 / 4.2 / 10).
--
-- Adds the "In Progress" ride lifecycle stage between Full and Completed, the
-- Provider's single current-position fields on the Ride entity (the live map
-- reads these), and a separate location-history table for periodic snapshots
-- (dispute resolution / safety review — never the live source).

-- 1. RideStatus gains the InProgress state.
ALTER TYPE "RideStatus" ADD VALUE 'IN_PROGRESS';

-- 2. NotificationType gains the trip lifecycle events.
ALTER TYPE "NotificationType" ADD VALUE 'TripStarted';
ALTER TYPE "NotificationType" ADD VALUE 'TripCompleted';

-- 3. Live tracking fields on the ride. Coordinates are DECIMAL(9,6) to match the
--    existing source/destination coordinate columns.
ALTER TABLE "rides"
    ADD COLUMN "current_latitude" DECIMAL(9, 6),
    ADD COLUMN "current_longitude" DECIMAL(9, 6),
    ADD COLUMN "location_updated_at" TIMESTAMPTZ(6),
    ADD COLUMN "started_at" TIMESTAMPTZ(6),
    ADD COLUMN "completed_at" TIMESTAMPTZ(6);

-- 4. Periodic location-history table. Snapshots are written at a lower frequency
--    than the live current-position fields (Section 10.2).
CREATE TABLE "ride_location_snapshots" (
    "id" UUID NOT NULL,
    "ride_id" UUID NOT NULL,
    "latitude" DECIMAL(9, 6) NOT NULL,
    "longitude" DECIMAL(9, 6) NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ride_location_snapshots_pkey" PRIMARY KEY ("id")
);

-- History is read back per ride after a trip (dispute resolution / safety
-- review), ordered by capture time.
CREATE INDEX "ride_location_snapshots_ride_id_recorded_at_idx"
    ON "ride_location_snapshots" ("ride_id", "recorded_at");

ALTER TABLE "ride_location_snapshots"
    ADD CONSTRAINT "ride_location_snapshots_ride_id_fkey"
    FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;
