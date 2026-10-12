-- Job pages Google has been told about through its Indexing API, so each is
-- announced once and its removal is announced when the role closes. Not tied to
-- jobs by a foreign key: the row has to outlive the job it's about.
--
-- A few hundred rows a day (the API's daily quota); old ones are deleted.
CREATE TABLE index_pings (
  job_id       bigint PRIMARY KEY,
  notified_at  timestamptz NOT NULL DEFAULT now(),  -- URL_UPDATED sent
  removed_at   timestamptz                          -- URL_DELETED sent
);
CREATE INDEX index_pings_open ON index_pings (notified_at) WHERE removed_at IS NULL;
