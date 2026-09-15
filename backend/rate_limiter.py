"""In-process sliding window rate limiter for public endpoints.

Enforces 30 requests / minute per client IP.
Safely extracts client IP behind reverse proxies (Traefik / Coolify / Cloudflare)
by prioritizing CF-Connecting-IP and taking the LAST element of X-Forwarded-For
to prevent spoofing.
"""
import time
from typing import Dict, List
from fastapi import HTTPException, Request, status


# Sliding window config
RATE_LIMIT_WINDOW_SECONDS = 60.0
RATE_LIMIT_MAX_REQUESTS = 30

_request_history: Dict[str, List[float]] = {}
_request_counter: int = 0


def _get_client_ip(request: Request) -> str:
    """Extract real client IP safely behind Cloudflare and Traefik."""
    cf_ip = request.headers.get("cf-connecting-ip")
    if cf_ip and cf_ip.strip():
        return cf_ip.strip()

    xff = request.headers.get("x-forwarded-for")
    if xff:
        # Traefik appends to X-Forwarded-For at the end.
        # The first element could be attacker-forged, so the last element
        # represents the hop trusted by the edge/proxy.
        parts = [p.strip() for p in xff.split(",") if p.strip()]
        if parts:
            return parts[-1]

    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"


def _purge_expired(now: float) -> None:
    """Remove expired entries to prevent memory leaks."""
    cutoff = now - RATE_LIMIT_WINDOW_SECONDS
    expired_keys = [
        ip for ip, timestamps in _request_history.items()
        if not timestamps or timestamps[-1] < cutoff
    ]
    for ip in expired_keys:
        _request_history.pop(ip, None)


async def public_rate_limiter(request: Request) -> None:
    """FastAPI dependency for rate limiting public endpoints."""
    global _request_counter
    now = time.time()
    _request_counter += 1

    # Periodically clean up stale records every 100 requests
    if _request_counter % 100 == 0:
        _purge_expired(now)

    client_ip = _get_client_ip(request)
    cutoff = now - RATE_LIMIT_WINDOW_SECONDS

    # Filter timestamps for this client IP within the sliding window
    history = [t for t in _request_history.get(client_ip, []) if t > cutoff]

    if len(history) >= RATE_LIMIT_MAX_REQUESTS:
        oldest = history[0]
        retry_after = max(1, int(RATE_LIMIT_WINDOW_SECONDS - (now - oldest)) + 1)
        _request_history[client_ip] = history
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too Many Requests",
            headers={"Retry-After": str(retry_after)},
        )

    history.append(now)
    _request_history[client_ip] = history


def reset_rate_limiter() -> None:
    """Reset limiter state (used in testing)."""
    global _request_counter
    _request_history.clear()
    _request_counter = 0
