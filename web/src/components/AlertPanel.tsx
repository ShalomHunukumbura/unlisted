import Link from "next/link";

/** The confirm and unsubscribe pages: one card, one message, at most one button. */
export default function AlertPanel({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main id="main" className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16 pt-10 sm:pt-16">
      <Link href="/" className="font-serif text-4xl leading-none tracking-[-0.02em] text-ink-strong">
        Unlisted
      </Link>
      <section className="mt-10 max-w-xl rounded-xl border border-line bg-surface p-6 sm:p-8">
        <p className="font-mono text-xs uppercase tracking-[0.06em] text-muted">{eyebrow}</p>
        <h1 className="mt-3 text-balance font-serif text-3xl leading-tight tracking-[-0.01em] text-ink-strong">{title}</h1>
        <div className="mt-3 text-pretty text-[15px] leading-relaxed text-ink">{children}</div>
      </section>
    </main>
  );
}

export const buttonClass =
  "mt-6 inline-block rounded-md bg-ink-strong px-5 py-2.5 text-sm font-medium text-canvas transition-[opacity,transform] duration-200 hover:opacity-85 active:scale-[0.98]";
