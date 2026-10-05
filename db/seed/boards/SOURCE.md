# Board lists

`greenhouse.csv`, `ashby.csv`, `lever.csv` are `name,slug,url` lists of company
job boards, vendored from **[kalil0321/ats-scrapers](https://github.com/kalil0321/ats-scrapers)**
(MIT licensed, © 2026 Kalil Bouzigues; license text in `LICENSE-ats-scrapers`),
retrieved 2026-09-18.

That project maintains company→ATS-token lists for ~47 providers. Only the three
we have connectors for are vendored here. The `name` column matters: Ashby's API
returns no company name at all, so without it a board token is the only label
available.

Lists go stale — companies close boards or move ATS. `jobsite import-boards`
validates every token and skips anything that 404s or returns zero jobs, so a
stale entry is harmless.

```bash
jobsite import-boards db/seed/boards/ashby.csv --ats ashby
```

`ashby_boards.txt` (one token per line) came from a separate shared spreadsheet
and is kept as an example of the plain-token format.
