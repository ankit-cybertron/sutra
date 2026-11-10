"""Guardrail screening and text normalization for Sutra."""

import re
import unicodedata
from apps.api.app.errors import ApiProblemError

# Regex patterns for deterministic injection screening (English, Hindi, Hinglish)
INJECTION_PATTERNS = [
    # English prompt injection / extraction / overrides
    re.compile(r"\b(ignore|disregard|forget|override|bypass|drop)\b.*\b(previous|all|prior|system|above)\b.*\b(instructions?|prompts?|rules?|directives?)\b", re.IGNORECASE),
    re.compile(r"\b(reveal|print|show|output|leak|repeat|dump|display|what is)\b.*\b(system|initial|hidden|secret|developer)\b.*\b(instructions?|prompts?|rules?)\b", re.IGNORECASE),
    re.compile(r"\b(you are now|act as|pretend to be|enter|switch to)\b.*\b(dan|developer mode|unrestricted|jailbreak|chaos)\b", re.IGNORECASE),
    re.compile(r"\b(jailbreak|dan mode|do anything now|unrestricted mode)\b", re.IGNORECASE),
    
    # Delimiter and tag injection attempts
    re.compile(r"</?(user_idea|user_input|user_answers|current_plan|user_suggestion|im_start|im_end|system)>", re.IGNORECASE),
    re.compile(r"\[/?(inst|sys|instruction)\]", re.IGNORECASE),
    
    # Hindi / Hinglish prompt injection variants
    re.compile(r"\b(pichhle|pichle|purane|saare|sabhi)\b.*\b(instructions?|nirdesh|aadesh|baatein)\b.*\b(ignore|bhool|hatao|chhod)\b", re.IGNORECASE),
    re.compile(r"\b(ignore|bhool)\b.*\b(pichhle|pichle|purane|nirdesh|aadesh)\b", re.IGNORECASE),
    re.compile(r"\b(system\s*prompt|secret\s*prompt)\b.*\b(dikhao|batao|print\s*karo|likho)\b", re.IGNORECASE),
    re.compile(r"\b(apna\s*prompt|system\s*instructions)\b.*\b(batao|dikhao)\b", re.IGNORECASE),
    re.compile(r"(पिछले\s*निर्देश\s*(भूल\s*जाओ|इग्नोर\s*करो)|सिस्टम\s*प्रॉम्प्ट\s*(दिखाओ|बताओ))", re.IGNORECASE),
]

# Control and zero-width characters regex
ZERO_WIDTH_RE = re.compile(r"[\u200B-\u200D\uFEFF\u202A-\u202E\u2066-\u2069]")
CONTROL_CHAR_RE = re.compile(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]")


def normalize_text(text: str) -> str:
    """Normalizes Unicode (NFC), strips zero-width/control characters, collapses whitespace."""
    if not text:
        return ""
    # 1. Unicode NFC
    s = unicodedata.normalize("NFC", text)
    # 2. Strip zero-width & bidi characters
    s = ZERO_WIDTH_RE.sub("", s)
    # 3. Strip ASCII control characters (keeping \t, \n, \r)
    s = CONTROL_CHAR_RE.sub("", s)
    # 4. Collapse excessive whitespace
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def check_injection(text: str) -> bool:
    """Returns True if the text contains a prompt injection pattern."""
    for pattern in INJECTION_PATTERNS:
        if pattern.search(text):
            return True
    return False


def validate_input(
    raw_text: str,
    max_chars: int = 1500,
    allow_empty: bool = False,
    field_name: str = "Input",
) -> str:
    """Validates and screens user input.
    
    Raises:
        ApiProblemError(422, 'INPUT_INVALID'): if empty and not allow_empty
        ApiProblemError(413, 'INPUT_TOO_LONG'): if len > max_chars
        ApiProblemError(422, 'INPUT_BLOCKED'): if injection detected
    """
    normalized = normalize_text(raw_text)
    
    if not normalized:
        if allow_empty:
            return ""
        raise ApiProblemError(
            status_code=422,
            code="INPUT_INVALID",
            title="Invalid Input",
            detail=f"{field_name} cannot be empty. Please enter something first.",
        )
        
    if len(normalized) > max_chars:
        raise ApiProblemError(
            status_code=413,
            code="INPUT_TOO_LONG",
            title="Input Too Long",
            detail=f"{field_name} exceeds the maximum allowed length of {max_chars} characters.",
        )
        
    if check_injection(normalized):
        # Generic detail, never reveal rule or category per API contract
        raise ApiProblemError(
            status_code=422,
            code="INPUT_BLOCKED",
            title="Input Blocked",
            detail="I can only help plan and build software application ideas.",
        )
        
    return normalized
