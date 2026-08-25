-- Create the Notifications module entities.
--
-- A Notification is created internally by the Notifications module when one of
-- the triggers in Part B §11 fires:
--   1. a new ride request is received (notifies the Provider),
--   2. a ride request is accepted (notifies the Seeker),
--   3. a ride's departure approaches (TripReminder, notifies Provider + Seekers).
--
-- The Ride entity gains `reminder_sent_at`, a deduplication flag that guarantees
-- a ride's trip reminder is generated exactly once even if the scheduled
-- reminder job runs repeatedly (NOTIF-4). Referential integrity is enforced by
-- foreign keys; per-recipient access control is enforced in the API layer
-- (Section 15 — Security).

CREATE TYPE "NotificationType" AS ENUM (
    'RideRequestReceived',
    'RideRequestAccepted',
    'RideRequestRejected',
    'TripReminder',
    'NewMessage'
);

CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "message" VARCHAR(280) NOT NULL,
    "related_ride_id" UUID,
    "related_request_id" UUID,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- The bell badge queries unread notifications per user; the dropdown orders the
-- user's notifications by recency. Both get an index.
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");
CREATE INDEX "notifications_related_ride_id_idx" ON "notifications"("related_ride_id");
CREATE INDEX "notifications_related_request_id_idx" ON "notifications"("related_request_id");

ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_related_ride_id_fkey" FOREIGN KEY ("related_ride_id") REFERENCES "rides"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications"
    ADD CONSTRAINT "notifications_related_request_id_fkey" FOREIGN KEY ("related_request_id") REFERENCES "ride_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Deduplication flag for the scheduled TripReminder job (NOTIF-4).
ALTER TABLE "rides" ADD COLUMN "reminder_sent_at" TIMESTAMPTZ(6);
