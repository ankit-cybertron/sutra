"""Gemini AI Adapter for Software Architecture Analysis & Mermaid Diagram Synthesis."""

import asyncio
import logging
import re
from typing import Any, Dict, Optional

try:
    from google import genai
    from google.genai.errors import APIError
    HAS_GOOGLE_GENAI = True
except ImportError:
    genai = None  # type: ignore
    APIError = Exception  # type: ignore
    HAS_GOOGLE_GENAI = False

from apps.api.app.config import settings

logger = logging.getLogger("sutra.adapters.gemini")


class GeminiAdapter:
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.api_key = api_key if api_key is not None else settings.gemini_api_key
        self.model = model or settings.gemini_model or "gemini-2.5-flash"
        self.client: Any = None

        if not HAS_GOOGLE_GENAI:
            self.status = "unconfigured"
            self.last_error = "google-genai package not installed"
            logger.info("google-genai package not installed. Using deterministic architecture synthesis.")
        elif self.api_key and not self.api_key.startswith("your_") and not self.api_key.startswith("mock"):
            try:
                self.client = genai.Client(api_key=self.api_key)
                self.status = "connected"
                self.last_error = None
            except Exception as e:
                self.status = "error"
                self.last_error = str(e)
                logger.warning(f"Failed to initialize Google GenAI Client: {e}")
        else:
            self.status = "unconfigured"
            self.last_error = "GEMINI_API_KEY is not configured"

    def _sanitize_and_repair_mermaid(self, text: str) -> str:
        """Extracts, repairs, and guarantees valid Mermaid syntax from LLM output."""
        code = text.strip()
        # Remove markdown code fences if present
        if "```mermaid" in code:
            code = code.split("```mermaid", 1)[1]
            code = code.split("```", 1)[0]
        elif "```" in code:
            code = code.split("```", 1)[1]
            code = code.split("```", 1)[0]

        code = code.strip()

        lines = code.splitlines()
        repaired_lines = []

        # Pass 1: Line-by-line syntax normalization
        for raw_line in lines:
            line = raw_line.rstrip()
            stripped = line.strip()

            if not stripped:
                continue

            # Convert single % comment to %%
            if stripped.startswith("%") and not stripped.startswith("%%"):
                line = line.replace("%", "%%", 1)
                stripped = line.strip()

            # Split inline 'end' that follows a node declaration
            # e.g., 'NodeId["Label"]:::external end' -> separate lines
            if (
                ("[" in line or "]" in line or ":::" in line)
                and stripped.endswith("end")
                and not stripped.startswith("subgraph")
                and stripped != "end"
            ):
                idx = line.rfind("end")
                repaired_lines.append(line[:idx].rstrip())
                repaired_lines.append("    end")
                continue

            # Repair malformed edge syntax like: --, "text" or -- "text" -->
            line = re.sub(r'--,\s*"([^"]+)"\s*-->', r'-->|"\1"| ', line)
            line = re.sub(r'--,\s*"([^"]+)"', r'-->|"\1"|', line)
            line = re.sub(r'--\s*"([^"]+)"\s*-->', r'-->|"\1"| ', line)

            # Sanitize node definitions with spaces/hyphens/parentheses in ID before bracket
            # e.g. '    markdown-it (JS Library)["markdown-it"]' -> '    markdown_it_JS_Library["markdown-it"]'
            node_m = re.match(r"^(\s*)([a-zA-Z0-9_\s\-\.\(\)]+?)(\[(\"|\(|\[)?.*)$", line)
            if node_m and not stripped.startswith("subgraph"):
                indent = node_m.group(1)
                raw_id = node_m.group(2).strip()
                rest = node_m.group(3)
                if not re.match(r"^[a-zA-Z0-9_]+$", raw_id):
                    clean_id = re.sub(r"[^a-zA-Z0-9_]", "_", raw_id)
                    clean_id = re.sub(r"_+", "_", clean_id).strip("_")
                    if clean_id:
                        if not clean_id[0].isalpha():
                            clean_id = "N_" + clean_id
                        line = f"{indent}{clean_id}{rest}"

            repaired_lines.append(line)

        # Pass 2: Ensure subgraphs are not empty (Mermaid fails on empty subgraphs)
        final_lines = []
        in_subgraph = False
        subgraph_header = ""
        subgraph_nodes = []

        for l in repaired_lines:
            s = l.strip()
            if s.startswith("subgraph"):
                in_subgraph = True
                subgraph_header = l
                subgraph_nodes = []
            elif s == "end" and in_subgraph:
                real_nodes = [
                    n
                    for n in subgraph_nodes
                    if n.strip() and not n.strip().startswith("%%")
                ]
                final_lines.append(subgraph_header)
                if not real_nodes:
                    sg_name = "Component"
                    m = re.search(r"subgraph\s+([a-zA-Z0-9_]+)", subgraph_header)
                    if m:
                        sg_name = m.group(1)
                    final_lines.append(
                        f'        {sg_name}_Empty["No dedicated component in current MVP scope"]'
                    )
                else:
                    final_lines.extend(subgraph_nodes)
                final_lines.append(l)
                in_subgraph = False
            elif in_subgraph:
                subgraph_nodes.append(l)
            else:
                final_lines.append(l)

        repaired_code = "\n".join(final_lines).strip()

        # Ensure valid diagram header
        if not (repaired_code.startswith("flowchart") or repaired_code.startswith("graph")):
            repaired_code = "flowchart TD\n" + repaired_code

        # Append styling classes if not already defined
        if "classDef" not in repaired_code:
            styling = """
    %% Blueprint Theme Styling
    classDef client fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef edge fill:#0f172a,stroke:#fbbf24,stroke-width:2px,color:#f8fafc;
    classDef service fill:#0f172a,stroke:#818cf8,stroke-width:2px,color:#f8fafc;
    classDef storage fill:#0f172a,stroke:#34d399,stroke-width:2px,color:#f8fafc;
    classDef external fill:#0f172a,stroke:#f472b6,stroke-width:2px,color:#f8fafc;

    class ClientTier client;
    class GatewayTier edge;
    class ServiceTier service;
    class DataTier storage;
    class ExternalTier external;"""
            repaired_code += styling

        return repaired_code

    def _generate_fallback_diagram(self, markdown_plan: str) -> str:
        """Synthesizes a clean, deterministic Mermaid architecture diagram when API is offline or rate-limited."""
        title_match = re.search(r"#\s+([^\n]+)", markdown_plan)
        title = title_match.group(1).strip() if title_match else "Software System"

        has_postgres = "postgres" in markdown_plan.lower()
        has_redis = "redis" in markdown_plan.lower()
        has_whatsapp = "whatsapp" in markdown_plan.lower() or "twilio" in markdown_plan.lower()
        has_fastapi = "fastapi" in markdown_plan.lower()
        has_react = "react" in markdown_plan.lower() or "web" in markdown_plan.lower()
        has_llm = "groq" in markdown_plan.lower() or "llm" in markdown_plan.lower() or "gemini" in markdown_plan.lower()

        client_node = 'WebClient["React 19 Responsive SPA"]' if has_react else 'Client["Client Application"]'
        api_node = 'API["FastAPI Async Gateway"]' if has_fastapi else 'API["Backend API Gateway"]'

        db_nodes = []
        if has_postgres:
            db_nodes.append('PG[("PostgreSQL Database")]')
        if has_redis:
            db_nodes.append('RC[("Redis Cache & Lock Store")]')
        if not db_nodes:
            db_nodes.append('DB[("Atomic Document Store")]')

        ext_nodes = []
        if has_whatsapp:
            ext_nodes.append('WA[["WhatsApp Business / Twilio API"]]')
        if has_llm:
            ext_nodes.append('AI[["Groq / Gemini AI Inference"]]')
        if not ext_nodes:
            ext_nodes.append('Cloud[["Cloud Infrastructure"]]')

        db_block = "\n        ".join(db_nodes)
        ext_block = "\n        ".join(ext_nodes)

        return f"""flowchart TD
    %% Architectural layers for {title}
    subgraph ClientLayer ["Client & Interaction Tier"]
        {client_node}
    end

    subgraph EdgeLayer ["API & Gateway Tier"]
        {api_node}
    end

    subgraph ServiceLayer ["Core Domain Services"]
        Engine["Core Business Logic & State Engine"]
        Worker["Async Task & Notification Worker"]
    end

    subgraph StorageLayer ["Persistence & Cache Tier"]
        {db_block}
    end

    subgraph ExternalLayer ["External Services & AI"]
        {ext_block}
    end

    %% Directional Communication Flows
    ClientLayer -->|"HTTPS / WebSocket"| EdgeLayer
    EdgeLayer -->|"Validates & Dispatches"| Engine
    Engine -->|"Async Queue"| Worker
    Engine -->|"Reads / Writes"| StorageLayer
    Worker -->|"External Triggers"| ExternalLayer

    %% Styling
    classDef client fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef edge fill:#0f172a,stroke:#fbbf24,stroke-width:2px,color:#f8fafc;
    classDef service fill:#0f172a,stroke:#818cf8,stroke-width:2px,color:#f8fafc;
    classDef storage fill:#0f172a,stroke:#34d399,stroke-width:2px,color:#f8fafc;
    classDef external fill:#0f172a,stroke:#f472b6,stroke-width:2px,color:#f8fafc;

    class ClientLayer client;
    class EdgeLayer edge;
    class ServiceLayer service;
    class StorageLayer storage;
    class ExternalLayer external;"""

    async def generate_architecture_diagram(self, markdown_plan: str) -> Dict[str, Any]:
        """Analyzes software architecture markdown with Gemini Flash and produces Mermaid.js syntax."""
        fallback_diagram = self._generate_fallback_diagram(markdown_plan or "")

        if not markdown_plan or not markdown_plan.strip():
            return {
                "mermaid": fallback_diagram,
                "fallbackMermaid": fallback_diagram,
                "model": "deterministic-fallback",
                "status": "fallback",
                "notice": "Plan documentation was empty; generated standard architecture template.",
            }

        if not self.client:
            logger.info("Gemini client not configured. Using deterministic architecture synthesis.")
            return {
                "mermaid": fallback_diagram,
                "fallbackMermaid": fallback_diagram,
                "model": "deterministic-fallback",
                "status": "fallback",
                "notice": "Gemini API key unconfigured; using deterministic diagram generator.",
            }

        prompt = f"""You are an elite principal software architect. Analyze the following project plan Markdown and generate a clean, modern architecture diagram in strictly valid Mermaid.js flowchart syntax.

Project Documentation:
{markdown_plan}

STRICT MERMAID SYNTAX RULES (Violations will break the parser):
1. Start with `flowchart TD`.
2. Node IDs MUST be simple alphanumeric words with underscores only (e.g., User, NextJS_App, ZustandStore, MarkdownIt_Lib, Vercel_Edge, LLM_API).
   - NEVER put spaces, dashes, dots, or parentheses in a node ID.
   - Example good: MarkdownIt_Lib["markdown-it (JS Library)"]
   - Example bad: markdown-it (JS Library)["markdown-it (JS Library)"]
   - Example good: Vercel_Edge --> Serverless_Func
   - Example bad: V A --> B
3. Node labels MUST be in double quotes: NodeID["Label Text"].
4. Database/cache nodes MUST use cylinders: DB[("Database Name")].
5. External services MUST use double brackets: Ext[["Service Name"]].
6. Connections MUST use directional arrows with double-quoted edge text: NodeA -->|"HTTP/JSON"| NodeB.
   - NEVER use `-- "text" -->` or `--, "text"`.
7. Subgraphs MUST contain at least one node. If there is no database/cache, add a placeholder node:
   NoDb["No persistent database in MVP scope"].
   NEVER leave a subgraph empty or only containing comments.
8. Each `end` keyword MUST be on its own line. Never write `["..."] end`.
9. Comments MUST start with `%%` (never `%`).

Group into 5 clean subgraphs:
- subgraph ClientTier ["Client & UI Layer"]
- subgraph GatewayTier ["Edge & Routing Layer"]
- subgraph ServiceTier ["Application Services & Logic"]
- subgraph DataTier ["Storage & Persistence Layer"]
- subgraph ExternalTier ["External APIs & Services"]

Return ONLY the Mermaid code block inside ```mermaid ... ```."""

        try:
            response = await asyncio.wait_for(
                self.client.aio.models.generate_content(
                    model=self.model,
                    contents=prompt,
                ),
                timeout=15.0,
            )
            raw_text = response.text or ""
            mermaid_code = self._sanitize_and_repair_mermaid(raw_text)
            return {
                "mermaid": mermaid_code,
                "fallbackMermaid": fallback_diagram,
                "model": self.model,
                "status": "success",
            }
        except asyncio.TimeoutError:
            logger.warning("Gemini diagram generation timed out after 15s. Using deterministic fallback.")
            return {
                "mermaid": fallback_diagram,
                "fallbackMermaid": fallback_diagram,
                "model": "deterministic-fallback",
                "status": "fallback",
                "notice": "Diagram generation took longer than expected; provided optimized fallback architecture.",
            }
        except APIError as api_err:
            logger.warning(f"Gemini API error ({api_err}). Falling back to deterministic diagram synthesis.")
            return {
                "mermaid": fallback_diagram,
                "fallbackMermaid": fallback_diagram,
                "model": "deterministic-fallback",
                "status": "fallback",
                "notice": f"Gemini quota/rate limit encountered ({getattr(api_err, 'code', 429)}); generated architecture diagram via local fallback engine.",
            }
        except Exception as exc:
            logger.error(f"Unexpected error in Gemini diagram generation: {exc}")
            return {
                "mermaid": fallback_diagram,
                "fallbackMermaid": fallback_diagram,
                "model": "deterministic-fallback",
                "status": "fallback",
                "notice": "Generated architecture diagram via resilient fallback engine.",
            }


_gemini_adapter: Optional[GeminiAdapter] = None


def get_gemini_adapter() -> GeminiAdapter:
    global _gemini_adapter
    if _gemini_adapter is None:
        _gemini_adapter = GeminiAdapter()
    return _gemini_adapter
