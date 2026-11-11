// Shared helpers for SEO experiments A/B/C.
// Used by Astro pages at build time AND by plain Node scripts (tests, reports),
// so JSON is read through fs instead of bundler-only JSON imports.
import fs from "node:fs";
import path from "node:path";

export const projectRoot = process.cwd();
export const readJson = file => JSON.parse(fs.readFileSync(path.resolve(projectRoot, file), "utf8"));

let configCache;
export const experimentConfig = () => (configCache ??= readJson("src/data/seo-experiments/config.json"));

// Mirrors src/lib/site-config.js (which uses bundler JSON imports) so Node scripts agree with the build.
export const siteState = (env = process.env) => {
  const raw = readJson("src/data/site.json");
  const origin = new URL(env.SITE_URL?.trim() || raw.siteUrl);
  origin.pathname = "/"; origin.search = ""; origin.hash = "";
  const cleaned = String(env.BASE_PATH || "/").trim().replace(/^\/+|\/+$/g, "");
  // The published Cloudflare Pages main branch is always a crawlable production build.
  const cloudflareMain = env.CF_PAGES === "1" && env.CF_PAGES_BRANCH === "main";
  const productionReady = cloudflareMain || (env.PRODUCTION_READY === "true" ? true : env.PRODUCTION_READY === "false" ? false : raw.productionReady);
  return { origin: origin.toString(), basePath: cleaned ? "/" + cleaned : "/", productionReady, raw };
};

export const toPublicPathFor = (state, value) => {
  if (!value || /^(?:[a-z]+:|\/\/|#)/i.test(value)) return value;
  const pathname = value.startsWith("/") ? value : "/" + value;
  return state.basePath === "/" ? pathname : state.basePath + pathname;
};
export const toSiteUrlFor = (state, value) => new URL(toPublicPathFor(state, value), state.origin).toString();

export const normalizeKeyword = value => String(value || "").normalize("NFC").toLocaleLowerCase("ko-KR").replace(/[^\p{L}\p{N}]+/gu, "");

// Route hygiene shared by every experiment: NFC, trailing slash, no uppercase ASCII,
// no whitespace/query/fragment/dot segments, no empty or doubled hyphens.
export const routeProblems = route => {
  const problems = [];
  const value = String(route || "");
  if (!value.startsWith("/") || !value.endsWith("/")) problems.push("must start and end with /");
  if (value !== value.normalize("NFC")) problems.push("not NFC normalized");
  if (/[A-Z]/.test(value)) problems.push("uppercase ASCII");
  if (/[\s?#%\\]|\/\/|\/\.\.?\//.test(value)) problems.push("whitespace, query, fragment, encoded or dot segment");
  if (/(^|\/)-|-(\/|$)|--/.test(value)) problems.push("leading, trailing or doubled hyphen in a segment");
  if (/[^\p{L}\p{N}\/\-·]/u.test(value)) problems.push("unsupported character");
  if (Buffer.byteLength(encodeURI(value)) > 512) problems.push("encoded path longer than 512 bytes");
  return problems;
};

export const won = value => new Intl.NumberFormat("ko-KR").format(value) + "원";
export const visibleLength = text => [...String(text || "").replace(/\s+/g, "")].length;
