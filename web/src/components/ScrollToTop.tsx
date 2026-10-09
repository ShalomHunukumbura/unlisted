"use client";

import { useEffect, useState } from "react";

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > 400);
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Scroll to top"
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        })
      }
      className="fixed right-4 bottom-4 z-40 inline-flex size-11 items-center justify-center rounded-full bg-ink-strong text-canvas shadow-sm transition-transform hover:-translate-y-0.5 active:scale-95 sm:right-6 sm:bottom-6"
    >
      <svg aria-hidden viewBox="0 0 20 20" className="size-5">
        <path
          d="M10 15V5m0 0L5.75 9.25M10 5l4.25 4.25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
