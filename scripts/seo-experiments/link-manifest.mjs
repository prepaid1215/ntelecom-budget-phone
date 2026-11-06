// Experiment C link manifest from the BUILT HTML: every outbound Naver blog link with its page, position,
// anchor text, rel, carrier robots/sitemap status and the shortest internal discovery path.
// Exits 1 if the HTML differs from the registry's expected placements or links any control/unassigned URL.
//   node scripts/seo-experiments/link-manifest.mjs [--out=reports/seo-experiments]
import fs from "node:fs";
import path from "node:path";
import { siteState } from "../../src/lib/seo-experiments/common.js";
import { buildIndexKitModel, normalizeNaverBlogUrl } from "../../src/lib/seo-experiments/indexkit.js";
import { anchors, distRoot, htmlRoutes, localRoute, meta, sitemapLocs } from "./dist-lib.mjs";

export const buildLinkManifest = ({ root = distRoot(), env = process.env } = {}) => {
  const state = siteState(env);
  const model = buildIndexKitModel();
  const routes = htmlRoutes(root);
  const sitemapPaths = new Set(sitemapLocs(root).map(loc => localRoute(new URL(loc).pathname, state.basePath)).filter(Boolean));
  const graph = new Map(), robotsOf = new Map(), found = [];
  for (const [route, file] of routes) {
    const html = fs.readFileSync(file, "utf8");
    robotsOf.set(route, meta(html).robots);
    const edges = new Set();
    for (const a of anchors(html)) {
      const local = localRoute(a.href, state.basePath);
      if (local) { edges.add(local); continue; }
      let host = ""; try { host = new URL(a.href).hostname; } catch {}
      if (!/(^|\.)blog\.naver\.com$/i.test(host)) continue;
      let url = null; try { url = normalizeNaverBlogUrl(a.href); } catch {}
      found.push({ pagePath: route, href: a.href, url, targetId: a.target, position: a.position, anchorText: a.text, rel: a.rel });
    }
    graph.set(route, [...edges]);
  }
  // BFS from crawler entry points this site controls: the home page and sitemap.xml.
  const shortest = new Map();
  const queue = [];
  const seed = (route, via) => { if (routes.has(route) && !shortest.has(route)) { shortest.set(route, [via, route]); queue.push(route); } };
  seed("/", "entry:home");
  for (const route of sitemapPaths) seed(route, "entry:sitemap.xml");
  while (queue.length) {
    const current = queue.shift();
    for (const next of graph.get(current) || []) if (routes.has(next) && !shortest.has(next)) { shortest.set(next, [...shortest.get(current), next]); queue.push(next); }
  }
  const expected = model.expectedPlacements;
  const key = p => [p.url, p.pagePath, p.position].join("|");
  const foundKeys = new Set(found.map(key)), expectedKeys = new Set(expected.map(key));
  const allowed = new Set(expected.map(p => p.url));
  const errors = [];
  for (const p of expected) if (!foundKeys.has(key(p))) errors.push(`missing placement ${p.targetId} on ${p.pagePath} (${p.position})`);
  for (const f of found) {
    if (!f.url) errors.push(`non-post Naver blog link on ${f.pagePath}: ${f.href}`);
    else if (!allowed.has(f.url)) errors.push(`link to non-treatment URL on ${f.pagePath}: ${f.url}`);
    else if (!expectedKeys.has(key(f))) errors.push(`unexpected placement on ${f.pagePath}: ${f.url} (${f.position})`);
    if (f.rel && /nofollow|ugc|sponsored/i.test(f.rel)) errors.push(`treatment link carries rel=${f.rel} on ${f.pagePath}`);
    if (!f.targetId || !f.position) errors.push(`link without data-ik-* attributes on ${f.pagePath}`);
  }
  const batchOf = new Map(model.batches.map(b => [b.id, b]));
  const placements = found.filter(f => f.url && allowed.has(f.url)).map(f => {
    const exp = expected.find(p => key(p) === key(f));
    const carrierPath = shortest.get(f.pagePath) || null;
    return { ...f, batchId: exp?.batchId, carrierRobots: robotsOf.get(f.pagePath), carrierInSitemap: sitemapPaths.has(f.pagePath),
      linkPublishedAt: batchOf.get(exp?.batchId)?.publishedAt || null,
      discoveryPath: carrierPath ? [...carrierPath, f.url] : null, discoveryHops: carrierPath ? carrierPath.length - 1 : null,
      discoverableFromSite: Boolean(carrierPath) };
  });
  for (const p of placements) if (!p.discoverableFromSite) errors.push(`carrier ${p.pagePath} is not reachable from home or sitemap`);
  const controlOrPending = model.source.targets.filter(t => t.group !== "treatment").map(t => t.url);
  return {
    schemaVersion: 1, builtFrom: path.relative(process.cwd(), root), generatedAt: new Date().toISOString(),
    batches: model.batches.map(b => ({ id: b.id, status: b.status, carrierRobots: b.carrierRobots, publishedAt: b.publishedAt, path: b.path,
      carrierRobotsInHtml: robotsOf.get(b.path) ?? null, carrierInSitemap: sitemapPaths.has(b.path), carrierDiscoveryPath: shortest.get(b.path) || null })),
    counts: { expectedPlacements: expected.length, foundNaverLinks: found.length, treatmentTargets: model.source.targets.filter(t => t.group === "treatment").length,
      controlOrUnassignedTargets: controlOrPending.length, controlOrUnassignedLinked: found.filter(f => controlOrPending.includes(f.url)).length },
    placements, errors
  };
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = path.resolve(process.argv.find(a => a.startsWith("--out="))?.slice(6) || "reports/seo-experiments");
  const manifest = buildLinkManifest();
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "indexkit-link-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log(JSON.stringify({ counts: manifest.counts, batches: manifest.batches, errors: manifest.errors }, null, 2));
  if (manifest.errors.length) process.exit(1);
}
