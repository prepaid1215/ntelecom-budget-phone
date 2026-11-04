// Helpers for reading the built dist/ HTML (no dependencies).
import fs from "node:fs";
import path from "node:path";

export const distRoot = (dir = process.env.SEO_DIST || "dist") => path.resolve(dir);
export const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
export const routeForFile = (root, file) => {
  const rel = path.relative(root, file).split(path.sep).join("/");
  if (rel === "index.html") return "/";
  if (rel === "404.html") return "/404/";
  return "/" + rel.replace(/index\.html$/, "");
};
export const fileForRoute = (root, route) => path.join(root, ...route.split("/").filter(Boolean), "index.html");
export const htmlRoutes = root => new Map(walk(root).filter(f => f.endsWith(".html")).map(f => [routeForFile(root, f), f]));
export const attr = (html, re) => (html.match(re) || [])[1] ?? null;
export const decodeEntities = s => String(s).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
export const meta = html => ({
  title: decodeEntities(attr(html, /<title>([\s\S]*?)<\/title>/i) ?? ""),
  description: decodeEntities(attr(html, /<meta name="description" content="([^"]*)"/i) ?? ""),
  robots: attr(html, /<meta name="robots" content="([^"]*)"/i),
  googlebot: attr(html, /<meta name="googlebot" content="([^"]*)"/i),
  canonical: attr(html, /<link rel="canonical" href="([^"]*)"/i),
  ogUrl: attr(html, /<meta property="og:url" content="([^"]*)"/i),
  h1s: [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map(m => decodeEntities(m[1].replace(/<[^>]+>/g, "").trim()))
});
export const mainText = html => decodeEntities((attr(html, /<main\b[^>]*>([\s\S]*?)<\/main>/i) || "")
  .replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
// Overlap is judged on page-specific copy: blocks marked data-shared-block (identical notices repeated on every landing) are excluded.
export const overlapText = html => mainText(html.replace(/<section[^>]*data-shared-block=[^>]*>[\s\S]*?<\/section>/gi, " ").replace(/<li[^>]*data-shared-step=[^>]*>[\s\S]*?<\/li>/gi, " "));
export const anchors = html => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map(m => {
  const a = m[1];
  const get = name => decodeEntities((a.match(new RegExp(`\\s${name}="([^"]*)"`, "i")) || [])[1] ?? "") || null;
  return { href: get("href"), rel: get("rel"), target: get("data-ik-target"), position: get("data-ik-position"), text: decodeEntities(m[2].replace(/<[^>]+>/g, "").trim()) };
});
// Local route for an href, or null for external/asset links. Handles percent-encoded Korean paths and BASE_PATH.
export const localRoute = (href, basePath = "/") => {
  if (!href || !href.startsWith("/") || href.startsWith("//")) return null;
  let p = href.split(/[?#]/)[0];
  try { p = decodeURI(p); } catch { return null; }
  if (basePath !== "/") { if (!p.startsWith(basePath)) return null; p = p.slice(basePath.length) || "/"; }
  if (/^\/(_astro|images)\//.test(p) || /\.[a-z0-9]+$/i.test(p)) return null;
  return p.endsWith("/") ? p : p + "/";
};
export const sitemapLocs = root => [...fs.readFileSync(path.join(root, "sitemap.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => decodeEntities(m[1]));

// Exhaustive near-duplicate metric (no LSH sampling): share of the shorter text's character trigrams
// that also occur in the other text, after NFC/lowercase and removing non letters/digits.
export const trigramSet = text => { const c = [...String(text).normalize("NFC").toLocaleLowerCase("ko-KR").replace(/[^\p{L}\p{N}]+/gu, "")], s = new Set();
  for (let i = 0; i + 3 <= c.length; i++) s.add(c.slice(i, i + 3).join("")); return s; };
export const sharedTrigramRatio = (a, b) => { const [s, l] = a.size < b.size ? [a, b] : [b, a]; if (!s.size) return 0; let n = 0; for (const g of s) if (l.has(g)) n++; return n / s.size; };
export const RENDERED_OVERLAP_LIMIT = 0.30;
