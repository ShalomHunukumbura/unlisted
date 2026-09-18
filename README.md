# job-site

Pulls jobs from company ATS boards (Greenhouse, Ashby, Lever) into one searchable
place. Every listing deep-links to the real ATS apply page — this is a discovery
and search layer, not an application proxy.

Built because ATS-hosted jobs are effectively invisible unless you already know
the company exists and visit its board directly.

## Quick start

```bash
make up          # start postgres (host port 5433)
make migrate     # apply db/migrations/*.sql
make install     # python venv + web deps
make discover    # probe db/seed/companies.txt -> companies table
make sync        # fetch every board, upsert jobs
make web         # http://localhost:3000
```

## How it works

```
db/seed/companies.txt ──probe──> companies ──sync──> jobs ──> Next.js
   (plain names)                 (ats+token)        (Postgres)
```

**Ingestion** is Python (`workers/`). Connectors turn each ATS payload into one
shared `NormalizedJob` shape and never touch the database; `sync.py` owns all
writes. **The web app** (`web/`) is Next.js reading Postgres directly from server
components — no API layer in between. The only contract is the schema.

### Finding companies

No ATS lets you enumerate its customers, and no public company→token dataset
exists, so this is the hard part. Two paths:

- `jobsite discover` takes **plain company names**, generates slug variants, and
  asks each ATS. It works because Greenhouse/Ashby/Lever return a clean 404 for
  unknown tokens. Boards with zero jobs are rejected — stale empty shells are
  common (Vercel has an empty Ashby board beside its real Greenhouse one), so the
  highest job count wins.
- `jobsite add-url` (and the admin page) takes a careers URL for the long tail,
  where the slug isn't the company name.

Measured: 41 of 41 seed names resolved automatically.

### Supported ATSs

| ATS | Public API | Descriptions | Status |
|---|---|---|---|
| Greenhouse | documented | via one `?content=true` board fetch | supported |
| Ashby | documented | inline | supported |
| Lever | documented | inline | supported |
| SmartRecruiters / Workday | public / undocumented | per-job fetch | not yet |
| Jobvite / iCIMS / Teamtailor | key- or partner-gated | — | not planned |

## Design decisions worth knowing

**Jobs are never deleted.** A job missing from a sync is stamped `closed_at`; if
it reappears, the upsert reopens it. History stays intact.

**The empty-board guard.** If a board returns zero jobs while we hold more than
five open ones, the run is marked `suspicious` and closes nothing. Without this,
one bad upstream response would silently wipe a company's entire board.

**`left(description_text, 200000)` in the search column is required**, not
defensive padding. `tsvector` caps at ~1MB and the column is `GENERATED ALWAYS`,
so one oversized description would fail the whole insert.

**`array_to_string` can't be used in that generated column** — it is only
`STABLE`, not `IMMUTABLE`, and Postgres rejects it. `location_raw` feeds the
search vector instead; `locations[]` filtering goes through a GIN index.

**nh3, not bleach.** bleach is marked inactive on PyPI and ships no further
security fixes. Sanitizing untrusted third-party HTML is a security boundary.

**Ashby sets `isRemote: true` on hybrid roles**, so `workplaceType` is treated as
the authority — otherwise hybrid jobs pollute the remote filter.

**Keyset pagination, not OFFSET.** Verified to run as an Index Only Scan on the
partial index.

## Commands

```bash
jobsite discover --seeds ../db/seed/companies.txt
jobsite add-url https://jobs.ashbyhq.com/linear     # or just: jobsite add-url Linear
jobsite sync [--company X] [--stale-hours 6]
jobsite stats
python -m jobsite.scheduler                          # sync every 6h
```

## Tests

```bash
make test    # 48 tests, offline (connector fixtures under workers/tests/fixtures)
```

Covers location normalization, HTML sanitization, connector normalization, and
URL parsing — the parts where real-world data is messy enough to break things.

## Being a good citizen

These are public, documented, unauthenticated job-board APIs, serving data
companies are paying to broadcast, and every listing links back to the employer's
own apply page. The client sends a contactable User-Agent, rate-limits per ATS
(5 req/s), honors `Retry-After`, backs off on 429, and syncs every 6 hours rather
than constantly. Undocumented endpoints (Workday et al.) are deliberately
deprioritized and would get a lower limit.
