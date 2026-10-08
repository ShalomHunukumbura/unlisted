"use client";

import { useEffect, useState } from "react";

import { CHIP, CHIP_OFF, CHIP_ON } from "./ui";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

type State = "loading" | "unsupported" | "ios" | "off" | "on" | "denied" | "busy";

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? navigator.serviceWorker.register("/sw.js", { scope: "/" });
}

async function call(
  action: "on" | "off" | "status",
  subscription: PushSubscription,
  filters: Record<string, string>,
  forYou: boolean,
) {
  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, subscription: subscription.toJSON(), filters, forYou }),
  });
  return (await res.json()) as { ok: boolean; message?: string; on?: boolean };
}

/**
 * "Notify this device" for the search on screen: a phone or desktop
 * notification after each hourly update with anything new. iPhones only allow
 * it once the site is added to the home screen, so they get that hint instead.
 */
export default function PushAlert({ filters = {}, forYou = false }: { filters?: Record<string, string>; forYou?: boolean }) {
  const [state, setState] = useState<State>("loading");
  // Subscribing can take seconds (the browser registers with its push service).
  const [turning, setTurning] = useState<"on" | "off">("on");
  // "For you" needs no filters: the profile is what's matched.
  const hasFilters = forYou || Object.keys(filters).length > 0;
  const filtersKey = JSON.stringify(filters);
  // A message belongs to the search it was about; a new search hides it.
  const [note, setNote] = useState<{ search: string; text: string } | null>(null);
  const message = note?.search === filtersKey ? note.text : null;
  const setMessage = (text: string | null) => setNote(text ? { search: filtersKey, text } : null);

  useEffect(() => {
    let cancelled = false;
    const set = (s: State) => !cancelled && setState(s);
    (async () => {
      const supported = KEY && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported) {
        set(/iPhone|iPad|iPod/.test(navigator.userAgent) ? "ios" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") return set("denied");
      if (!hasFilters) return set("off");
      try {
        const sub = await (await registration()).pushManager.getSubscription();
        if (!sub) return set("off");
        const res = await call("status", sub, JSON.parse(filtersKey), forYou);
        set(res.on ? "on" : "off");
      } catch {
        set("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filtersKey, hasFilters, forYou]);

  async function toggle() {
    if (!hasFilters) {
      setMessage("Search or pick a filter first. An alert for every new role would be hundreds a day.");
      return;
    }
    const wasOn = state === "on";
    setTurning(wasOn ? "off" : "on");
    setState("busy");
    setMessage(null);
    try {
      const reg = await registration();
      let sub = await reg.pushManager.getSubscription();
      if (wasOn) {
        if (sub) await call("off", sub, filters, forYou);
        setState("off");
        setMessage(forYou ? "Notifications off for new matches." : "Notifications off for this search.");
        return;
      }
      if ((await Notification.requestPermission()) !== "granted") {
        setState("denied");
        return;
      }
      sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) });
      const res = await call("on", sub, filters, forYou);
      setState(res.ok ? "on" : "off");
      const done = forYou
        ? "Done. You'll get a notification when a new role fits you well."
        : "Done. You'll get a notification when new roles match this search.";
      setMessage(res.ok ? done : res.message ?? null);
    } catch (error) {
      console.error(error);
      setState(wasOn ? "on" : "off");
      // Chrome refuses push in private windows with an AbortError, on purpose
      // with no way to check first.
      setMessage(
        error instanceof DOMException && error.name === "AbortError"
          ? "This browser won't allow notifications here. Private windows don't support them."
          : "Couldn't change notifications. Please try again.",
      );
    }
  }

  if (state === "loading" || state === "unsupported") return null;

  const icon = (
    <svg aria-hidden viewBox="0 0 16 16" className="size-3.5">
      <path
        d="M4 11V7a4 4 0 018 0v4l1.25 1.5H2.75L4 11zM6.5 14a1.6 1.6 0 003 0"
        fill={state === "on" ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (state === "ios") {
    return (
      <span className="text-xs text-muted" title="Safari only allows notifications from apps on the home screen">
        For notifications on iPhone: Share, then Add to Home Screen
      </span>
    );
  }
  if (state === "denied") {
    return (
      <span className={CHIP_OFF} title="Allow notifications for this site in your browser settings">
        {icon}
        Notifications blocked
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={state === "busy"}
        aria-pressed={state === "on"}
        className={state === "on" ? CHIP_ON : CHIP}
      >
        {icon}
        {state === "busy"
          ? `Turning ${turning}…`
          : state === "on"
            ? "Notifying this device"
            : "Notify this device"}
      </button>
      {message && (
        <p role="status" className="basis-full text-xs text-ink sm:text-right">
          {message}
        </p>
      )}
    </>
  );
}
