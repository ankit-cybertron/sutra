import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { api, isDemoMode } from "@/lib/sutra/api";
import { LANGS, STRINGS } from "@/lib/sutra/i18n";
import { useSutra } from "@/lib/sutra/store";
import type { HealthResponse, ProviderStatus } from "@/lib/sutra/types";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { ScrollProgress } from "./motion/ScrollProgress";

function StatusDot({ name, s }: { name: string; s?: ProviderStatus | undefined }) {
  const tone =
    !s ? "bg-muted-foreground/40" : s.status === "connected" ? "bg-success" : s.status === "mock" ? "bg-warning" : "bg-destructive";
  const label = !s ? "checking…" : s.status === "mock" ? "demo" : s.status;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground hover:bg-secondary">
          <span className="relative flex h-1.5 w-1.5">
            {s?.status === "connected" || s?.status === "mock" ? (
              <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", tone)} />
            ) : null}
            <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", tone)} />
          </span>
          {name}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {name}: {label}
        {s?.model ? ` · ${s.model}` : ""}
      </TooltipContent>
    </Tooltip>
  );
}

export function Nav() {
  const { lang, setLang, reset, stage } = useSutra();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let alive = true;
    const ping = () => api.health().then((h) => alive && setHealth(h)).catch(() => alive && setHealth({ ok: false, status: "down", app: "sutra", providers: { groq: { status: "error" }, gnani: { status: "error" } } }));
    ping();
    const t = setInterval(ping, 30_000);
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-300",
          scrolled || stage !== "idle" ? "glass border-b border-border/70" : "border-b border-transparent",
        )}
      >
        <nav className="mx-auto flex h-16 max-w-[1720px] items-center gap-4 px-5 sm:px-8 xl:px-12">
          <button onClick={reset} className="cursor-pointer" aria-label="Sutra home">
            <Logo />
          </button>

          {stage === "idle" && (
            <div className="ml-6 hidden items-center gap-1 text-sm text-muted-foreground md:flex">
              {[
                ["#demo", "Demo"],
                ["#how", "How it works"],
                ["#features", "Features"],
                ["#faq", "FAQ"],
              ].map(([href, l]) => (
                <a key={href} href={href} className="rounded-full px-3 py-1.5 transition-colors hover:bg-secondary hover:text-foreground">
                  {l}
                </a>
              ))}
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center lg:flex">
              <StatusDot name="Groq" s={health?.providers?.groq} />
              <StatusDot name="Gnani" s={health?.providers?.gnani} />
            </div>

            <div role="radiogroup" aria-label="Language" className="relative flex rounded-full border border-border bg-surface p-0.5 shadow-soft">
              {LANGS.map((l) => (
                <button
                  key={l.id}
                  role="radio"
                  aria-checked={lang === l.id}
                  onClick={() => setLang(l.id)}
                  className={cn(
                    "relative z-10 cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-colors sm:px-3",
                    lang === l.id ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {lang === l.id && (
                    <motion.span layoutId="lang-pill" className="absolute inset-0 -z-10 rounded-full bg-primary" transition={{ type: "spring", stiffness: 500, damping: 35 }} />
                  )}
                  <span className="hidden sm:inline">{l.label}</span>
                  <span className="sm:hidden">{l.short}</span>
                </button>
              ))}
            </div>

            <Button size="sm" onClick={reset} className="hidden sm:inline-flex">
              <Plus /> {STRINGS[lang].newIdea}
            </Button>
          </div>
        </nav>
        {stage === "idle" && <ScrollProgress />}
        {isDemoMode && stage !== "idle" && (
          <div className="border-t border-border/60 py-1 text-center text-[11px] text-muted-foreground">
            Demo mode — responses are simulated in your browser.
          </div>
        )}
      </header>
    </TooltipProvider>
  );
}
