import { useEffect, useState } from "react";

/** Seconds remaining until `until` (epoch ms). Ticks once a second, returns 0 when done or unset. */
export function useCountdown(until: number | null): number {
  const calc = () => (until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0);
  const [left, setLeft] = useState(calc);
  useEffect(() => {
    setLeft(calc());
    if (!until) return;
    const id = window.setInterval(() => {
      const s = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) window.clearInterval(id);
    }, 500);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [until]);
  return left;
}
