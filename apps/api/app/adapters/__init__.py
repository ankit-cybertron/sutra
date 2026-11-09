from apps.api.app.adapters.groq import GroqAdapter
from apps.api.app.adapters.gnani import GnaniAdapter

_groq_instance: GroqAdapter | None = None
_gnani_instance: GnaniAdapter | None = None


def get_groq_adapter() -> GroqAdapter:
    global _groq_instance
    if _groq_instance is None:
        _groq_instance = GroqAdapter()
    return _groq_instance


def get_gnani_adapter() -> GnaniAdapter:
    global _gnani_instance
    if _gnani_instance is None:
        _gnani_instance = GnaniAdapter()
    return _gnani_instance
