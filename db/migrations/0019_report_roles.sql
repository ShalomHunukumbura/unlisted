-- The weekly report's roles, kept for the whole week. Jobs are deleted three
-- days after they're posted, so by the end of a week most of its roles are
-- gone from `jobs`; `jobsite sync` copies each new role here while it's still
-- there, and the report and the blog drafts are worked out from these rows.
--
-- One row per role (company + title) per ISO week (Monday, UTC), the first
-- posting seen. `skills` holds the report's skills the posting mentions,
-- worked out while its description is still stored. ~300 bytes a role with
-- its index, about 5 MB a week; weeks older than three are deleted.
CREATE TABLE report_roles (
  week           date NOT NULL,
  company_id     bigint NOT NULL,
  title_key      text NOT NULL,              -- lower(title)
  job_id         bigint NOT NULL,            -- not a foreign key: the job is deleted first
  title          text NOT NULL,
  location_raw   text,
  remote         boolean NOT NULL,
  open_to        text,
  region         text,
  country        text,
  comp_min       numeric,
  comp_max       numeric,
  comp_currency  text,
  comp_period    text,
  at             timestamptz NOT NULL,       -- COALESCE(posted_at, first_seen_at)
  skills         text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (week, company_id, title_key)
);
