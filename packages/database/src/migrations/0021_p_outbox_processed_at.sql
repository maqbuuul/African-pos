ALTER TABLE "events" ADD COLUMN "processed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "events_unprocessed_idx" ON "events" USING btree ("processed_at");