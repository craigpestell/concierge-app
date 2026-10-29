-- Michelle's public business line, set from /concierge/phone.
ALTER TABLE "ConciergeProfile" ADD COLUMN "businessPhone" TEXT;
ALTER TABLE "ConciergeProfile" ADD COLUMN "phoneProvider" TEXT;
