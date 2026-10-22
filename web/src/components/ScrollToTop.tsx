"use client";

import { ArrowUp } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

/**
 * "Back to top", once the page is scrolled past 400px. A marker at 400px is
 * watched rather than every scroll event.
 */
export default function ScrollToTop() {
  const marker = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = marker.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div ref={marker} aria-hidden className="pointer-events-none absolute left-0 top-[400px] size-px" />
      {visible && (
        <button
          type="button"
          aria-label="Scroll to top"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
            })
          }
          className="fixed bottom-4 right-4 z-40 inline-flex size-11 items-center justify-center rounded-[12px] border border-line bg-surface text-ink-strong shadow-card transition-[transform,border-color] hover:-translate-y-0.5 hover:border-line-strong active:scale-95 sm:bottom-6 sm:right-6"
        >
          <ArrowUp aria-hidden size={18} weight="bold" />
        </button>
      )}
    </>
  );
}
