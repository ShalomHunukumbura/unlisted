# Unlisted

**Fresh roles straight from 7,700+ company career pages, in one search, including
the ones that never reach job boards.**

**Live: [unlisted-tau.vercel.app](https://unlisted-tau.vercel.app)**

Every company's careers page is
hosted by an applicant tracking system (Greenhouse, Ashby, Lever), and that's where
a role appears first. Some are cross-posted to LinkedIn and job boards later; many
never are, and you only find them if you already know the company. Unlisted reads
the career pages directly; it doesn't check whether a role is also on other sites. This pulls every one of those boards into a single
searchable list, keeps only the **past two weeks**, and links each job straight to
the employer's own apply page.

![Remote jobs open to Sri Lanka, posted in the past two weeks](docs/screenshot.png)

- **Where can I actually work from?** "Remote" often means "remote in the US".
  Each remote job is classified as open to anywhere, to a region (EU, APAC…) or to
  one country, and there's a filter for roles open from Sri Lanka.
- **Experience level** from what the description asks for ("3+ years"), falling
  back to the title.
- **Pay** where the posting states it: Ashby and Lever's pay fields, or the range
  written in the description ("$120,000 - $150,000 USD"), with a filter for it.
- **Each role once.** A company posting the same role for twelve cities shows up
  as one row, "+11 more locations", instead of twelve.
- **Follow a search** with RSS: every search and filter has a feed at `/feed?...`,
  so new matches arrive in a feed reader with no account.
- **Only what's still worth applying to.** Of 227,719 open jobs across all boards on
  the first full sync, 82% were posted over two weeks ago. Those are never stored.

It's a discovery layer, not an application proxy: no accounts, no tracking, and
every listing links to the real posting. Each job page checks live with the
employer's board that the role is still open, and shows when Unlisted first saw it
next to the employer's posted date.

(The code still calls itself `jobsite`: that's the CLI command and Python package.)

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
- `jobsite import-boards` takes board tokens you already have — either a plain
  token list or a `name,slug,url` CSV. Every token is validated, and anything
  that 404s or returns zero jobs is skipped, so a stale list is harmless.

`db/seed/boards/` vendors Greenhouse, Ashby and Lever lists (11,881 companies)
from [kalil0321/ats-scrapers](https://github.com/kalil0321/ats-scrapers) (MIT) —
see `db/seed/boards/SOURCE.md`. Sample validation found ~87% still live. The CSV
`name` column matters: Ashby's API returns no company name at all, so without it
the board token is the only available label.

Because a full sync of that many boards takes hours, `jobsite sync --limit N`
syncs in chunks, never-synced boards first, so the dataset grows while staying
usable throughout.

### Supported ATSs

| ATS | Public API | Descriptions | Status |
|---|---|---|---|
| Greenhouse | documented | via one `?content=true` board fetch | supported |
| Ashby | documented | inline | supported |
| Lever | documented | inline | supported |
| SmartRecruiters / Workday | public / undocumented | per-job fetch | not yet |
| Jobvite / iCIMS / Teamtailor | key- or partner-gated | — | not planned |

## Remote: open to where?

`remote = true` does not tell you whether you can apply. "Remote - Portugal" and
"Remote: United States" are remote *and* geographically restricted — useless if
you are not in those places. `open_to`
(`workers/src/jobsite/remote_scope.py`) answers the narrower question:

| value | meaning |
|---|---|
| `anywhere` | no geographic restriction stated |
| `region` | restricted to a multi-country region (EU, APAC, LATAM…) |
| `country` | restricted to a single country |
| `NULL` | not remote, or undetermined |

The classifier is **deliberately pessimistic**: a remote job naming any place we
recognize counts as restricted. The stakes are asymmetric — showing a job you
cannot apply to wastes real time, while hiding a vague one costs a little
recall. So `"Argentina - Fully Remote"` and `"Anywhere in Belgium"` are
`country`, not `anywhere`, despite the unrestricted-sounding wording.

The location dropdown exposes **Remote — anywhere** (strictly unrestricted) and
**Remote — open to Sri Lanka** (unrestricted + APAC-wide + India/Sri Lanka).
Every job row shows where it is open to, e.g. `remote · anywhere 🌍` or
`remote · PT`.

## Experience level

No ATS exposes a structured experience field, so it is inferred at ingestion
(`workers/src/jobsite/experience.py`) and stored as a `[min, max]` year range:

1. **Explicit years in the description** — `5+ years`, `3-5 years`, `4 years of
   experience`. Covers ~73% of jobs. Only the first 6000 characters are scanned,
   since requirements appear early and later text ("founded 10 years ago")
   produces false positives. Where several requirements are listed, the lowest
   is taken as the real entry bar.
2. **Seniority words in the title** — Intern/New Grad → 0-1, Junior → 0-2,
   Senior → 5+, Staff/Principal → 8+, Director/VP → 10+. Adds ~12%.
3. Otherwise unknown (~15%), filterable as "Not stated".

`exp_source` records which path was used; title-inferred levels are marked with
`*` in the list and "(inferred)" on the detail page.

**Bucket matching differs by kind.** Bounded buckets (`0-1`, `1-2`, `3-5`) match
by *overlap*, so filtering `3-5` surfaces a job wanting 2-6 years and an
open-ended `5+` one you would still qualify for. The open-ended `5+` bucket
instead requires `exp_min_years >= 5` — pure overlap would drag in a "1-8 years"
role, which is not a 5+ job.

## Pay

Stored as `comp_min`, `comp_max`, `comp_currency` and `comp_period` (year, month
or hour), base pay only:

1. **Ashby** lists pay as components, sometimes equity or bonus first; only a
   `Salary` component counts. **Lever** has an optional `salaryRange`.
2. **Everything else** is read from the description (`workers/src/jobsite/pay.py`).
   About half of Greenhouse postings state a range, mostly because of US pay
   transparency laws. A wrong figure is worse than none, so a range needs a
   currency and both ends plausible for its period; a lone figure only counts
   right after "salary", "base pay" and the like; OTE and "+ $X variable" are
   skipped. A bare `$` follows the job's country (CAD in Canada, AUD in
   Australia).

The pay filter's `$100K+` tiers mean the top of the range reaches the figure,
in US dollars a year; other currencies aren't converted.

Pay read from the text is left out of the job's change fingerprint: it adds
nothing the description doesn't already cover, and leaving it in would make
the next sync rewrite every job with pay at once, more than the 512 MB database
has room for. `jobsite backfill-pay` fills it in for jobs stored earlier, in
batches with a `VACUUM` after each.

## Design decisions worth knowing

**Only the past two weeks.** By two weeks most roles have hundreds of applicants,
so older ones are noise. Sync skips jobs posted more than `MAX_JOB_AGE_DAYS`
(default 14) ago, and every sync ends with a prune that deletes jobs that have
aged out since. Age is `posted_at`, or `first_seen_at` when the ATS gives no
date. This also keeps the database small (1.16 GB for every open job vs. a
fraction of that for two weeks), and the web app applies the same window so
pages are right between syncs.

**Closed, not deleted, within the window.** A job missing from a sync is stamped
`closed_at`; if it reappears, the upsert reopens it.

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

## Public deployment

The public copy runs on free tiers, with the same schema and sync code as local:

```
GitHub Actions (hourly) ──sync──> Neon Postgres (free, 512 MB) <──reads── Vercel (Next.js, read-only)
```

- **Database:** Neon's free tier caps a project at 512 MB. Two weeks of every board
  is about 380 MB once raw ATS payloads are left out (`STORE_RAW=false`), description
  words are indexed without positions, and sync logs are kept for 6 hours; see
  migrations 0006 and 0008 for what was cut and measured. A schema change that
  rewrites the jobs table needs `db/deploy/reset-jobs.sql` first (it refills on the
  next sync).
- **Sync:** `.github/workflows/sync.yml` runs every hour (at :23, sometimes a little
  late: GitHub schedules are best-effort). `jobsite sync --due` checks boards with open
  jobs every run and quiet boards every ~6 hours, about 5,200 of 7,733 per run. It
  downloads everything with no database connection open (~15-20 min, set by the
  per-ATS rate limits), then writes in one burst of under a minute, so Neon is awake
  for minutes per run and the free compute allowance holds. Secret: `DATABASE_URL`.
  GitHub pauses scheduled workflows after 60 days without a commit, so it needs
  re-enabling after a quiet spell.
- **Site:** Vercel, root directory `web`, with `DATABASE_URL` and
  `JOBSITE_READ_ONLY=1`. Read-only mode returns 404 for the admin page and its API,
  which run the CLI on the server and have no auth.
- **Companies** are managed locally. `make push-companies DEPLOY_URL=...` copies new
  ones to the deployed database (existing ones are left alone).

```bash
make deploy-migrate DEPLOY_URL="postgresql://..."    # once, then the workflow keeps it current
make push-companies DEPLOY_URL="postgresql://..."
```

## Commands

```bash
jobsite discover --seeds ../db/seed/companies.txt
jobsite add-url https://jobs.ashbyhq.com/linear     # or just: jobsite add-url Linear
jobsite import-boards db/seed/ashby_boards.txt --ats ashby
jobsite sync [--company X] [--stale-hours 6]      # skips and prunes jobs older than 14 days
jobsite prune                                      # just the prune
jobsite backfill-pay                               # one-off: pay for jobs stored before pay.py
jobsite stats
python -m jobsite.scheduler                          # sync every 6h
```

## Tests

```bash
make test    # 127 tests (connector fixtures under workers/tests/fixtures; the age
             # test uses the dev database and is skipped when it's not running)
```

Covers location normalization, HTML sanitization, connector normalization,
experience inference, and URL parsing — the parts where real-world data is messy
enough to break things.

## Being a good citizen

These are public, documented, unauthenticated job-board APIs, serving data
companies are paying to broadcast, and every listing links back to the employer's
own apply page. The client sends a contactable User-Agent, rate-limits per ATS
(5 req/s), honors `Retry-After`, backs off on 429, and syncs every 6 hours locally
and hourly for the public copy (quiet boards every ~6 hours), rather than constantly. Undocumented endpoints (Workday et al.) are deliberately
deprioritized and would get a lower limit.
