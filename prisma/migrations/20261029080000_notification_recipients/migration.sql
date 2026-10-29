-- Addresses that get the business's notification emails. Edited from /admin/notifications.
CREATE TABLE "NotificationRecipient" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "events" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRecipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationRecipient_email_key" ON "NotificationRecipient"("email");

-- Starting list: Michelle and Craig get everything. Change it any time from the admin page.
INSERT INTO "NotificationRecipient" ("id", "email", "events") VALUES
  (gen_random_uuid()::text, 'michellelouisekessler@gmail.com', ARRAY['booking', 'stay', 'cancelled', 'done', 'inbox']),
  (gen_random_uuid()::text, 'craigpestell+rcc@gmail.com', ARRAY['booking', 'stay', 'cancelled', 'done', 'inbox'])
ON CONFLICT ("email") DO NOTHING;
