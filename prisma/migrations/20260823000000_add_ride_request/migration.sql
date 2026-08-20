-- Create the ride request entity.
--
-- A RideRequest represents a Seeker asking to join a Ride (Ride Discovery Feed
-- & Ride Request module). Seats are NOT reserved when a request is created —
-- they are only decremented when the Provider accepts the request.
--
-- Access-control and business rules (one active request per seeker per ride,
-- seats never exceeding current availability, etc.) are enforced in the API
-- layer; the database guarantees referential integrity and indexes the
-- hot query paths.

CREATE TYPE "RideRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

CREATE TABLE "ride_requests" (
    "id" UUID NOT NULL,
    "ride_id" UUID NOT NULL,
    "seeker_id" UUID NOT NULL,
    "seats_requested" INTEGER NOT NULL,
    "status" "RideRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" VARCHAR(280),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ(6),

    CONSTRAINT "ride_requests_pkey" PRIMARY KEY ("id")
);

-- The ride_id / seeker_id combination is the natural key: a Seeker may only
-- have a limited set of requests on a given ride (enforced in the API by the
-- "one active request" rule), so the pair is indexed for those lookups.
CREATE INDEX "ride_requests_ride_id_idx" ON "ride_requests"("ride_id");
CREATE INDEX "ride_requests_seeker_id_idx" ON "ride_requests"("seeker_id");
CREATE INDEX "ride_requests_ride_id_seeker_id_status_idx" ON "ride_requests"("ride_id", "seeker_id", "status");

ALTER TABLE "ride_requests"
    ADD CONSTRAINT "ride_requests_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ride_requests"
    ADD CONSTRAINT "ride_requests_seeker_id_fkey" FOREIGN KEY ("seeker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
