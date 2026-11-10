import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { ChatMessage, Lang, Suggestion } from "../api/types";
import { LIMITS } from "../lib/config";
import { t } from "../lib/i18n";
import { countChars } from "../lib/sanitize";
import type { VoiceStatus } from "../voice/useVoice";
import { IconSend } from "./Icons";
import { VoiceOrb } from "./VoiceOrb";

interface Props {
  lang: Lang;
  messages: ChatMessage[];
  suggestions: Suggestion[];
  draft: string;
  partial: string;
  busy: boolean;
  rateLimited: boolean;
  speakReplies: boolean;
  voiceStatus: VoiceStatus;
  voiceLevel: number;
  onDraft: (v: string) => void;
  onSend: (text: string, source: "voice" | "text") => void;
  onSpeakReplies: (v: boolean) => void;
  onOrb: () => void;
  notice: ReactNode;
}

export function ChatPanel(p: Props) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [p.messages.length, p.busy]);

  const displayDraft = p.partial ? (p.draft ? `${p.draft} ${p.partial}` : p.partial) : p.draft;
  const n = countChars(displayDraft);
  const over = n > LIMITS.chat;
  const canSend = !!displayDraft.trim() && !over && !p.busy && !p.rateLimited;

  return (
    <aside className="chat" aria-label={t(p.lang, "chatTitle")}>
      <header className="chat-head">
        <div>
          <h2 className="chat-title">{t(p.lang, "chatTitle")}</h2>
          <p className="muted small">{t(p.lang, "chatSub")}</p>
        </div>
        <label className="switch small">
          <input type="checkbox" checked={p.speakReplies} onChange={(e) => p.onSpeakReplies(e.target.checked)} />
          <span>{t(p.lang, "speakReplies")}</span>
        </label>
      </header>

      <div className="chat-log" role="log" aria-live="polite" aria-relevant="additions">
        {p.messages.map((m) => (
          <div key={m.id} className={`msg msg-${m.role}`}>
            {m.role === "system" ? <span>{m.text}</span> : <p>{m.text}</p>}
          </div>
        ))}
        {p.busy && (
          <div className="msg msg-ai msg-typing" aria-label="…">
            <i /><i /><i />
          </div>
        )}
        <div ref={endRef} />
      </div>

      {p.suggestions.length > 0 && (
        <div className="suggest">
          <div className="plan-label">{t(p.lang, "suggestionsTitle")}</div>
          <div className="chips">
            {p.suggestions.map((s) => (
              <button
                key={s.id}
                type="button"
                className="chip"
                disabled={p.busy || p.rateLimited}
                onClick={() => p.onSend(s.text, "text")}
                title={`Impact: ${s.impact}`}
              >
                + {s.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {p.notice}

      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSend) p.onSend(p.draft, "text");
        }}
      >
        <label htmlFor="chat-draft" className="sr-only">
          {t(p.lang, "chatPlaceholder")}
        </label>
        <textarea
          id="chat-draft"
          rows={2}
          value={displayDraft}
          placeholder={t(p.lang, "chatPlaceholder")}
          onChange={(e) => p.onDraft(e.target.value)}
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (canSend) p.onSend(p.draft, "text");
            }
          }}
        />
        {p.partial && <p className="partial">… {p.partial}</p>}
        <div className="chat-bar">
          <VoiceOrb status={p.voiceStatus} level={p.voiceLevel} lang={p.lang} onClick={p.onOrb} />
          <span className={`count ${over ? "count-over" : ""}`}>
            {n}/{LIMITS.chat}
          </span>
          <button type="submit" className="btn btn-light btn-sm" disabled={!canSend}>
            <IconSend size={16} /> {t(p.lang, "send")}
          </button>
        </div>
      </form>
    </aside>
  );
}
