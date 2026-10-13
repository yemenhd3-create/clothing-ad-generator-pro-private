/**
 * True when the web app is running inside the Android (Capacitor) shell rather
 * than in a normal browser tab. Inside the shell the page is served from the
 * phone itself (https://localhost) and talks to the remote server explicitly.
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (import.meta.env.DEV) return false;
  const { protocol, hostname } = window.location;
  return protocol === 'capacitor:' || protocol === 'ionic:' || hostname === 'localhost' || hostname === '127.0.0.1';
}
