from apps.api.app.store.base import DocStore
from apps.api.app.store.json_store import JsonFileStore
from apps.api.app.config import settings

_store_instance: DocStore | None = None


def get_store() -> DocStore:
    global _store_instance
    if _store_instance is None:
        _store_instance = JsonFileStore(settings.data_dir)
    return _store_instance
