import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { App as CapApp } from "@capacitor/app";

/* Google actively blocks OAuth sign-in inside an embedded WebView
   ("disallowed_useragent") — a plain `signInWithOAuth()` full-page redirect,
   which works fine on the website, would fail here. The native flow instead
   opens the provider's consent page in the OS's own browser (Browser.open,
   a real Safari/Chrome tab, not this app's WebView) and completes the session
   when the OS redirects back into the app via this custom URL scheme. Must
   match the "Redirect URLs" allow-list in the Supabase Auth dashboard, and
   the CFBundleURLTypes / intent-filter entries in the native projects. */
export const NATIVE_AUTH_REDIRECT = "com.tigaalpha.tigaai://auth-callback";

export async function nativeSignInWith(sb: any, provider: string) {
  const { data, error } = await sb.auth.signInWithOAuth({
    provider,
    options: { redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data || !data.url) throw new Error("no OAuth URL returned");
  await Browser.open({ url: data.url });
}

/* Call once at app startup (native only). Returns a cleanup function, same
   shape as a useEffect teardown. */
export function listenForNativeAuthRedirect(sb: any, onDone: (err: any) => void) {
  if (!Capacitor.isNativePlatform()) return () => {};
  let handle: any = null;
  let cancelled = false;
  CapApp.addListener("appUrlOpen", async (event: any) => {
    if (!event || !event.url || !event.url.startsWith(NATIVE_AUTH_REDIRECT)) return;
    try {
      await Browser.close();
    } catch (e) {}
    try {
      const url = new URL(event.url);
      const oauthError = url.searchParams.get("error_description") || url.searchParams.get("error");
      if (oauthError) { onDone && onDone(new Error(oauthError)); return; }
      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await sb.auth.exchangeCodeForSession(code);
        onDone && onDone(error || null);
      }
    } catch (e) {
      onDone && onDone(e);
    }
  }).then((h) => {
    if (cancelled) { try { h.remove(); } catch (e) {} return; }
    handle = h;
  });
  return () => {
    cancelled = true;
    if (handle) {
      try { handle.remove(); } catch (e) {}
    }
  };
}
