import time
import uuid
from typing import Annotated

import jwt
import pytest
from fastapi import APIRouter, Depends
from httpx import ASGITransport, AsyncClient

from app.core.auth import AuthenticatedUser, get_current_user, verify_jwt
from app.core.config import Settings
from app.main import create_app

TEST_SECRET = "test-secret-key-32-characters-long!!"


@pytest.fixture
def auth_settings():
    return Settings(
        SUPABASE_JWT_AUDIENCE="authenticated",
        SUPABASE_ANON_KEY=TEST_SECRET,
        SUPABASE_SERVICE_ROLE_KEY=TEST_SECRET,
    )


def create_token(
    user_id: uuid.UUID,
    secret: str = TEST_SECRET,
    aud: str = "authenticated",
    exp_delta: int = 3600,
    email: str = "user@example.com",
    sub: str | None = None,
) -> str:
    now = int(time.time())
    payload = {
        "sub": sub if sub is not None else str(user_id),
        "email": email,
        "aud": aud,
        "role": "authenticated",
        "iat": now,
        "exp": now + exp_delta,
    }
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.mark.asyncio
async def test_verify_jwt_success(auth_settings):
    user_id = uuid.uuid4()
    token = create_token(user_id)
    user = await verify_jwt(token, auth_settings)
    assert user.user_id == user_id
    assert user.email == "user@example.com"
    assert user.role == "authenticated"


@pytest.mark.asyncio
async def test_verify_jwt_expired(auth_settings):
    user_id = uuid.uuid4()
    token = create_token(user_id, exp_delta=-100)
    with pytest.raises(Exception) as exc_info:
        await verify_jwt(token, auth_settings)
    assert exc_info.value.code == "UNAUTHENTICATED"
    assert "expired" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_verify_jwt_invalid_audience(auth_settings):
    user_id = uuid.uuid4()
    token = create_token(user_id, aud="wrong-audience")
    with pytest.raises(Exception) as exc_info:
        await verify_jwt(token, auth_settings)
    assert exc_info.value.code == "UNAUTHENTICATED"
    assert "audience" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_verify_jwt_missing_sub(auth_settings):
    now = int(time.time())
    payload = {
        "email": "test@example.com",
        "aud": "authenticated",
        "exp": now + 3600,
    }
    token = jwt.encode(payload, TEST_SECRET, algorithm="HS256")
    with pytest.raises(Exception) as exc_info:
        await verify_jwt(token, auth_settings)
    assert exc_info.value.code == "UNAUTHENTICATED"
    assert "sub" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_protected_route_with_dependency(auth_settings):
    app = create_app(auth_settings)
    router = APIRouter()

    @router.get("/me")
    async def me(current_user: Annotated[AuthenticatedUser, Depends(get_current_user)]):
        return {"user_id": str(current_user.user_id), "email": current_user.email}

    app.include_router(router)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Request with no Authorization header -> 401
        res = await client.get("/me")
        assert res.status_code == 401
        assert res.json()["code"] == "UNAUTHENTICATED"

        # Request with valid token -> 200
        uid = uuid.uuid4()
        token = create_token(uid)
        res = await client.get("/me", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        assert res.json() == {"user_id": str(uid), "email": "user@example.com"}
