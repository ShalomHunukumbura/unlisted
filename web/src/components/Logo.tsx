/** The mark (the app icon, src/app/icon.svg) and the name beside it. */
export default function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const box = size === "lg" ? "size-9" : "size-7";
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg aria-hidden viewBox="0 0 32 32" className={`${box} shrink-0`}>
        <rect width="32" height="32" rx="8" className="fill-accent" />
        <path d="M10 8v9.5a6 6 0 0 0 12 0V8" fill="none" strokeWidth="3" strokeLinecap="round" className="stroke-accent-fg" />
        <rect x="7" y="24" width="18" height="2.5" rx="1.25" className="fill-accent-fg opacity-60" />
      </svg>
      <span className={`font-semibold tracking-[-0.03em] text-ink-strong ${size === "lg" ? "text-2xl" : "text-[19px]"}`}>
        Unlisted
      </span>
    </span>
  );
}
