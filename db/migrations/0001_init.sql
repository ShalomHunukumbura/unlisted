-- ATS job aggregator: core schema.
-- Jobs are never deleted; a job that stops appearing in a sync is marked closed.

CREATE TYPE ats_type AS ENUM (
  'greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workday',
  'workable', 'recruitee', 'bamboohr'
);

CREATE TABLE companies (
  id              bigserial PRIMARY KEY,
  name            text NOT NULL,
  ats             ats_type NOT NULL,
  board_token     text NOT NULL,
  -- escape hatch: workday {tenant,site,wd}, lever {region:'eu'}
  ats_config      jsonb NOT NULL DEFAULT '{}'::jsonb,
  careers_url     text,
  enabled         boolean NOT NULL DEFAULT true,

  -- provenance; lets an auto-discovery worker land later with no schema change
  source          text NOT NULL DEFAULT 'seed',   -- seed | admin_paste | discovery
  discovered_at   timestamptz,
  verified_at     timestamptz,

  last_synced_at  timestamptz,
  last_success_at timestamptz,
  consecutive_failures int NOT NULL DEFAULT 0,
  last_error      text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT companies_ats_token_uniq UNIQUE (ats, board_token)
);

CREATE INDEX companies_sync_queue_idx
  ON companies (last_synced_at NULLS FIRST) WHERE enabled;

CREATE TABLE jobs (
  id              bigserial PRIMARY KEY,
  company_id      bigint NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ats             ats_type NOT NULL,
  external_id     text NOT NULL,

  title           text NOT NULL,
  apply_url       text NOT NULL,
  department      text,
  team            text,
  employment_type text,

  location_raw    text,
  locations       text[] NOT NULL DEFAULT '{}',
  country         text,
  region          text,
  remote          boolean NOT NULL DEFAULT false,
  remote_scope    text,                   -- global | country | region | hybrid | null

  comp_min        numeric,
  comp_max        numeric,
  comp_currency   text,

  description_html text,                  -- nh3-sanitized before insert
  description_text text,

  posted_at       timestamptz,
  ats_updated_at  timestamptz,

  -- lifecycle
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_run   bigint,
  closed_at       timestamptz,            -- NULL = open

  raw             jsonb NOT NULL,
  content_hash    text NOT NULL,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT jobs_dedup_uniq UNIQUE (ats, company_id, external_id)
);

CREATE TABLE sync_runs (
  id            bigserial PRIMARY KEY,
  company_id    bigint REFERENCES companies(id) ON DELETE CASCADE,
  ats           ats_type,
  trigger       text NOT NULL,            -- schedule | manual | admin_add
  status        text NOT NULL,            -- running | ok | partial | error | suspicious
  started_at    timestamptz NOT NULL DEFAULT now(),
  finished_at   timestamptz,
  jobs_fetched  int NOT NULL DEFAULT 0,
  jobs_created  int NOT NULL DEFAULT 0,
  jobs_updated  int NOT NULL DEFAULT 0,
  jobs_closed   int NOT NULL DEFAULT 0,
  http_requests int NOT NULL DEFAULT 0,
  error         text,
  notes         jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX sync_runs_company_idx ON sync_runs (company_id, started_at DESC);

-- Bootstrap tool memory: never re-probe a candidate slug known to be dead.
CREATE TABLE slug_probes (
  ats        ats_type NOT NULL,
  candidate  text NOT NULL,
  status     int,
  job_count  int,
  probed_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ats, candidate)
);
