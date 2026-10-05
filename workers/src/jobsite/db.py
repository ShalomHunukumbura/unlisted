"""psycopg3 connection pool. Python owns every write to this database."""
from contextlib import contextmanager

from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row

from .config import settings

_pool: ConnectionPool | None = None


def pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(settings.database_url, min_size=1, max_size=8, open=True)
    return _pool


@contextmanager
def cursor(commit: bool = False):
    with pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            yield cur
        if commit:
            conn.commit()


def close_pool() -> None:
    """Close every connection. sync calls this before its long download phase, so
    a serverless database (Neon) can idle and suspend instead of being held awake."""
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None
