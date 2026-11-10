import { useState, useRef, useEffect } from "react";
import mermaid from "mermaid";
import { api } from "../api";
import type { PlanDoc } from "../api/types";
import { planToMarkdown, slug } from "../lib/markdown";
import { IconClose, IconDownload, IconLayers, IconRefresh } from "./Icons";

interface Props {
  doc: PlanDoc;
}

type DiagramStatus = "idle" | "analyzing" | "generating" | "rendered" | "error";

export function ArchitectureDiagram({ doc }: Props) {
  const [status, setStatus] = useState<DiagramStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const renderContainerRef = useRef<HTMLDivElement | null>(null);

  // Cleanup any stray SVG error elements mermaid appends to document.body
  const cleanupMermaidArtifacts = () => {
    try {
      const artifacts = document.querySelectorAll(
        "[id^='dmermaid'], [id^='darch_'], [id^='dfb_'], .error-icon, svg[aria-roledescription='error']"
      );
      artifacts.forEach((el) => el.remove());
    } catch {
      // Ignore DOM errors
    }
  };

  // Initialize mermaid configuration once
  useEffect(() => {
    try {
      mermaid.initialize({
        startOnLoad: false,
        suppressErrorRendering: true,
        theme: "dark",
        securityLevel: "loose",
        fontFamily: "inherit",
        themeVariables: {
          darkMode: true,
          background: "#0d131f",
          primaryColor: "#1e293b",
          primaryTextColor: "#f8fafc",
          primaryBorderColor: "#38bdf8",
          lineColor: "#64748b",
          secondaryColor: "#1e293b",
          tertiaryColor: "#0f172a",
        },
      });
    } catch {
      // Ignore re-initialization warnings
    }
  }, []);

  const handleGenerate = async () => {
    setStatus("analyzing");
    setErrorMessage(null);
    cleanupMermaidArtifacts();

    try {
      // 1. Read existing Markdown plan
      const mdContent = planToMarkdown(doc.plan, doc.version);
      if (!mdContent.trim()) {
        throw new Error("Project plan documentation is empty.");
      }

      // 2. Call backend Gemini Flash endpoint
      const res = await api.generateArchitectureDiagram(doc.id, mdContent);
      if (!res.mermaid || !res.mermaid.trim()) {
        throw new Error("Failed to extract architecture diagram syntax.");
      }

      setStatus("generating");

      // 3. Render Mermaid to SVG locally using Mermaid.js with graceful fallback
      const baseId = `arch_${doc.id.replace(/[^a-zA-Z0-9]/g, "")}_${Date.now()}`;
      let renderedSvg: string | null = null;

      try {
        cleanupMermaidArtifacts();
        const { svg } = await mermaid.render(baseId, res.mermaid);
        renderedSvg = svg;
      } catch (primaryErr) {
        console.warn("Primary synthesized diagram had syntax quirks; attempting fallback:", primaryErr);
        cleanupMermaidArtifacts();

        if (res.fallbackMermaid) {
          try {
            const fallbackId = `fb_${baseId}`;
            const { svg: fbSvg } = await mermaid.render(fallbackId, res.fallbackMermaid);
            renderedSvg = fbSvg;
          } catch (fbErr) {
            cleanupMermaidArtifacts();
            throw primaryErr;
          }
        } else {
          throw primaryErr;
        }
      }

      cleanupMermaidArtifacts();
      if (!renderedSvg) {
        throw new Error("Unable to render architecture diagram.");
      }

      setSvgContent(renderedSvg);
      setStatus("rendered");
    } catch (err: unknown) {
      cleanupMermaidArtifacts();
      const rawMsg = err instanceof Error ? err.message : "Failed to generate architecture diagram.";
      // Clean up technical lexical dumps for user presentation
      const friendlyMsg = rawMsg.includes("Lexical error") || rawMsg.includes("Parse error")
        ? "Encountered a diagram syntax error during synthesis. Please retry."
        : rawMsg;
      setErrorMessage(friendlyMsg);
      setStatus("error");
    } finally {
      cleanupMermaidArtifacts();
    }
  };

  const handleDownloadSvg = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(doc.plan.title)}-architecture-v${doc.version}.svg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadPng = () => {
    if (!svgContent) return;
    const img = new Image();
    const svgBlob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      // Render at 2x resolution for high-DPI crisp export
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = (img.width || 1200) * scale;
      canvas.height = (img.height || 750) * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Dark background matching design
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      URL.revokeObjectURL(url);
      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = `${slug(doc.plan.title)}-architecture-v${doc.version}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    };

    img.src = url;
  };

  return (
    <div className="arch-diagram-module" aria-label="Software Architecture Diagram">
      {status === "idle" && (
        <div className="arch-cta-wrap">
          <button
            type="button"
            className="btn btn-cta btn-arch-action"
            onClick={handleGenerate}
          >
            <IconLayers size={18} />
            <span>Generate Architecture Image</span>
          </button>
          <p className="arch-sub-hint">
            Analyzes the project plan with Gemini 2.5 Flash and renders a system architecture diagram via Mermaid.js.
          </p>
        </div>
      )}

      {(status === "analyzing" || status === "generating") && (
        <div className="arch-loading-state" role="status">
          <div className="arch-spinner" aria-hidden="true" />
          <div className="arch-loading-text">
            <p className="arch-loading-primary">
              {status === "analyzing"
                ? "Analyzing project architecture…"
                : "Generating architecture diagram…"}
            </p>
            <p className="arch-loading-secondary">
              Extracting frontend, backend, APIs, storage, and external services from Markdown.
            </p>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="arch-error-state" role="alert">
          <p className="arch-error-msg">{errorMessage || "Failed to generate architecture diagram."}</p>
          <button
            type="button"
            className="btn btn-light btn-sm"
            onClick={handleGenerate}
          >
            <IconRefresh size={14} /> Retry Generation
          </button>
        </div>
      )}

      {status === "rendered" && svgContent && (
        <div className="arch-result-card">
          <div className="arch-toolbar">
            <div className="arch-toolbar-left">
              <span className="arch-badge">Generated Architecture</span>
              <span className="arch-model-tag">Gemini 2.5 Flash + Mermaid</span>
            </div>
            <div className="arch-toolbar-right">
              <button
                type="button"
                className="btn btn-light btn-xs"
                onClick={() => setIsModalOpen(true)}
                title="View full-size architecture diagram"
              >
                View Full-Size
              </button>
              <button
                type="button"
                className="btn btn-light btn-xs"
                onClick={handleDownloadSvg}
                title="Download scalable vector graphic"
              >
                <IconDownload size={13} /> SVG
              </button>
              <button
                type="button"
                className="btn btn-light btn-xs"
                onClick={handleDownloadPng}
                title="Download high-resolution PNG image"
              >
                <IconDownload size={13} /> PNG
              </button>
              <button
                type="button"
                className="btn btn-light btn-xs"
                onClick={handleGenerate}
                title="Regenerate architecture diagram"
              >
                <IconRefresh size={13} /> Regenerate
              </button>
            </div>
          </div>

          <div
            ref={renderContainerRef}
            className="arch-svg-viewport"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />

          {isModalOpen && (
            <div
              className="arch-modal-backdrop"
              role="dialog"
              aria-modal="true"
              onClick={() => setIsModalOpen(false)}
            >
              <div
                className="arch-modal-dialog"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="arch-modal-header">
                  <h4 className="arch-modal-title">
                    {doc.plan.title} · System Architecture
                  </h4>
                  <div className="arch-modal-actions">
                    <button
                      type="button"
                      className="btn btn-light btn-xs"
                      onClick={handleDownloadSvg}
                    >
                      <IconDownload size={13} /> SVG
                    </button>
                    <button
                      type="button"
                      className="btn btn-light btn-xs"
                      onClick={handleDownloadPng}
                    >
                      <IconDownload size={13} /> PNG
                    </button>
                    <button
                      type="button"
                      className="arch-modal-close"
                      onClick={() => setIsModalOpen(false)}
                      aria-label="Close modal"
                    >
                      <IconClose size={16} />
                    </button>
                  </div>
                </div>
                <div
                  className="arch-modal-body"
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
