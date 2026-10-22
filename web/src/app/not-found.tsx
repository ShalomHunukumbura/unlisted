import { ArrowRight } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import { H1, LEAD, PAGE, PRIMARY } from "@/components/ui";

export default function NotFound() {
  return (
    <main id="main" className={`${PAGE} py-24 sm:py-32`}>
      <p className="inline-flex rounded-md bg-hover px-2 py-1 font-mono text-xs font-medium text-ink">404</p>
      <h1 className={`${H1} rise mt-5 max-w-2xl`}>This job isn&apos;t here any more.</h1>
      <p className={`${LEAD} mt-4 max-w-md`}>
        Unlisted only keeps roles from the past 3 days, so older links stop working. The company may
        still be hiring for something similar.
      </p>
      <Link href="/" className={`${PRIMARY} mt-8`}>
        See current jobs
        <ArrowRight aria-hidden size={16} weight="bold" />
      </Link>
    </main>
  );
}
