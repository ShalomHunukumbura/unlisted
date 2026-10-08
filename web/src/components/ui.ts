/**
 * Shared class names, so the same kind of control looks the same everywhere.
 */

const CHIP_BASE =
  "inline-flex items-center gap-1.5 rounded-full border bg-surface px-3 py-1.5 text-xs transition-[color,border-color,transform] duration-200";

/** A small rounded action: Email me, Notify this device, RSS, Install app. */
export const CHIP = `${CHIP_BASE} border-line text-ink hover:border-muted hover:text-ink-strong active:scale-[0.97] disabled:opacity-60`;
/** The same, switched on (notifications on). */
export const CHIP_ON = `${CHIP_BASE} border-ink-strong text-ink-strong active:scale-[0.97] disabled:opacity-60`;
/** The same, unavailable (notifications blocked). */
export const CHIP_OFF = `${CHIP_BASE} border-line text-muted`;

/** The one filled button on a screen. */
export const PRIMARY =
  "inline-flex items-center justify-center gap-2 rounded-full bg-ink-strong px-5 py-2.5 text-sm font-medium text-canvas transition-[opacity,transform] duration-200 hover:opacity-85 active:scale-[0.98]";
