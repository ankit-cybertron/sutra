"""JSON File implementation of DocStore with atomic writes and asyncio locks."""

import asyncio
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional
from apps.api.app.store.base import DocStore


class JsonFileStore(DocStore):
    def __init__(self, base_dir: Path):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        # In-memory document lock map: (collection, doc_id) -> asyncio.Lock
        self._locks: Dict[str, asyncio.Lock] = {}
        self._global_lock = asyncio.Lock()
        # In-memory index: collection -> list of doc metadata/summaries
        self._index: Dict[str, Dict[str, Dict[str, Any]]] = {}
        self._load_indexes()

    def _get_collection_dir(self, collection: str) -> Path:
        dir_path = self.base_dir / collection
        dir_path.mkdir(parents=True, exist_ok=True)
        return dir_path

    def _get_doc_lock(self, collection: str, doc_id: str) -> asyncio.Lock:
        key = f"{collection}:{doc_id}"
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()
        return self._locks[key]

    def _load_indexes(self) -> None:
        """Scan directory structure to populate in-memory indexes."""
        if not self.base_dir.exists():
            return
        for col_dir in self.base_dir.iterdir():
            if col_dir.is_dir() and not col_dir.name.startswith("."):
                col_name = col_dir.name
                self._index[col_name] = {}
                for doc_file in col_dir.glob("*.json"):
                    try:
                        with open(doc_file, "r", encoding="utf-8") as f:
                            doc = json.load(f)
                            if "id" in doc:
                                self._index[col_name][doc["id"]] = doc
                    except Exception:
                        pass

    async def get(self, collection: str, doc_id: str) -> Optional[Dict[str, Any]]:
        lock = self._get_doc_lock(collection, doc_id)
        async with lock:
            doc_file = self._get_collection_dir(collection) / f"{doc_id}.json"
            if not doc_file.exists():
                return None
            try:
                with open(doc_file, "r", encoding="utf-8") as f:
                    doc = json.load(f)
                    return doc
            except Exception:
                return None

    async def put(self, collection: str, doc: Dict[str, Any]) -> Dict[str, Any]:
        doc_id = doc.get("id")
        if not doc_id:
            raise ValueError("Document must contain an 'id' field")

        if "schema_version" not in doc:
            doc["schema_version"] = 1

        lock = self._get_doc_lock(collection, doc_id)
        async with lock:
            col_dir = self._get_collection_dir(collection)
            final_path = col_dir / f"{doc_id}.json"

            # Atomic write: write to temp file in same directory, then rename
            temp_fd, temp_path = tempfile.mkstemp(
                dir=col_dir, prefix=f"{doc_id}_", suffix=".tmp"
            )
            with os.fdopen(temp_fd, "w", encoding="utf-8") as f:
                json.dump(doc, f, indent=2, ensure_ascii=False)

            os.replace(temp_path, final_path)

            # Update in-memory index
            async with self._global_lock:
                if collection not in self._index:
                    self._index[collection] = {}
                self._index[collection][doc_id] = doc

            return doc

    async def delete(self, collection: str, doc_id: str) -> bool:
        lock = self._get_doc_lock(collection, doc_id)
        async with lock:
            doc_file = self._get_collection_dir(collection) / f"{doc_id}.json"
            deleted = False
            if doc_file.exists():
                try:
                    os.remove(doc_file)
                    deleted = True
                except OSError:
                    deleted = False

            async with self._global_lock:
                if collection in self._index and doc_id in self._index[collection]:
                    del self._index[collection][doc_id]

            return deleted

    async def list(
        self,
        collection: str,
        filter_fn: Optional[Callable[[Dict[str, Any]], bool]] = None,
        sort_key: Optional[str] = None,
        reverse: bool = False,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        async with self._global_lock:
            col_docs = list(self._index.get(collection, {}).values())

        if filter_fn:
            col_docs = [doc for doc in col_docs if filter_fn(doc)]

        if sort_key:
            col_docs = sorted(
                col_docs,
                key=lambda d: d.get(sort_key, ""),
                reverse=reverse,
            )

        if limit is not None and limit > 0:
            col_docs = col_docs[:limit]

        return col_docs
