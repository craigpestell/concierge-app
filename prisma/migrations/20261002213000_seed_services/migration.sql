-- Starting list of services. Admins can add, rename or hide services later from /admin.
INSERT INTO "Service" ("id", "slug", "name", "sort", "active") VALUES
  (gen_random_uuid()::text, 'errands-shopping', 'Errands & shopping', 0, true),
  (gen_random_uuid()::text, 'rides', 'Rides & transportation', 1, true),
  (gen_random_uuid()::text, 'pets-plants', 'Pets & plants', 2, true),
  (gen_random_uuid()::text, 'home-checks', 'Home checks & waiting', 3, true),
  (gen_random_uuid()::text, 'moves-organizing', 'Moves & organizing', 4, true),
  (gen_random_uuid()::text, 'finding-sourcing', 'Finding & sourcing', 5, true),
  (gen_random_uuid()::text, 'visit-for-a-parent', 'Visits for a parent', 6, true)
ON CONFLICT ("slug") DO NOTHING;
