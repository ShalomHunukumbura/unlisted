import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-24 sm:py-32">
      <p className="font-mono text-xs uppercase tracking-[0.06em] text-muted">404</p>
      <h1 className="mt-3 font-serif text-4xl leading-tight tracking-[-0.02em] text-ink-strong sm:text-5xl">
        This job isn&apos;t here any more.
      </h1>
      <p className="mt-4 max-w-md text-pretty text-[15px] leading-relaxed text-ink">
        Unlisted only keeps roles from the past week, so older links stop working. The company may
        still be hiring for something similar.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-md bg-ink-strong px-5 py-2.5 text-sm font-medium text-canvas transition-[opacity,transform] duration-200 hover:opacity-85 active:scale-[0.98]"
      >
        See current jobs
      </Link>
    </main>
  );
}
