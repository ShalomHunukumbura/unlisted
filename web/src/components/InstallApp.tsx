"use client";

import { useEffect, useState } from "react";

import { CHIP } from "./ui";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** "Install app", shown only when the browser offers it (Chrome, Edge, Samsung Internet). */
export default function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const offer = (e: Event) => {
      e.preventDefault(); // show our button instead of the browser's mini bar
      setPrompt(e as InstallPrompt);
    };
    const installed = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", offer);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", offer);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);

  if (!prompt) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        await prompt.prompt();
        await prompt.userChoice;
        setPrompt(null);
      }}
      className={CHIP}
    >
      <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
        <path d="M8 2.5v7.5M4.75 7L8 10.25 11.25 7M3 13h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Install app
    </button>
  );
}
