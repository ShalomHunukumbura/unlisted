"use client";

import { Monitor, Moon, Sun } from "@phosphor-icons/react";
import { useSyncExternalStore } from "react";

import { THEME_KEY } from "@/lib/theme";

type Theme = "system" | "light" | "dark";
const NEXT: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Theme, string> = { system: "Theme: as your device", light: "Theme: light", dark: "Theme: dark" };
const SHORT: Record<Theme, string> = { system: "Device", light: "Light", dark: "Dark" };

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const read = (): Theme => {
  const t = document.documentElement.dataset.theme;
  return t === "light" || t === "dark" ? t : "system";
};

/** One button in the header: as the device, then light, then dark. `labelled` adds the words, for the phone menu. */
export default function ThemeToggle({ labelled = false }: { labelled?: boolean }) {
  // The server can't know; it renders the "system" icon until hydration.
  const theme = useSyncExternalStore(subscribe, read, () => "system" as Theme);

  function cycle() {
    const next = NEXT[theme];
    if (next === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try {
      if (next === "system") localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage blocked: the choice lasts until the page is closed.
    }
    listeners.forEach((fn) => fn());
  }

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`${LABEL[theme]}. Change theme`}
      title={LABEL[theme]}
      className={`rounded-[10px] text-muted transition-colors hover:bg-hover hover:text-ink-strong ${
        labelled ? "inline-flex items-center gap-2 px-3 py-2 text-[15px] font-medium" : "grid size-9 place-items-center"
      }`}
    >
      <Icon aria-hidden size={18} />
      {labelled && <span aria-hidden>Theme: {SHORT[theme]}</span>}
    </button>
  );
}
