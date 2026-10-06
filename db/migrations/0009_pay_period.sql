-- Pay ranges: comp_min/comp_max/comp_currency existed from 0001 but only Ashby
-- filled them, sometimes with equity or bonus figures. Now they hold base pay
-- only (Ashby/Lever fields, or the range stated in the description), and
-- comp_period says what the numbers are per: year | month | hour.
--
-- Nullable with no default: adding it rewrites nothing.
ALTER TABLE jobs ADD COLUMN comp_period text
  CONSTRAINT jobs_comp_period_chk CHECK (comp_period IN ('year', 'month', 'hour'));

-- The list shows each role once (same company + title, e.g. one posting per
-- city): web/src/lib/queries.ts looks up a posting's siblings by this. ~2 MB.
CREATE INDEX IF NOT EXISTS jobs_role_idx ON jobs (company_id, lower(title)) WHERE closed_at IS NULL;
