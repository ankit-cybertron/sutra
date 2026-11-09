"""FastAPI dependencies: Device ID extraction and per-device rate limiting."""

import time
from collections import defaultdict
from typing import Dict, List
from fastapi import Header, Request

from apps.api.app.config import settings
from apps.api.app.errors import ApiProblemError


# In-memory sliding window rate limiter: device_id -> list of timestamps
_rate_limit_records: Dict[str, List[float]] = defaultdict(list)


def get_device_id(x_device_id: str = Header(default="anonymous-device")) -> str:
    """Extracts X-Device-Id header from request."""
    device_id = x_device_id.strip()
    if not device_id:
        return "anonymous-device"
    return device_id


class RateLimiter:
    def __init__(self, max_requests: int = 30, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds

    async def __call__(self, request: Request, device_id: str = Header(default="anonymous-device")) -> None:
        now = time.time()
        window_start = now - self.window_seconds
        records = _rate_limit_records[device_id]

        # Prune old records
        _rate_limit_records[device_id] = [ts for ts in records if ts > window_start]

        if len(_rate_limit_records[device_id]) >= self.max_requests:
            raise ApiProblemError(
                status_code=429,
                code="RATE_LIMITED",
                title="Rate Limit Exceeded",
                detail=f"Too many requests for device. Max {self.max_requests} per {self.window_seconds}s.",
            )

        _rate_limit_records[device_id].append(now)


# Standard rate limiters
standard_rate_limiter = RateLimiter(max_requests=settings.rate_limit_per_minute, window_seconds=60)
plan_rate_limiter = RateLimiter(max_requests=10, window_seconds=60)
tts_rate_limiter = RateLimiter(max_requests=30, window_seconds=60)
