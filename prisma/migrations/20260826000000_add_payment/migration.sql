-- Create the Payment & Cost-Splitting module entities.
--
-- The Provider optionally declares a total trip cost (Ride.total_cost) and the
-- module splits it evenly across everyone in the vehicle. Money never moves on
-- platform — this module only computes the split and records the Provider's
-- manual settlement confirmation.
--
-- Ride gains:
--   - total_cost         the declared trip cost, stored in the smallest
--                        currency unit (paise) so the equal-split rounding rule
--                        (round each share UP so the sum never falls short of
--                        totalCost) works in integer arithmetic;
--   - cost_finalized_at  set when the ride completes and each accepted Seeker's
--                        share is frozen; while null, total_cost stays editable.
--
-- RideRequest gains:
--   - share_amount   the Seeker's frozen share of total_cost, written only at
--                    completion (never accepted as client input);
--   - payment_status whether the Provider has confirmed receiving this share
--                    off-platform (default UNPAID);
--   - paid_at        when the Provider marked the share Paid.
--
-- Settlement state rides on the existing ride_requests record — no new entity is
-- introduced (mirrors how the Notifications module added reminder_sent_at to
-- rides rather than a separate table).

CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID');

-- Cost declaration and settlement-freeze flags on the ride.
ALTER TABLE "rides"
    ADD COLUMN "total_cost" DECIMAL(12, 2),
    ADD COLUMN "cost_finalized_at" TIMESTAMPTZ(6);

-- Frozen share + Provider-confirmed settlement state on each ride request.
ALTER TABLE "ride_requests"
    ADD COLUMN "share_amount" DECIMAL(12, 2),
    ADD COLUMN "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    ADD COLUMN "paid_at" TIMESTAMPTZ(6);

-- The completion snapshot writes shares for every currently-Accepted request on
-- a ride; the Provider's settlement summary reads them back by ride. Both are
-- served by the existing ride_id index.
