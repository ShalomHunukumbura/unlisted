"use client";

import { ArrowClockwise } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect } from "react";

import { PRIMARY, SECONDARY } from "@/components/ui";

/** Anything that throws while a page renders: say so, and offer another go. */
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="mx-auto w-full min-w-0 max-w-lg px-4 pb-24 pt-14 sm:pt-24">
      <section className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-9">
        <p className="inline-flex rounded-md bg-red-bg px-2 py-1 text-xs font-medium text-red-ink">Error</p>
        <h1 className="mt-4 text-balance text-2xl font-semibold tracking-[-0.03em] text-ink-strong sm:text-3xl">
          Something went wrong.
        </h1>
        <p className="mt-3 text-pretty text-[15px] leading-relaxed text-ink">
          This page couldn&apos;t load just now. It&apos;s usually a short hiccup reaching the database.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={() => retry()} className={PRIMARY}>
            <ArrowClockwise aria-hidden size={16} weight="bold" />
            Try again
          </button>
          <Link href="/" className={SECONDARY}>
            All jobs
          </Link>
        </div>
      </section>
    </main>
  );
}
