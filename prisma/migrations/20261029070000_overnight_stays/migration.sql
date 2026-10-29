-- Overnight stays (house and pet sitting), behind the FEATURE_STAYS flag.
CREATE TYPE "BookingKind" AS ENUM ('VISIT', 'STAY');
ALTER TABLE "Booking" ADD COLUMN "kind" "BookingKind" NOT NULL DEFAULT 'VISIT';
ALTER TABLE "Booking" ADD COLUMN "nights" INTEGER;
ALTER TABLE "ConciergeProfile" ADD COLUMN "nightlyRateCents" INTEGER;
