import { useState } from "react";
import type { Lang } from "../api/types";
import { LANG_LABEL, LANG_ORDER, t } from "../lib/i18n";
import { IconClose, IconMenu, IconPlus } from "./Icons";
import { Logo } from "./Logo";

interface Props {
  lang: Lang;
  onLang: (l: Lang) => void;
  inWorkspace: boolean;
  onNewIdea: () => void;
  onStartSpeaking: () => void;
}

export function Nav({ lang, onLang, inWorkspace, onNewIdea, onStartSpeaking }: Props) {
  const [open, setOpen] = useState(false);

  const links = inWorkspace ? null : (
    <>
      <a href="#how" onClick={() => setOpen(false)}>{t(lang, "navHow")}</a>
      <a href="#examples" onClick={() => setOpen(false)}>{t(lang, "navExamples")}</a>
      <a href="#features" onClick={() => setOpen(false)}>{t(lang, "navFeatures")}</a>
    </>
  );

  return (
    <header className="nav">
      <div className="nav-inner">
        <Logo />
        <nav className={`nav-links ${open ? "open" : ""}`} aria-label="Primary">
          {links}
        </nav>
        <div className="nav-right">
          <div className="seg" role="group" aria-label="Language">
            {LANG_ORDER.map((l) => (
              <button
                key={l}
                type="button"
                className={l === lang ? "on" : ""}
                aria-pressed={l === lang}
                onClick={() => onLang(l)}
                lang={l === "hi" ? "hi" : "en"}
              >
                {LANG_LABEL[l]}
              </button>
            ))}
          </div>
          {inWorkspace ? (
            <button type="button" className="btn btn-light btn-sm" onClick={onNewIdea}>
              <IconPlus size={16} /> <span className="hide-sm">{t(lang, "newIdea")}</span>
            </button>
          ) : (
            <button type="button" className="btn btn-light btn-sm nav-cta" onClick={onStartSpeaking}>
              {t(lang, "startSpeaking")}
            </button>
          )}
          {!inWorkspace && (
            <button
              type="button"
              className="icon-btn menu-btn"
              aria-label="Menu"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              {open ? <IconClose /> : <IconMenu />}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
