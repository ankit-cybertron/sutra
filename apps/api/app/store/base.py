"""Abstract Document Store interface."""

from abc import ABC, abstractmethod
from typing import Any, Callable, Dict, List, Optional


class DocStore(ABC):
    @abstractmethod
    async def get(self, collection: str, doc_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a document by collection and ID."""
        pass

    @abstractmethod
    async def put(self, collection: str, doc: Dict[str, Any]) -> Dict[str, Any]:
        """Save or overwrite a document."""
        pass

    @abstractmethod
    async def delete(self, collection: str, doc_id: str) -> bool:
        """Delete a document by collection and ID."""
        pass

    @abstractmethod
    async def list(
        self,
        collection: str,
        filter_fn: Optional[Callable[[Dict[str, Any]], bool]] = None,
        sort_key: Optional[str] = None,
        reverse: bool = False,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """List documents matching filter, sorted and limited."""
        pass
