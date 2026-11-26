/* The link a player shares (owner 2026-11-26): the real domain's landing page with the campaign tags that say where the visit came from.
   utm_medium is the channel that carried it: line (the LINE share), native (the phone's share sheet), copy (the clipboard), facebook (the Facebook share dialog).
   Plain strings only, so the landing's own bundle never has to import this file (nothing here pulls the app in). */
export const SHARE_LANDING = "https://www.tigaalpha.com/landing/";
export const SHARE_HOST = "www.tigaalpha.com";   // what a share IMAGE prints (a picture cannot be tapped)
export type ShareMedium = "line" | "native" | "copy" | "facebook";
export const shareUrl = (medium: ShareMedium): string => SHARE_LANDING + "?utm_source=share&utm_medium=" + medium;
