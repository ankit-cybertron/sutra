// Original wordmark: three descending lines (a thread) + "Sutra". Swap in src/brand.ts.
import { BRAND } from "../brand";

export function Logo() {
  return (
    <a className="logo" href="#top" aria-label={`${BRAND.name} home`}>
      <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        <path d="M5 9h22M5 16h15M5 23h8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span>{BRAND.name}</span>
    </a>
  );
}
