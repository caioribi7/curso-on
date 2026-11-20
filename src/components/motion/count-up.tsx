"use client";

import { useEffect, useRef } from "react";

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");

/**
 * A number that counts to its new value when it changes (XP after a lesson,
 * score in practice). The first render shows the value as is, so SSR matches.
 * The animation writes the text node directly; React always renders the final value.
 */
export function CountUp({ value, duration = 700 }: { value: number; duration?: number }) {
  const el = useRef<HTMLSpanElement>(null);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    const node = el.current;
    // Counting is not movement, so it runs even with "reduce motion" on.
    if (!node || start === value) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      node.textContent = fmt(start + (value - start) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      node.textContent = fmt(value);
    };
  }, [value, duration]);

  return (
    <span ref={el} className="tabular-nums">
      {fmt(value)}
    </span>
  );
}
