"""Pytest fixtures for Sutra backend tests."""

import shutil
import tempfile
from pathlib import Path
import pytest
from httpx import ASGITransport, AsyncClient

from apps.api.app.config import settings
from apps.api.app.main import app
from apps.api.app.store.json_store import JsonFileStore
import apps.api.app.store as store_module
import apps.api.app.adapters as adapters_module
from apps.api.app.adapters.gnani import GnaniAdapter
from apps.api.app.adapters.groq import GroqAdapter


@pytest.fixture
def temp_dir():
    d = tempfile.mkdtemp()
    yield Path(d)
    shutil.rmtree(d, ignore_errors=True)


@pytest.fixture(autouse=True)
def override_settings_and_store(temp_dir):
    data_dir = temp_dir / "data"
    tts_cache_dir = temp_dir / "tts-cache"
    data_dir.mkdir(parents=True, exist_ok=True)
    tts_cache_dir.mkdir(parents=True, exist_ok=True)

    # Override store
    test_store = JsonFileStore(data_dir)
    store_module._store_instance = test_store

    # Force mock mode for test deterministic execution
    test_gnani = GnaniAdapter(mode="mock", cache_dir=tts_cache_dir)
    test_groq = GroqAdapter(api_key="mock_key")
    adapters_module._gnani_instance = test_gnani
    adapters_module._groq_instance = test_groq

    yield

    store_module._store_instance = None
    adapters_module._gnani_instance = None
    adapters_module._groq_instance = None


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
