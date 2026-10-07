"use client";

import { useEffect } from "react";

/** Registers /sw.js: needed to install the site as an app and for push alerts. */
export default function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error) => {
      console.error("service worker registration failed", error);
    });
  }, []);
  return null;
}
