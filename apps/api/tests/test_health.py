import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.core.errors import AppException
from app.main import create_app


@pytest.fixture
def app():
    settings = Settings(API_ENV="development", API_LOG_LEVEL="DEBUG")
    return create_app(settings)


@pytest.mark.asyncio
async def test_healthz(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/healthz")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
        assert "X-Request-ID" in response.headers


@pytest.mark.asyncio
async def test_readyz(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/readyz")
        assert response.status_code == 200
        assert response.json() == {"status": "ready"}


@pytest.mark.asyncio
async def test_request_id_preserved(app):
    custom_id = "test-custom-request-id-12345"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/healthz", headers={"X-Request-ID": custom_id})
        assert response.status_code == 200
        assert response.headers["X-Request-ID"] == custom_id


@pytest.mark.asyncio
async def test_rfc7807_error_format(app):
    # Register a temporary route to test custom AppException
    @app.get("/test-error")
    async def trigger_error():
        raise AppException(
            code="PIPELINE_EXTRACT_FAILED",
            title="Extraction Failed",
            status_code=502,
            detail="Failed to parse claims from provider.",
        )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/test-error")
        assert response.status_code == 502
        assert response.headers["content-type"] == "application/problem+json"
        body = response.json()
        assert body["code"] == "PIPELINE_EXTRACT_FAILED"
        assert body["status"] == 502
        assert body["title"] == "Extraction Failed"
        assert body["detail"] == "Failed to parse claims from provider."
        assert "request_id" in body
