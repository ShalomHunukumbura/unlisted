/**
 * Shared class names, so the same kind of control looks the same everywhere.
 *
 * Shape rule: controls (buttons, chips, inputs, selects) are 10px; cards and
 * panels 16px; tags 6px. Nothing is a pill.
 */

/** Page width and gutters, the same on every page. */
export const PAGE = "mx-auto w-full min-w-0 max-w-6xl px-4 sm:px-6";

/** A page's h1. */
export const H1 = "text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-ink-strong sm:text-5xl";

/** A section's h2. */
export const H2 = "text-balance text-2xl font-semibold tracking-[-0.025em] text-ink-strong sm:text-[1.75rem]";

/** The lead paragraph under an h1. */
export const LEAD = "max-w-[62ch] text-pretty text-base leading-relaxed text-ink sm:text-[17px]";

/** A raised panel: lists, forms, the job page's apply card. */
export const CARD = "rounded-2xl border border-line bg-surface shadow-card";

const CHIP_BASE =
  "inline-flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-[13px] font-medium transition-[color,background-color,border-color,transform] duration-200";

/** A small action: Email me, Notify this device, RSS, Install app. */
export const CHIP = `${CHIP_BASE} border-line bg-surface text-ink hover:border-line-strong hover:text-ink-strong active:scale-[0.97] disabled:opacity-60`;
/** The same, switched on (notifications on). */
export const CHIP_ON = `${CHIP_BASE} border-accent/40 bg-accent-soft text-accent-ink active:scale-[0.97] disabled:opacity-60`;
/** The same, unavailable (notifications blocked). */
export const CHIP_OFF = `${CHIP_BASE} border-line bg-surface text-muted`;

/** The one filled button on a screen. */
export const PRIMARY =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-accent px-5 py-2.5 text-sm font-medium text-accent-fg shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(13_20_33/0.12)] transition-[background-color,transform] duration-200 hover:bg-accent-hover active:scale-[0.98] disabled:opacity-60";

/** The quieter button beside it. */
export const SECONDARY =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink-strong transition-[background-color,border-color,transform] duration-200 hover:border-line-strong hover:bg-hover active:scale-[0.98] disabled:opacity-60";

/** A text link inside copy. */
export const LINK =
  "font-medium text-accent-ink underline decoration-accent/30 underline-offset-4 transition-colors hover:decoration-current";

/** Text inputs and selects. */
export const FIELD =
  "w-full min-w-0 rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink-strong transition-[border-color,box-shadow] duration-200 placeholder:text-muted hover:border-line-strong focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15";

/** A form label, above its field. */
export const LABEL = "text-[13px] font-medium text-ink-strong";
