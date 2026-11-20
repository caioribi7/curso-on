"use client";

import { useState, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

/** Effective theme: the cookie choice (data-theme) or, without one, the system's. */
function current(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  mq.addEventListener("change", onChange);
  return () => {
    obs.disconnect();
    mq.removeEventListener("change", onChange);
  };
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  // Server render has no way to know the system theme: start as "light" and let the client correct it.
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";
  // Only animate the icon after a click, not on hydration.
  const [clicked, setClicked] = useState(false);

  function apply() {
    document.documentElement.dataset.theme = next;
    // One year; read by the root layout so the server renders the right theme.
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  function toggle() {
    setClicked(true);
    const html = document.documentElement;
    if (document.startViewTransition) {
      // Cross-fade the whole page (see .vt-theme in globals.css). Opacity only,
      // so it also runs with "reduce motion" on.
      html.classList.add("vt-theme");
      const vt = document.startViewTransition(apply);
      vt.finished.finally(() => html.classList.remove("vt-theme"));
      return;
    }
    // Fallback: colors ease for a moment.
    html.classList.add("theme-fade");
    apply();
    setTimeout(() => html.classList.remove("theme-fade"), 350);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={next === "dark" ? "Ativar tema escuro" : "Ativar tema claro"}
      title={next === "dark" ? "Tema escuro" : "Tema claro"}
      className={`flex size-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink hover:bg-canvas active:scale-90 ${className}`}
    >
      {theme === "dark" ? (
        // Sun
        <svg key="sun" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className={clicked ? "anim-icon" : undefined}>
          <circle cx="12" cy="12" r="4.5" fill="#FFC93C" />
          <g stroke="#FFC93C" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
          </g>
        </svg>
      ) : (
        // Moon
        <svg key="moon" width="20" height="20" viewBox="0 0 24 24" aria-hidden className={clicked ? "anim-icon" : undefined}>
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" fill="#3B5BFD" />
        </svg>
      )}
    </button>
  );
}
