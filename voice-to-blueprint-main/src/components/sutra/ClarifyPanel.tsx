import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, FastForward, Quote, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSpeaker } from "@/hooks/use-speaker";
import { useVoice } from "@/hooks/use-voice";
import { LANGS } from "@/lib/sutra/i18n";
import { useSutra } from "@/lib/sutra/store";
import { cn } from "@/lib/utils";
import { VoiceOrb, Waveform } from "./VoiceOrb";

export function ClarifyPanel() {
  const { idea, questions, qIndex, answer, skipQuestion, skipAll, lang } = useSutra();
  const q = questions[qIndex];
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [tts, setTts] = useState(true);
  const speaker = useSpeaker();
  const bcp = LANGS.find((l) => l.id === lang)!.bcp47;

  const voice = useVoice({
    lang: bcp,
    onStart: speaker.cancel,
    onTranscript: (f, i) => {
      setText(f);
      setInterim(i);
    },
    onCommand: (c) => {
      setInterim("");
      if (c === "skip") skipQuestion();
      else if (c === "done") setTimeout(() => submit(), 50);
    },
  });

  const lastSpokenIdRef = useRef<string | null>(null);

  useEffect(() => {
    setText("");
    setInterim("");
    if (!q || !tts) return;
    if (lastSpokenIdRef.current === q.id) {
      return;
    }
    lastSpokenIdRef.current = q.id;
    void speaker.speak(q.spokenText, bcp, q.id);
  }, [q?.id, q?.spokenText, tts, bcp]);

  function submit(v = text) {
    voice.stop();
    speaker.cancel();
    if (v.trim()) answer(v.trim());
    else skipQuestion();
  }

  if (!q) return null;
  const progress = ((qIndex + 1) / questions.length) * 100;

  return (
    <section className="relative min-h-screen px-5 pt-32 pb-20 sm:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[500px] bg-thread-soft opacity-60 blur-3xl" />
      <div className="relative mx-auto max-w-4xl 2xl:max-w-5xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 rounded-2xl border border-border bg-card/70 p-4 text-sm text-muted-foreground shadow-soft">
          <Quote className="h-4 w-4 shrink-0 text-rose" />
          <p className="line-clamp-2">{idea}</p>
        </motion.div>

        <div className="mt-14 flex items-center gap-4">
          <span className="eyebrow text-muted-foreground">
            Question {qIndex + 1} of {questions.length}
          </span>
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
            <motion.div className="h-full rounded-full bg-thread" animate={{ width: `${progress}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
          </div>
          <Button
            variant="ghost"
            size="iconSm"
            aria-label={tts ? "Mute voice" : "Unmute voice"}
            onClick={() => {
              if (tts) {
                speaker.cancel();
              } else {
                lastSpokenIdRef.current = q.id;
                void speaker.speak(q.spokenText, bcp, q.id);
              }
              setTts(!tts);
            }}
          >
            {tts ? <Volume2 /> : <VolumeX />}
          </Button>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={q.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <h1 className="display mt-8 text-4xl leading-[1.08] text-balance sm:text-5xl">
              {q.displayText}
              {speaker.speaking && <span className="ml-3 inline-flex translate-y-[-6px] items-center"><Waveform level={0.6} active bars={6} /></span>}
            </h1>

            {q.options.length > 0 && (
              <div className="mt-10 flex flex-wrap gap-2.5">
                {q.options.map((o, i) => (
                  <motion.button
                    key={o}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.07 }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => submit(o)}
                    className={cn(
                      "cursor-pointer rounded-full border px-5 py-2.5 text-[15px] transition-colors",
                      text === o ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card shadow-soft hover:border-foreground/30",
                    )}
                  >
                    <span className="mr-2 font-mono text-xs text-muted-foreground">{String.fromCharCode(65 + i)}</span>
                    {o}
                  </motion.button>
                ))}
              </div>
            )}

            <div className={cn("mt-8 flex items-center gap-4 rounded-3xl border bg-card p-3 pl-4 shadow-lift transition-shadow", voice.listening ? "thread-border shadow-glow" : "border-border")}>
              <VoiceOrb size="sm" listening={voice.listening} level={voice.level} onClick={() => voice.toggle(text)} />
              <div className="relative min-w-0 flex-1">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  placeholder={voice.listening ? "" : "Speak or type your answer…"}
                  className="w-full bg-transparent py-2 text-lg focus:outline-none"
                  autoFocus
                />
                {interim && <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center truncate text-lg text-muted-foreground italic">{text} {interim}</span>}
              </div>
              <Button variant="hero" onClick={() => submit()} disabled={!text.trim()}>
                {qIndex + 1 < questions.length ? "Next" : "Answer"} <ArrowRight />
              </Button>
            </div>
            {voice.error && <p className="mt-2 text-xs text-destructive">{voice.error}</p>}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => { speaker.cancel(); voice.stop(); skipQuestion(); }}>
            <SkipForward /> Skip question
          </Button>
          <Button variant="soft" onClick={() => { speaker.cancel(); voice.stop(); skipAll(); }}>
            <FastForward /> Skip all & compile now
          </Button>
        </div>
        <p className="mt-10 text-center text-xs text-muted-foreground">Tip: say “skip” to skip, or “done” to submit your answer.</p>
      </div>
    </section>
  );
}
