/**
 * A cookie set next to the profile's when the profile has an email address,
 * and readable by the page's script. It only says "signed in", so the header
 * can show it without every page asking the server.
 */
export const SIGNED_IN = "unlisted_signed_in";

/** In the browser: is this device signed in? (A hint for what to show; the server checks the real cookie.) */
export function signedInHere(): boolean {
  return document.cookie.split("; ").includes(`${SIGNED_IN}=1`);
}

const CHANGED = "unlisted:session";

/** For useSyncExternalStore: the header listens, so it's right without a page load. */
export function onSessionChange(listener: () => void): () => void {
  window.addEventListener(CHANGED, listener);
  return () => window.removeEventListener(CHANGED, listener);
}

export function sessionChanged() {
  window.dispatchEvent(new Event(CHANGED));
}
