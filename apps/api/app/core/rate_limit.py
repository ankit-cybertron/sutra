"""In-memory sliding window rate limiter for per-user request limits."""
from __future__ import annotations

import time
from collections import defaultdict

_timestamps: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(key: str, max_requests: int, window_s: float = 60.0) -> bool:
    """
    Returns True if the request is within limit; False if rate limit is exceeded.
    Prunes timestamps older than window_s.
    """
    now = time.time()
    cutoff = now - window_s

    # Clean old timestamps
    _timestamps[key] = [t for t in _timestamps[key] if t > cutoff]

    if len(_timestamps[key]) >= max_requests:
        return False

    _timestamps[key].append(now)
    return True
