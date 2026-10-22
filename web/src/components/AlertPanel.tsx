import { PRIMARY } from "./ui";

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
    <main id="main" className="mx-auto w-full min-w-0 max-w-lg px-4 pb-24 pt-14 sm:pt-24">
      <section className="rise rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-9">
        <p className="inline-flex rounded-md bg-accent-soft px-2 py-1 text-xs font-medium text-accent-ink">{eyebrow}</p>
        <h1 className="mt-4 text-balance text-2xl font-semibold tracking-[-0.03em] text-ink-strong sm:text-3xl">{title}</h1>
        <div className="mt-3 text-pretty text-[15px] leading-relaxed text-ink">{children}</div>
      </section>
    </main>
  );
}

export const buttonClass = `${PRIMARY} mt-6`;
