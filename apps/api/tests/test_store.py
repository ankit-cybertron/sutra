"""Test JSON document store: atomic writes, asyncio locking, indexing, and CRUD."""

import asyncio
import pytest
from apps.api.app.store.json_store import JsonFileStore


@pytest.mark.asyncio
async def test_store_crud(temp_dir):
    store = JsonFileStore(temp_dir)
    collection = "test_items"

    doc = {"id": "item_1", "name": "Item One", "count": 10, "device_id": "dev_123"}
    saved = await store.put(collection, doc)
    assert saved["id"] == "item_1"
    assert saved["schema_version"] == 1

    fetched = await store.get(collection, "item_1")
    assert fetched is not None
    assert fetched["name"] == "Item One"

    # List & filter
    docs = await store.list(collection, filter_fn=lambda d: d.get("count") > 5)
    assert len(docs) == 1

    # Delete
    deleted = await store.delete(collection, "item_1")
    assert deleted is True

    # Confirm deleted
    assert await store.get(collection, "item_1") is None
    assert len(await store.list(collection)) == 0


@pytest.mark.asyncio
async def test_store_concurrency(temp_dir):
    store = JsonFileStore(temp_dir)
    collection = "counters"

    # Initial document
    await store.put(collection, {"id": "c1", "val": 0})

    async def increment_counter():
        for _ in range(10):
            current = await store.get(collection, "c1")
            updated = dict(current)
            updated["val"] += 1
            await store.put(collection, updated)
            await asyncio.sleep(0.001)

    # Run 5 concurrent tasks
    await asyncio.gather(*[increment_counter() for _ in range(5)])

    final_doc = await store.get(collection, "c1")
    assert final_doc["val"] == 50
