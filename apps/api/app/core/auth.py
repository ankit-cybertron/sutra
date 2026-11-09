import json
import time
from typing import Annotated, Any
from uuid import UUID

import httpx
import jwt
from fastapi import Depends, Header
from pydantic import BaseModel

from app.core.config import Settings, get_settings
from app.core.errors import AppException
from app.core.logging import get_logger

logger = get_logger("voxspec.auth")


class AuthenticatedUser(BaseModel):
    user_id: UUID
    email: str | None = None
    role: str = "authenticated"
    claims: dict[str, Any] = {}


class JWKSClient:
    def __init__(self, jwks_url: str) -> None:
        self.jwks_url = jwks_url
        self._keys: dict[str, Any] = {}
        self._cached_at: float = 0
        self._ttl_s: float = 300.0  # 5 minutes cache

    async def get_key(self, kid: str) -> Any:
        now = time.time()
        if not self._keys or (now - self._cached_at) > self._ttl_s:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(self.jwks_url)
                    if resp.status_code == 200:
                        jwks = resp.json()
                        self._keys = {k["kid"]: k for k in jwks.get("keys", [])}
                        self._cached_at = now
            except (httpx.HTTPError, json.JSONDecodeError) as e:
                logger.warning("Failed to refresh JWKS from %s: %s", self.jwks_url, str(e))

        if kid in self._keys:
            key_data = self._keys[kid]
            return jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key_data))
        return None


_jwks_client: JWKSClient | None = None


def get_jwks_client(settings: Settings) -> JWKSClient:
    global _jwks_client
    if _jwks_client is None or _jwks_client.jwks_url != settings.SUPABASE_JWKS_URL:
        _jwks_client = JWKSClient(settings.SUPABASE_JWKS_URL)
    return _jwks_client


async def verify_jwt(token: str, settings: Settings) -> AuthenticatedUser:
    try:
        unverified_headers = jwt.get_unverified_header(token)
        alg = unverified_headers.get("alg", "HS256")
        kid = unverified_headers.get("kid")

        payload: dict[str, Any]
        if alg.startswith("RS") and kid:
            jwks = get_jwks_client(settings)
            key = await jwks.get_key(kid)
            if not key:
                raise AppException(
                    code="UNAUTHENTICATED",
                    title="Authentication Failed",
                    status_code=401,
                    detail="Public key not found for token kid",
                )
            payload = jwt.decode(
                token,
                key,
                algorithms=[alg],
                audience=settings.SUPABASE_JWT_AUDIENCE,
                options={"verify_exp": True, "verify_aud": True},
            )
        else:
            # Fallback for HMAC / tests with secret
            # In test environments, SUPABASE_ANON_KEY or test secret is used
            secret = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                audience=settings.SUPABASE_JWT_AUDIENCE,
                options={"verify_exp": True, "verify_aud": True},
            )

        sub = payload.get("sub")
        if not sub:
            raise AppException(
                code="UNAUTHENTICATED",
                title="Authentication Failed",
                status_code=401,
                detail="Token missing sub claim",
            )

        return AuthenticatedUser(
            user_id=UUID(sub),
            email=payload.get("email"),
            role=payload.get("role", "authenticated"),
            claims=payload,
        )

    except jwt.ExpiredSignatureError:
        raise AppException(
            code="UNAUTHENTICATED",
            title="Authentication Failed",
            status_code=401,
            detail="Token has expired",
        ) from None
    except jwt.InvalidAudienceError:
        raise AppException(
            code="UNAUTHENTICATED",
            title="Authentication Failed",
            status_code=401,
            detail="Invalid token audience",
        ) from None
    except (jwt.PyJWTError, ValueError) as e:
        raise AppException(
            code="UNAUTHENTICATED",
            title="Authentication Failed",
            status_code=401,
            detail=f"Invalid token: {e!s}",
        ) from None


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    settings: Annotated[Settings, Depends(get_settings)] = None,  # type: ignore[assignment]
) -> AuthenticatedUser:
    if not authorization or not authorization.startswith("Bearer "):
        raise AppException(
            code="UNAUTHENTICATED",
            title="Authentication Failed",
            status_code=401,
            detail="Missing or malformed Authorization header",
        )

    token = authorization.removeprefix("Bearer ").strip()
    return await verify_jwt(token, settings)
