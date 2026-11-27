/* The link a player shares (owner 2026-11-26): the real domain's landing page with the campaign tags that say where the visit came from.
   utm_medium is the channel that carried it: line (the LINE share), native (the phone's share sheet), copy (the clipboard), facebook (the Facebook share dialog).
   Plain strings only, so the landing's own bundle never has to import this file (nothing here pulls the app in). */
export const SHARE_LANDING = "https://www.tigaalpha.com/landing/";
export const SHARE_HOST = "www.tigaalpha.com";   // what a share IMAGE prints (a picture cannot be tapped)
export type ShareMedium = "line" | "native" | "copy" | "facebook";
export const MY_REF_KEY = "tg_my_ref";   // this account's own referral code (profiles.referral_code), copied here by App.tsx so a share needs no profile at hand
/* The ONE builder of a shared link (Step 3.4): the landing page of the real domain + the campaign tags + the sharer's referral code when this browser knows it. Every share point calls this. */
export function buildShareUrl({ medium, campaign = "" }: { medium: ShareMedium; campaign?: string }): string {
  let ref = ""; try { ref = (localStorage.getItem(MY_REF_KEY) || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase(); } catch (e) {}
  const camp = String(campaign || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 30);
  return SHARE_LANDING + "?" + (ref ? "ref=" + ref + "&" : "") + "utm_source=share&utm_medium=" + medium + (camp ? "&utm_campaign=" + camp : "");
}
export const shareUrl = (medium: ShareMedium): string => buildShareUrl({ medium });
