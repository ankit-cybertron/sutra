import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import { ArrowRight, CheckCircle2, GitBranch, Gauge, Languages, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoice } from "@/hooks/use-voice";
import { useSpeaker } from "@/hooks/use-speaker";
import { LANGS, SAMPLE_IDEAS, STRINGS } from "@/lib/sutra/i18n";
import { MAX_IDEA, useSutra } from "@/lib/sutra/store";
import { cn } from "@/lib/utils";
import { Magnetic } from "./motion/Magnetic";
import { ShaderField } from "./motion/ShaderField";
import { SplitText } from "./motion/SplitText";
import { VoiceOrb, Waveform } from "./VoiceOrb";

export const MIC_EVENT = "sutra:mic";
const ROTATING = ["idea.", "startup.", "side project.", "app.", "next big thing."];

function RotatingWord({ play }: { play: boolean }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!play) return;
    const t = setInterval(() => setI((v) => (v + 1) % ROTATING.length), 2200);
    return () => clearInterval(t);
  }, [play]);
  return (
    <span className="relative inline-flex overflow-hidden pb-[0.12em] align-bottom">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={ROTATING[i]}
          initial={{ y: "100%", opacity: 0, filter: "blur(6px)" }}
          animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
          exit={{ y: "-100%", opacity: 0, filter: "blur(6px)" }}
          transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
          className="inline-block text-thread"
        >
          {ROTATING[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

const FLOATERS = [
  { icon: CheckCircle2, label: "12 acceptance criteria", pos: "left-[4%] top-[30%]", depth: -120, delay: 1.2 },
  { icon: Languages, label: "Hinglish detected", pos: "right-[5%] top-[24%]", depth: -200, delay: 1.35 },
  { icon: GitBranch, label: "Build order · 4 steps", pos: "left-[8%] bottom-[18%]", depth: -60, delay: 1.5 },
  { icon: Gauge, label: "Readiness 94/100", pos: "right-[7%] bottom-[24%]", depth: -160, delay: 1.65 },
];

export function Hero({ ready = true }: { ready?: boolean }) {
  const { idea, setIdea, lang, refine, compile, busy } = useSutra();
  const t = STRINGS[lang];
  const [interim, setInterim] = useState("");
  const [pending, setPending] = useState<"refine" | "compile" | null>(null);
  const speaker = useSpeaker();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const levelRef = useRef(0);
  const sectionRef = useRef<HTMLElement>(null);

  const voice = useVoice({
    lang: LANGS.find((l) => l.id === lang)!.bcp47,
    onStart: speaker.cancel, // barge-in
    onTranscript: (final, int) => {
      setIdea(final, "voice");
      setInterim(int);
    },
    onCommand: (c) => {
      setInterim("");
      if (c === "done") void go("refine");
    },
  });
  levelRef.current = voice.listening ? voice.level : 0;

  useEffect(() => {
    const h = () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => !voice.listening && voice.start(idea), 600);
    };
    window.addEventListener(MIC_EVENT, h);
    return () => window.removeEventListener(MIC_EVENT, h);
  }, [voice, idea]);

  async function go(mode: "refine" | "compile") {
    voice.stop();
    setPending(mode);
    await (mode === "refine" ? refine() : compile());
    setPending(null);
  }

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const titleY = useTransform(scrollYProgress, [0, 1], [0, -160]);
  const titleScale = useTransform(scrollYProgress, [0, 1], [1, 0.9]);
  const fieldOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.2]);
  const p0 = useTransform(scrollYProgress, [0, 1], [0, FLOATERS[0]!.depth]);
  const p1 = useTransform(scrollYProgress, [0, 1], [0, FLOATERS[1]!.depth]);
  const p2 = useTransform(scrollYProgress, [0, 1], [0, FLOATERS[2]!.depth]);
  const p3 = useTransform(scrollYProgress, [0, 1], [0, FLOATERS[3]!.depth]);
  const parallax = [p0, p1, p2, p3];

  const len = idea.length;
  const over = len > MAX_IDEA;
  const near = len > MAX_IDEA * 0.85;

  return (
    <section ref={sectionRef} className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden pt-28 pb-20">
      {/* live thread field */}
      <motion.div className="absolute inset-0" style={{ opacity: fieldOpacity }}>
        <ShaderField levelRef={levelRef} className="absolute inset-0" />
      </motion.div>
      <div className="pointer-events-none absolute inset-0 grid-dots opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />

      {/* floating proof chips */}
      {FLOATERS.map((f, i) => (
        <motion.div key={f.label} className={cn("absolute hidden xl:block", f.pos)} style={{ y: parallax[i] ?? 0 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={ready ? { opacity: 1, scale: 1, y: 0 } : {}}
            transition={{ delay: f.delay, type: "spring", stiffness: 160, damping: 16 }}
          >
            <div className="flex animate-float items-center gap-2 rounded-2xl border border-border bg-card/80 px-3.5 py-2.5 text-sm shadow-lift backdrop-blur-md" style={{ animationDelay: `${i * 0.8}s` }}>
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-thread-soft">
                <f.icon className="h-4 w-4 text-foreground" />
              </span>
              {f.label}
            </div>
          </motion.div>
        </motion.div>
      ))}

      <div className="relative mx-auto w-full max-w-6xl 2xl:max-w-7xl px-5 text-center sm:px-8">
        <motion.div style={{ y: titleY, scale: titleScale }}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={ready ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.1 }}
            className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-border bg-card/80 py-1 pr-3 pl-1 text-xs text-muted-foreground shadow-soft backdrop-blur"
          >
            <span className="rounded-full bg-primary px-2 py-0.5 font-mono text-[10px] text-primary-foreground">NEW</span>
            Live architecture diagrams with Gemini
            <ArrowRight className="h-3 w-3" />
          </motion.div>

          <h1 className="display text-[clamp(3rem,8.5vw,7.5rem)]">
            {lang === "en" ? (
              <>
                <SplitText text="Speak your" play={ready} />{" "}
                <motion.span initial={{ opacity: 0 }} animate={ready ? { opacity: 1 } : {}} transition={{ delay: 0.3 }}>
                  <RotatingWord play={ready} />
                </motion.span>
                <br />
                <SplitText text="Ship the spec." play={ready} delay={0.25} className="text-muted-foreground/60" />
              </>
            ) : (
              <>
                <SplitText key={t.heroTitleA} text={t.heroTitleA} play={ready} />
                <br />
                <SplitText key={t.heroTitleB} text={t.heroTitleB} play={ready} delay={0.2} wordClassName="text-thread" />
              </>
            )}
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={ready ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.55, duration: 0.7 }}
            className="mx-auto mt-7 max-w-2xl text-lg text-balance text-muted-foreground sm:text-xl"
          >
            {t.heroSub}
          </motion.p>
        </motion.div>

        {/* Input module */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.96 }}
          animate={ready ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 1, delay: 0.65, ease: [0.2, 0.8, 0.2, 1] }}
          className={cn(
            "relative mx-auto mt-12 max-w-4xl 2xl:max-w-5xl rounded-4xl border bg-card/85 p-3 text-left shadow-lift backdrop-blur-xl transition-shadow duration-500",
            voice.listening ? "thread-border shadow-glow" : "border-border",
          )}
        >
          <div className="flex gap-4 p-3 sm:p-4">
            <div className="hidden pt-1 sm:block">
              <Magnetic strength={0.4}>
                <VoiceOrb listening={voice.listening} level={voice.level} onClick={() => voice.toggle(idea)} />
              </Magnetic>
            </div>
            <div className="min-w-0 flex-1">
              <div className="relative">
                <textarea
                  ref={taRef}
                  value={idea}
                  onChange={(e) => setIdea(e.target.value, "text")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void go("refine");
                  }}
                  placeholder={voice.listening ? "" : t.placeholder}
                  rows={3}
                  className="w-full resize-none bg-transparent text-lg leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none sm:text-xl"
                  aria-label="Your idea"
                  suppressHydrationWarning
                />
                {interim && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-1 truncate text-lg text-muted-foreground/70 italic sm:text-xl">{interim}</div>
                )}
              </div>
              <AnimatePresence>
                {voice.listening && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 overflow-hidden pt-2">
                    <Waveform level={voice.level} active />
                    <span className="text-xs text-muted-foreground">{t.listening}</span>
                  </motion.div>
                )}
              </AnimatePresence>
              {voice.error && <p className="pt-2 text-xs text-destructive">{voice.error}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-3 pt-3 pb-1 sm:flex-row sm:items-center sm:px-4">
            <div className="flex items-center gap-3">
              <div className="sm:hidden">
                <VoiceOrb size="sm" listening={voice.listening} level={voice.level} onClick={() => voice.toggle(idea)} />
              </div>
              <span className={cn("font-mono text-xs tabular-nums", over ? "text-destructive" : near ? "text-warning" : "text-muted-foreground")}>
                {len}/{MAX_IDEA}
              </span>
              <span className="hidden text-xs text-muted-foreground md:inline">⌘ + Enter to refine</span>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
              <Button variant="ghost" onClick={() => go("compile")} disabled={busy || over || !idea.trim()} className="w-full sm:w-auto">
                {pending === "compile" ? <Loader2 className="animate-spin" /> : <Wand2 />}
                {t.compile}
              </Button>
              <Magnetic strength={0.25} className="w-full sm:w-auto">
                <Button variant="hero" onClick={() => go("refine")} disabled={busy || over || !idea.trim()} className="w-full sm:w-auto">
                  {pending === "refine" ? <Loader2 className="animate-spin" /> : null}
                  {t.refine}
                  <span className="hidden rounded-full bg-primary-foreground/15 px-1.5 py-0.5 text-[10px] font-normal sm:inline">Recommended</span>
                  <ArrowRight />
                </Button>
              </Magnetic>
            </div>
          </div>
        </motion.div>

        {/* Samples */}
        <div className="mx-auto mt-6 flex max-w-4xl 2xl:max-w-5xl flex-wrap justify-center gap-2">
          {SAMPLE_IDEAS.map((s, i) => (
            <motion.div key={s} initial={{ opacity: 0, y: 12 }} animate={ready ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.9 + i * 0.07 }}>
              <Button variant="chip" size="sm" onClick={() => { setIdea(s, "text"); taRef.current?.focus(); }}>
                {s}
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
