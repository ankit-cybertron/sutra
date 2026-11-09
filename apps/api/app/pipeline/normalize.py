import re
import unicodedata
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.spec import Span

LanguageTag = Literal["en", "hi", "hi-Latn", "mixed"]

DEVANAGARI_REGEX = re.compile(r"[\u0900-\u097F]")
HINGLISH_WORDS = {
    "nahi",
    "nahin",
    "ruko",
    "matlab",
    "mera",
    "chhodo",
    "chodo",
    "balki",
    "pehle",
    "jaisa",
    "karna",
    "hoga",
    "karo",
    "aur",
    "lekin",
    "bhi",
    "thik",
    "theek",
    "kaise",
    "karega",
    "wala",
    "wali",
    "wale",
    "kuch",
    "sab",
    "haan",
    "acha",
    "accha",
    "samjha",
    "bhai",
}


class Utterance(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    text: str = Field(min_length=1)
    span: Span
    lang: LanguageTag


def detect_language(text: str) -> LanguageTag:
    has_devanagari = bool(DEVANAGARI_REGEX.search(text))
    tokens = {w.lower() for w in re.findall(r"\b[a-zA-Z]+\b", text)}
    has_hinglish = bool(tokens & HINGLISH_WORDS)
    has_english = bool(tokens - HINGLISH_WORDS)

    if has_devanagari:
        return "mixed" if (has_english or has_hinglish) else "hi"
    if has_hinglish and has_english:
        return "mixed"
    if has_hinglish:
        return "hi-Latn"
    return "en"


def normalize(raw_text: str) -> list[Utterance]:
    """
    Normalizes transcript text into Utterance chunks with character offsets
    mapping directly into the raw_text.
    """
    if not raw_text or not raw_text.strip():
        return []

    # Cleaned text for length validation
    if len(raw_text) > 12000:
        raise ValueError("Transcript exceeds 12,000 characters limit")

    utterances: list[Utterance] = []
    # Split by sentence-ending punctuation or double newlines while tracking offsets
    pattern = re.compile(r"([^\.\?!;\n]+[\.\?!;\n]*)")
    matches = list(pattern.finditer(raw_text))

    u_count = 1
    for match in matches:
        matched_str = match.group(1)
        stripped = matched_str.strip()
        if not stripped:
            continue

        # Compute accurate offset for the stripped content
        leading_spaces = len(matched_str) - len(matched_str.lstrip())
        start_offset = match.start() + leading_spaces
        end_offset = start_offset + len(stripped)

        # Normalize unicode representation
        normalized_str = unicodedata.normalize("NFC", stripped)
        lang = detect_language(normalized_str)

        utterances.append(
            Utterance(
                id=f"u{u_count}",
                text=normalized_str,
                span=Span(start=start_offset, end=end_offset),
                lang=lang,
            )
        )
        u_count += 1

    return utterances
