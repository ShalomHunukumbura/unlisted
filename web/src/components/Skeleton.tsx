import { LIST } from "./JobRow";
import { CARD, PAGE } from "./ui";

/** A grey placeholder bar, pulsing unless motion is reduced. */
export function Bar({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`block rounded-md bg-hover motion-safe:animate-pulse ${className}`} />;
}

/** Rows shaped like JobRow, while a list loads. */
export function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <ul aria-hidden className={LIST}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex gap-4 px-4 py-4 sm:px-5">
          <Bar className="size-10 shrink-0 rounded-[10px]" />
          <div className="flex-1">
            <Bar className={`h-4 ${i % 2 ? "w-1/2" : "w-2/3"}`} />
            <Bar className="mt-2.5 h-3.5 w-1/3" />
            <div className="mt-3 flex gap-1.5">
              <Bar className="h-5 w-24" />
              <Bar className="h-5 w-14" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A page with a heading and a list: the default while anything loads. */
export function SkeletonPage() {
  return (
    <main id="main" className={`${PAGE} pb-24 pt-10 sm:pt-14`}>
      <p className="sr-only" role="status">Loading</p>
      <Bar className="h-10 w-64 sm:h-12" />
      <Bar className="mt-5 h-4 w-full max-w-lg" />
      <Bar className="mt-2.5 h-4 w-2/3 max-w-sm" />
      <div className="mt-10">
        <SkeletonRows />
      </div>
    </main>
  );
}

/** The job page's shape: header, then the description beside the apply card. */
export function SkeletonJob() {
  return (
    <main id="main" className={`${PAGE} pb-24 pt-8 sm:pt-10`}>
      <p className="sr-only" role="status">Loading</p>
      <Bar className="h-4 w-20" />
      <div className="mt-8 flex flex-col gap-5 sm:flex-row">
        <Bar className="size-14 shrink-0 rounded-[10px]" />
        <div className="flex-1">
          <Bar className="h-4 w-40" />
          <Bar className="mt-3 h-9 w-full max-w-xl" />
          <Bar className="mt-2 h-9 w-2/3 max-w-md" />
        </div>
      </div>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
        <div className={`${CARD} h-80 p-5 lg:order-2`}>
          <Bar className="h-12 w-full rounded-[10px]" />
          <Bar className="mt-2.5 h-11 w-full rounded-[10px]" />
        </div>
        <div className="space-y-3 lg:order-1">
          {[100, 92, 96, 70, 0, 88, 94, 60].map((w, i) =>
            w ? <Bar key={i} className="h-4" /> : <div key={i} className="h-4" />,
          )}
        </div>
      </div>
    </main>
  );
}
