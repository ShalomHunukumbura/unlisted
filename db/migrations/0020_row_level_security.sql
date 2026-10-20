-- Supabase publishes the public schema through its REST API (the "Data API")
-- to anyone with the project's anon key. Unlisted never uses that API, and it
-- should be switched off in the dashboard; this is the second lock. With row
-- level security on and no policies, those API roles see no rows. The app
-- connects as the tables' owner, which row level security doesn't apply to,
-- so nothing changes for it (or locally, or in CI).
--
-- Tables added later need the same line.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
