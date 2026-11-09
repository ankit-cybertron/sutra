#!/usr/bin/env python3
"""
Generate JSON Schema and TypeScript types from Pydantic Spec model.
Outputs:
  packages/spec-schema/spec.schema.json  — JSON Schema Draft 2020-12
  packages/spec-schema/index.d.ts        — TypeScript definitions
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Ensure app package is on path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.schemas.spec import Spec

REPO_ROOT = Path(__file__).parent.parent.parent.parent
OUT_DIR = REPO_ROOT / "packages" / "spec-schema"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── JSON Schema ──────────────────────────────────────────────────────────────
schema = Spec.model_json_schema()
schema["$schema"] = "https://json-schema.org/draft/2020-12/schema"
schema["title"] = "VoxSpec Spec"

schema_path = OUT_DIR / "spec.schema.json"
schema_path.write_text(json.dumps(schema, indent=2) + "\n")
print(f"✓ wrote {schema_path}")

# ── TypeScript definitions ───────────────────────────────────────────────────
# Map JSON Schema types to TypeScript types
JSON_TO_TS: dict[str, str] = {
    "string": "string",
    "integer": "number",
    "number": "number",
    "boolean": "boolean",
    "null": "null",
}


def json_type_to_ts(prop: dict) -> str:  # type: ignore[type-arg]
    """Convert a JSON Schema property definition to a TypeScript type string."""
    # Handle $ref
    if "$ref" in prop:
        ref = prop["$ref"]
        # e.g. "#/$defs/Span" → "Span"
        return ref.split("/")[-1]

    # Handle anyOf / oneOf (e.g. string | null)
    if "anyOf" in prop:
        parts = [json_type_to_ts(sub) for sub in prop["anyOf"]]
        # De-duplicate and join
        seen: set[str] = set()
        unique: list[str] = []
        for p in parts:
            if p not in seen:
                seen.add(p)
                unique.append(p)
        return " | ".join(unique)

    t = prop.get("type", "unknown")
    if isinstance(t, list):
        return " | ".join(JSON_TO_TS.get(x, x) for x in t)

    if t == "array":
        items = prop.get("items", {})
        return f"Array<{json_type_to_ts(items)}>"

    if t == "object":
        return "Record<string, unknown>"

    return JSON_TO_TS.get(t, t)


def emit_interface(name: str, definition: dict, defs: dict) -> str:  # type: ignore[type-arg]
    """Emit a TypeScript interface from a JSON Schema $defs entry."""
    lines: list[str] = []
    description = definition.get("description", "")
    if description:
        lines.append(f"/** {description} */")
    lines.append(f"export interface {name} {{")

    properties = definition.get("properties", {})
    required_fields = set(definition.get("required", []))

    for field_name, field_def in properties.items():
        optional = "" if field_name in required_fields else "?"
        ts_type = json_type_to_ts(field_def)
        field_desc = field_def.get("description", "")
        if field_desc:
            lines.append(f"  /** {field_desc} */")
        lines.append(f"  {field_name}{optional}: {ts_type};")

    lines.append("}")
    return "\n".join(lines)


defs: dict = schema.get("$defs", {})
ts_lines: list[str] = [
    "// AUTO-GENERATED — do not edit by hand.",
    "// Source: apps/api/app/schemas/spec.py",
    "// Generator: apps/api/scripts/gen_schema.py",
    "",
]

# Emit all $defs as interfaces
for def_name, definition in defs.items():
    if definition.get("type") == "object" or "properties" in definition:
        ts_lines.append(emit_interface(def_name, definition, defs))
        ts_lines.append("")

# Emit top-level Spec interface
ts_lines.append(emit_interface("Spec", schema, defs))
ts_lines.append("")

ts_path = OUT_DIR / "index.d.ts"
ts_path.write_text("\n".join(ts_lines))
print(f"✓ wrote {ts_path}")
