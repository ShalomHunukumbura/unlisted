"""Long-running scheduler. Calls exactly the same functions as the CLI.

Job boards do not change by the minute, so syncing every 6 hours is both
sufficient and the polite thing to do.
"""
from __future__ import annotations

import logging

from apscheduler.schedulers.blocking import BlockingScheduler

from . import sync

log = logging.getLogger(__name__)

SYNC_INTERVAL_HOURS = 6


def listings_sync() -> None:
    results = sync.sync_all(stale_hours=SYNC_INTERVAL_HOURS, trigger="schedule")
    ok = sum(r["status"] == "ok" for r in results)
    log.info("scheduled sync: %s/%s ok", ok, len(results))


def main() -> None:
    logging.basicConfig(level=logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)

    sched = BlockingScheduler(timezone="UTC")
    sched.add_job(
        listings_sync,
        "interval",
        hours=1,               # wake hourly, but only sync boards older than 6h
        id="listings",
        # A sleeping laptop must not trigger a thundering herd on wake.
        coalesce=True,
        max_instances=1,
        misfire_grace_time=3600,
    )
    log.info("scheduler started; syncing boards older than %sh", SYNC_INTERVAL_HOURS)
    listings_sync()            # run once at boot
    sched.start()


if __name__ == "__main__":
    main()
