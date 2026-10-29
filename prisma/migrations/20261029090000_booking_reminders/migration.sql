-- When the client's reminder email went out. Existing bookings count as reminded, so the
-- first run after deploy doesn't send a burst for bookings already in the window.
ALTER TABLE "Booking" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
UPDATE "Booking" SET "reminderSentAt" = CURRENT_TIMESTAMP WHERE "start" < CURRENT_TIMESTAMP + INTERVAL '48 hours';
