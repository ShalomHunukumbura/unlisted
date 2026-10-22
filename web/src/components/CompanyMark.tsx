/**
 * A company's initials in a tile: something to scan by in a long list, until
 * there are real logos. Neutral on purpose; colour on this site means something.
 */
export default function CompanyMark({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const words = name.replace(/[^\p{L}\p{N} ]/gu, "").trim().split(/\s+/);
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-[10px] border border-line bg-hover font-semibold tracking-[-0.02em] text-ink-strong ${
        size === "lg" ? "size-14 text-lg" : "size-10 text-[13px]"
      }`}
    >
      {initials}
    </span>
  );
}
