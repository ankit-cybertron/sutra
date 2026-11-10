import type { Lang } from "../api/types";
import { t } from "../lib/i18n";
import { Logo } from "./Logo";

export function Footer({ lang }: { lang: Lang }) {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <Logo />
          <p className="muted small">{t(lang, "footerTag")}</p>
        </div>
        <p className="muted small">{t(lang, "builtWith")}</p>
      </div>
    </footer>
  );
}
