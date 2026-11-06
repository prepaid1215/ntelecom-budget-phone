// All /start/ activation CTAs must stay on the seller's www NTGO mirror.
// Direct network paths were observed during the manual seller-flow walkthrough;
// recheck them in a real mobile browser before publishing to production.
export const MIRROR_ROOT = "https://www.n-telecom.co.kr/ntgo/";
export const MIRROR_KT_URL = new URL("view/open/kt/face_auth.aspx", MIRROR_ROOT).toString();
export const MIRROR_LG_URL = new URL("view/open/lg/face_auth.aspx", MIRROR_ROOT).toString();

// Reject invalid or off-brand overrides instead of silently sending customers
// to a different operator (previously preplan.site).
export function ntgoDestination(override, fallback) {
  try {
    const url = new URL(String(override || "").trim() || fallback);
    if (url.protocol !== "https:" || url.hostname !== "www.n-telecom.co.kr" || !url.pathname.startsWith("/ntgo/")) {
      return fallback;
    }
    return url.toString();
  } catch {
    return fallback;
  }
}
