-- Replace the plain-text source/destination columns with structured locations.
--
-- The existing text columns are renamed to be the human-readable "address" of
-- each location so previously published rides keep their labels. Four nullable
-- coordinate columns are added for the selected points. Coordinates are nullable
-- at the database layer so pre-location rides remain readable; the API layer
-- requires coordinates (and an address) for all new and edited rides.

ALTER TABLE "rides" RENAME COLUMN "source" TO "source_address";
ALTER TABLE "rides" RENAME COLUMN "destination" TO "destination_address";

ALTER TABLE "rides"
    ADD COLUMN "source_latitude" DECIMAL(9, 6),
    ADD COLUMN "source_longitude" DECIMAL(9, 6),
    ADD COLUMN "destination_latitude" DECIMAL(9, 6),
    ADD COLUMN "destination_longitude" DECIMAL(9, 6);
