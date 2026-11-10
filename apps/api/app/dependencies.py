"""FastAPI dependencies: IP extraction, rate limiting, and device scoping."""

import time
from collections import defaultdict
from typing import Dict, List, Optional
from fastapi import Header, Request

from apps.api.app.errors import ApiProblemError

# Storage for IP rate limiting: (ip, scope) -> list of timestamps
_minute_buckets: Dict[str, List[float]] = defaultdict(list)
_daily_buckets: Dict[str, List[float]] = defaultdict(list)

# Block tracking: ip -> list of block timestamps
_blocked_attempts: Dict[str, List[float]] = defaultdict(list)
_banned_until: Dict[str, float] = {}


def get_client_ip(request: Request) -> str:
    """Extracts client IP from X-Forwarded-For or socket host."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # First IP in the comma-separated chain is the client IP
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


def get_device_id(x_device_id: Optional[str] = Header(default=None)) -> str:
    """Extracts anonymous X-Device-Id header used for data scoping."""
    if x_device_id and x_device_id.strip():
        return x_device_id.strip()
    return "anonymous-device"


def record_blocked_attempt(ip: str) -> None:
    """Records an INPUT_BLOCKED violation. 5 in 10 minutes triggers a 15-min ban."""
    now = time.time()
    cutoff = now - 600  # 10 minutes
    _blocked_attempts[ip] = [ts for ts in _blocked_attempts[ip] if ts > cutoff]
    _blocked_attempts[ip].append(now)
    if len(_blocked_attempts[ip]) >= 5:
        _banned_until[ip] = now + 900  # 15 minutes ban


class RateLimiter:
    """Token-bucket style rate limiter keyed by client IP."""

    def __init__(self, scope: str, limit_per_min: int, limit_per_day: Optional[int] = None):
        self.scope = scope
        self.limit_per_min = limit_per_min
        self.limit_per_day = limit_per_day

    async def __call__(self, request: Request) -> None:
        ip = get_client_ip(request)
        now = time.time()

        # Check if IP is banned from repeated injection blocks
        if ip in _banned_until:
            ban_remaining = int(_banned_until[ip] - now)
            if ban_remaining > 0:
                raise ApiProblemError(
                    status_code=429,
                    code="RATE_LIMITED",
                    title="Rate Limited",
                    detail="Too many suspicious requests. Please try again later.",
                    retry_after=ban_remaining,
                )
            else:
                del _banned_until[ip]

        # 1. Minute bucket
        key_min = f"{ip}:{self.scope}:min"
        min_start = now - 60.0
        records_min = [ts for ts in _minute_buckets[key_min] if ts > min_start]
        _minute_buckets[key_min] = records_min

        if len(records_min) >= self.limit_per_min:
            oldest = records_min[0]
            retry_after = max(1, int(60.0 - (now - oldest)))
            raise ApiProblemError(
                status_code=429,
                code="RATE_LIMITED",
                title="Rate Limit Exceeded",
                detail=f"Too many requests. Limit is {self.limit_per_min} per minute.",
                retry_after=retry_after,
            )

        # 2. Daily bucket
        if self.limit_per_day:
            key_day = f"{ip}:{self.scope}:day"
            day_start = now - 86400.0
            records_day = [ts for ts in _daily_buckets[key_day] if ts > day_start]
            _daily_buckets[key_day] = records_day

            if len(records_day) >= self.limit_per_day:
                oldest = records_day[0]
                retry_after = max(1, int(86400.0 - (now - oldest)))
                raise ApiProblemError(
                    status_code=429,
                    code="RATE_LIMITED",
                    title="Daily Limit Exceeded",
                    detail=f"Daily limit of {self.limit_per_day} requests reached.",
                    retry_after=retry_after,
                )
            _daily_buckets[key_day].append(now)

        _minute_buckets[key_min].append(now)


# Standard scope rate limiters defined by API_CONTRACT.md
sessions_rate_limiter = RateLimiter(scope="sessions", limit_per_min=6, limit_per_day=40)
standard_rate_limiter = sessions_rate_limiter  # alias
plan_rate_limiter = RateLimiter(scope="plan", limit_per_min=6, limit_per_day=40)
chat_rate_limiter = RateLimiter(scope="chat", limit_per_min=20, limit_per_day=200)
tts_rate_limiter = RateLimiter(scope="tts", limit_per_min=30, limit_per_day=None)
