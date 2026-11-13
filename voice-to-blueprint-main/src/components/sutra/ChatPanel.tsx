import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Bot, Mic, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useSpeaker } from "@/hooks/use-speaker";
import { useVoice } from "@/hooks/use-voice";
import { LANGS } from "@/lib/sutra/i18n";
import { useSutra } from "@/lib/sutra/store";
import { cn } from "@/lib/utils";
import { VoiceOrb, Waveform } from "./VoiceOrb";

const IMPACT = { high: "bg-rose", medium: "bg-saffron", low: "bg-cobalt" } as const;

export function ChatPanel() {
  const { messages, sendChat, chatBusy, doc, lang } = useSutra();
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [tts, setTts] = useState(false);
  const speaker = useSpeaker();
  const bcp = LANGS.find((l) => l.id === lang)!.bcp47;
  const scroller = useRef<HTMLDivElement>(null);

  const send = async (v: string, source: "voice" | "text" = "text") => {
    if (!v.trim() || chatBusy) return;
    setText("");
    setInterim("");
    const spoken = await sendChat(v, source);
    if (spoken && tts) speaker.speak(spoken, bcp, `chat-${Date.now()}`);
  };

  const voice = useVoice({
    lang: bcp,
    onStart: speaker.cancel,
    onTranscript: (f, i) => {
      setText(f);
      setInterim(i);
    },
    onCommand: (c) => {
      if (c === "done") setTimeout(() => setText((t) => (void send(t, "voice"), "")), 30);
    },
  });

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, chatBusy]);

  const suggestions = doc?.plan.suggestions ?? [];

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-border bg-card shadow-lift">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-ink-foreground">
          <Sparkles className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">Plan co-pilot</p>
          <p className="text-xs text-muted-foreground">{chatBusy ? "Updating plan…" : "Talk or type to refine"}</p>
        </div>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          Read aloud
          <Switch checked={tts} onCheckedChange={(v) => { setTts(v); if (!v) speaker.cancel(); }} />
        </label>
      </header>

      <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 26 }}
              className={cn("flex gap-2.5", m.role === "user" && "flex-row-reverse")}
            >
              {m.role !== "user" && (
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary">
                  <Bot className="h-3.5 w-3.5" />
                </span>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed",
                  m.role === "user" && "rounded-tr-md bg-primary text-primary-foreground",
                  m.role === "ai" && "rounded-tl-md bg-surface-2",
                  m.role === "system" && "bg-destructive/10 text-destructive",
                )}
              >
                {m.source === "voice" && <Mic className="mr-1.5 inline h-3 w-3 opacity-70" />}
                {m.text}
              </div>
            </motion.div>
          ))}
          {chatBusy && (
            <motion.div key="typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2.5">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-secondary"><Bot className="h-3.5 w-3.5" /></span>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-surface-2 px-4 py-3">
                {[0, 1, 2].map((i) => (
                  <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-muted-foreground" animate={{ y: [0, -4, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.12 }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {suggestions.length > 0 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-3">
          {suggestions.map((s) => (
            <motion.button
              key={s.id}
              layout
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => send(s.text)}
              disabled={chatBusy}
              className="flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs transition-colors hover:border-foreground/30 disabled:opacity-50"
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", IMPACT[s.impact])} />
              {s.text}
            </motion.button>
          ))}
        </div>
      )}

      <div className="border-t border-border p-3">
        <div className={cn("flex items-end gap-2 rounded-2xl border bg-surface-2 p-2 transition-shadow", voice.listening ? "thread-border shadow-glow" : "border-transparent")}>
          <VoiceOrb size="sm" listening={voice.listening} level={voice.level} onClick={() => voice.toggle(text)} />
          <div className="relative min-w-0 flex-1 self-center">
            {voice.listening && !text && !interim ? (
              <div className="flex items-center gap-2 py-1.5"><Waveform level={voice.level} active bars={18} /></div>
            ) : (
              <textarea
                value={interim ? `${text} ${interim}` : text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send(text);
                  }
                }}
                rows={1}
                placeholder="Ask to change scope, stack, risks…"
                className="max-h-32 w-full resize-none bg-transparent py-1.5 text-sm focus:outline-none"
              />
            )}
          </div>
          <Button size="iconSm" onClick={() => { voice.stop(); void send(text, voice.listening ? "voice" : "text"); }} disabled={!text.trim() || chatBusy} aria-label="Send">
            <ArrowUp />
          </Button>
        </div>
      </div>
    </aside>
  );
}
