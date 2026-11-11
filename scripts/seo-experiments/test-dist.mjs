// Built-HTML tests for experiments A/B/C. Run after `pnpm run build` with the same env.
//   SITE_URL=... PRODUCTION_READY=true node --test scripts/seo-experiments/test-dist.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { experimentConfig, readJson, routeProblems, siteState, toSiteUrlFor } from "../../src/lib/seo-experiments/common.js";
import { buildExperimentRegistry, experimentSitemapEntries } from "../../src/lib/seo-experiments/registry.js";
import { anchors, distRoot, htmlRoutes, localRoute, mainText, meta, overlapText, RENDERED_OVERLAP_LIMIT, sharedTrigramRatio, sitemapLocs, trigramSet } from "./dist-lib.mjs";
import { buildLinkManifest } from "./link-manifest.mjs";

const root = distRoot();
const state = siteState();
const registry = buildExperimentRegistry();
const routes = htmlRoutes(root);
const generated = readJson("src/data/generated-pages.json");
const postpaidGuides = readJson("src/data/a-postpaid-landings.json");
const read = route => fs.readFileSync(routes.get(route), "utf8");
const expectedRobots = page => state.productionReady && page.effectiveIndex === "index" ? "index,follow" : "noindex,follow";

test("every built HTML file has exactly one owner and every registered route is built", () => {
  const owners = new Map(registry.owners);
  owners.set("/404/", "existing");
  owners.set("/start/", "conversion");
  owners.set("/guides/", "postpaid-guide-hub");
  for (const guide of postpaidGuides) owners.set(guide.path, "postpaid-A");
  const unowned = [...routes.keys()].filter(r => !owners.has(r));
  const unbuilt = [...owners.keys()].filter(r => !routes.has(r));
  assert.deepEqual(unowned, []);
  assert.deepEqual(unbuilt, []);
  assert.equal(routes.size, generated.length + 2 + 1 + 1 + registry.pages.length + 1 + postpaidGuides.length);
});

test("experiment routes are valid URLs (NFC, lowercase, no stray characters)", () => {
  for (const page of registry.pages) assert.deepEqual(routeProblems(page.path), [], page.path);
});

test("canonical, og:url, robots, googlebot, title and single H1 on every experiment page", () => {
  const problems = [];
  for (const page of registry.pages) {
    const m = meta(read(page.path));
    const canonical = toSiteUrlFor(state, page.path);
    if (m.canonical !== canonical) problems.push(`${page.path} canonical ${m.canonical}`);
    if (m.ogUrl !== canonical) problems.push(`${page.path} og:url`);
    if (m.robots !== expectedRobots(page)) problems.push(`${page.path} robots ${m.robots} != ${expectedRobots(page)}`);
    if (m.googlebot !== m.robots) problems.push(`${page.path} googlebot`);
    if (m.title !== page.title) problems.push(`${page.path} title`);
    if (m.h1s.length !== 1 || m.h1s[0] !== page.h1) problems.push(`${page.path} h1 ${JSON.stringify(m.h1s)}`);
    if (problems.length > 20) break;
  }
  assert.deepEqual(problems, []);
});

test("sitemap.xml = existing index pages + experiment index candidates only", () => {
  const locs = sitemapLocs(root);
  assert.equal(new Set(locs).size, locs.length, "duplicate sitemap URL");
  const existing = state.productionReady
    ? [...generated.filter(p => p.effectiveIndex === "index").map(p => p.path), "/선불폰/", "/알뜰폰/", ...postpaidGuides.filter(p => p.effectiveIndex === "index").map(p => p.path), "/guides/"].map(p => toSiteUrlFor(state, p)) : [];
  const experiments = experimentSitemapEntries().map(e => e.loc);
  assert.deepEqual(locs, [...existing, ...experiments], "existing entries must keep their order and experiments are appended");
  for (const loc of locs) {
    assert.equal(new URL(loc).origin, new URL(state.origin).origin, loc);
    const route = localRoute(new URL(loc).pathname, state.basePath);
    assert.ok(routes.has(route), "sitemap URL not built: " + loc);
    assert.equal(meta(read(route)).robots, "index,follow", "noindex page in sitemap: " + loc);
  }
  const noindexExperiment = registry.pages.filter(p => p.effectiveIndex !== "index").map(p => toSiteUrlFor(state, p.path));
  assert.ok(noindexExperiment.every(u => !locs.includes(u)));
});

test("robots.txt keeps noindex experiment pages crawlable (noindex must be seen to apply)", () => {
  const robots = fs.readFileSync(path.join(root, "robots.txt"), "utf8");
  if (state.productionReady) {
    assert.match(robots, /^Allow: \/$/m);
    assert.match(robots, /^Sitemap: /m);
    for (const prefix of ["/regions/", "/indexkit/", "/%EC%95%A4"]) assert.ok(!robots.includes("Disallow: " + prefix));
  } else {
    if(new URL(state.origin).hostname==="prepaid1215.github.io"){
      assert.match(robots, /^Allow: \/$/m);
      assert.doesNotMatch(robots, /^Sitemap:/m);
    }else assert.match(robots, /^Disallow: \/$/m);
    assert.equal(sitemapLocs(root).length, 0);
  }
});

test("internal links on experiment pages resolve to built routes", () => {
  const broken = [];
  for (const page of registry.pages) for (const a of anchors(read(page.path))) {
    const route = localRoute(a.href, state.basePath);
    if (route && !routes.has(route)) broken.push(`${page.path} -> ${a.href}`);
  }
  assert.deepEqual(broken.slice(0, 20), []);
});

test("titles are unique across the whole site", () => {
  const seen = new Map(), dups = [];
  for (const [route, file] of routes) {
    const title = meta(fs.readFileSync(file, "utf8")).title;
    if (seen.has(title)) dups.push(`${title}: ${seen.get(title)} / ${route}`); else seen.set(title, route);
  }
  assert.deepEqual(dups, []);
});

test("A: exhaustive rendered overlap — every index candidate stays under the limit, pinned demotions are current", () => {
  const candidates = registry.landings.pages.filter(p => p.indexCandidate);
  const existingIndexable = [...generated.filter(p => p.effectiveIndex === "index" && p.path !== "/").map(p => p.path), "/", "/선불폰/", "/알뜰폰/"];
  const grams = new Map([...existingIndexable, ...registry.landings.pages.map(p => p.path)].map(p => [p, trigramSet(overlapText(read(p)))]));
  const over = [];
  for (const page of candidates) for (const other of [...existingIndexable, ...candidates.map(c => c.path).filter(p => p !== page.path)]) {
    const ratio = sharedTrigramRatio(grams.get(page.path), grams.get(other));
    if (ratio > RENDERED_OVERLAP_LIMIT) over.push(`${page.path} ~ ${other}: ${ratio.toFixed(3)}`);
  }
  assert.deepEqual(over, [], "index candidate overlaps an indexable page; run a-review.mjs --write-demotions and rebuild");
  const pinned = readJson("src/data/seo-experiments/a-rendered-overlap.json").demoted;
  for (const item of pinned) {
    const page = registry.landings.pages.find(p => p.path === item.path);
    assert.ok(page && !page.indexCandidate, "pinned demotion not applied: " + item.path);
    assert.ok(sharedTrigramRatio(grams.get(item.path), grams.get(item.with)) > RENDERED_OVERLAP_LIMIT, "stale demotion (content changed, re-review): " + item.path);
  }
});

test("B: generated vs emitted vs index-candidate counts are tracked separately", () => {
  const { counts } = registry;
  assert.equal(counts.B.generatedUrls, 7664);
  assert.equal(counts.B.indexCandidates, 0);
  const emitted = [...routes.keys()].filter(r => r.startsWith("/regions/")).length;
  assert.equal(emitted, counts.B.emittedHtml);
  assert.equal(emitted, counts.B.emitMode === "all" ? 7664 : 0);
  for (const page of registry.emittedRegions.filter((_, i) => i % 97 === 0)) {
    const html = read(page.path);
    assert.equal(meta(html).robots, "noindex,follow", page.path);
    assert.match(html, /지역 정보 검수 대기|지역 목록/, page.path);
  }
});

test("C: built HTML links exactly the expected treatment placements and never control/unassigned URLs", () => {
  const manifest = buildLinkManifest({ root });
  assert.deepEqual(manifest.errors, []);
  assert.equal(manifest.counts.controlOrUnassignedLinked, 0);
  const allHtml = [...routes.values()].map(f => fs.readFileSync(f, "utf8")).join("\n");
  for (const t of registry.indexkit.source.targets.filter(t => t.group !== "treatment")) assert.ok(!allHtml.includes(t.url.replace("https://m.", "")), "pending/control URL leaked: " + t.url);
});

test("existing 500 pages keep their robots decision", () => {
  for (const page of generated.filter(p => p.path !== "/").filter((_, i) => i % 7 === 0))
    assert.equal(meta(read(page.path)).robots, state.productionReady && page.effectiveIndex === "index" ? "index,follow" : "noindex,follow", page.path);
});

test("observation config: windows 7/14/28 and both engines", () => {
  assert.deepEqual(experimentConfig().observationWindowsDays, [7, 14, 28]);
  assert.deepEqual(experimentConfig().engines, ["google", "naver"]);
});
