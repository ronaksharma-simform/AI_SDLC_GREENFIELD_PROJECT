-- Create the ride chat (post-acceptance messaging) entities.
--
-- A Conversation is a private 1:1 chat created automatically when a ride request
-- is accepted (REQ-1). It always links exactly one Provider and one Seeker for
-- one ride. A Message belongs to exactly one conversation.
--
-- Access-control (only the two participants can read/write) and the "conversation
-- is created only on acceptance" rule (REQ-8) are enforced in the API layer; the
-- database guarantees referential integrity and the unique (ride, provider, seeker)
-- pairing.

CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'CLOSED');

CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "ride_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "seeker_id" UUID NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- One conversation per accepted ride/request pairing (Part A §3.3).
CREATE UNIQUE INDEX "conversations_ride_id_provider_id_seeker_id_key"
    ON "conversations"("ride_id", "provider_id", "seeker_id");
CREATE INDEX "conversations_provider_id_idx" ON "conversations"("provider_id");
CREATE INDEX "conversations_seeker_id_idx" ON "conversations"("seeker_id");

ALTER TABLE "conversations"
    ADD CONSTRAINT "conversations_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations"
    ADD CONSTRAINT "conversations_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations"
    ADD CONSTRAINT "conversations_seeker_id_fkey" FOREIGN KEY ("seeker_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "sent_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMPTZ(6),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "messages_conversation_id_sent_at_idx" ON "messages"("conversation_id", "sent_at");

ALTER TABLE "messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
