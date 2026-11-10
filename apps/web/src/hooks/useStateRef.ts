import { useCallback, useRef, useState } from "react";

/** useState that also exposes a ref with the latest value, so async voice callbacks never read stale state. */
export function useStateRef<T>(initial: T) {
  const [value, setValue] = useState<T>(initial);
  const ref = useRef<T>(initial);
  const set = useCallback((next: T | ((prev: T) => T)) => {
    const resolved = typeof next === "function" ? (next as (p: T) => T)(ref.current) : next;
    ref.current = resolved;
    setValue(resolved);
  }, []);
  return [value, set, ref] as const;
}
