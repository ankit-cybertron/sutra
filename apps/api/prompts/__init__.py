"""Re-export all prompt constants for clean import."""

from app.prompts.extract_claims import (
    EXTRACT_CLAIMS_SYSTEM,
    EXTRACT_CLAIMS_USER,
    EXTRACT_CLAIMS_VERSION,
    GAP_ANALYSIS_SYSTEM,
    GAP_ANALYSIS_USER,
    GAP_ANALYSIS_VERSION,
)

__all__ = [
    "EXTRACT_CLAIMS_SYSTEM",
    "EXTRACT_CLAIMS_USER",
    "EXTRACT_CLAIMS_VERSION",
    "GAP_ANALYSIS_SYSTEM",
    "GAP_ANALYSIS_USER",
    "GAP_ANALYSIS_VERSION",
]
