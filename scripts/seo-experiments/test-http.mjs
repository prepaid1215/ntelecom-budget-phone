// HTTP access test against dist/ served locally (percent-encoded Korean URLs, 404 handling, sitemap URLs).
//   SITE_URL=... PRODUCTION_READY=true node --test scripts/seo-experiments/test-http.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readJson, siteState } from "../../src/lib/seo-experiments/common.js";
import { buildExperimentRegistry } from "../../src/lib/seo-experiments/registry.js";
import { meta, sitemapLocs, distRoot } from "./dist-lib.mjs";
import { startServer } from "./serve.mjs";

const state = siteState();
const registry = buildExperimentRegistry();
const generated = readJson("src/data/generated-pages.json");
const { server, origin } = await startServer({ dir: distRoot() });
test.after(() => server.close());
const local = route => origin + encodeURI(route);
const get = async url => { const res = await fetch(url, { redirect: "manual" }); return { status: res.status, type: res.headers.get("content-type"), body: await res.text() }; };

const sample = (list, step) => list.filter((_, i) => i % step === 0);
const targets = [
  ...registry.pages,
  ...sample(generated.filter(p => p.path !== "/").map(p => ({ path: p.path, title: null })), 25),
  { path: "/", title: null }, { path: "/선불폰/", title: null }, { path: "/알뜰폰/", title: null }
];

test(`HTTP 200 + text/html + expected title for ${targets.length} pages (all A/C and sampled existing)`, async () => {
  const failures = [];
  for (const page of targets) {
    const r = await get(local(page.path));
    if (r.status !== 200 || !r.type.startsWith("text/html")) failures.push(`${page.path} ${r.status} ${r.type}`);
    else if (page.title && meta(r.body).title !== page.title) failures.push(`${page.path} title`);
  }
  assert.deepEqual(failures, []);
});

test("every sitemap URL is reachable when mapped to the local server", async () => {
  const failures = [];
  for (const loc of sitemapLocs(distRoot())) {
    const u = new URL(loc);
    const r = await get(origin + u.pathname);
    if (r.status !== 200 || meta(r.body).robots !== "index,follow") failures.push(`${loc} ${r.status} ${meta(r.body).robots}`);
  }
  assert.deepEqual(failures, []);
});

test("robots.txt and sitemap.xml are served with correct types", async () => {
  const robots = await get(origin + "/robots.txt");
  assert.equal(robots.status, 200); assert.match(robots.type, /text\/plain/);
  const sitemap = await get(origin + "/sitemap.xml");
  assert.equal(sitemap.status, 200); assert.match(sitemap.type, /xml/);
  if (state.productionReady) assert.ok(robots.body.includes("Sitemap: "));
});

test("unknown and malformed experiment-like URLs return 404, not a page", async () => {
  for (const path of ["/앤텔레콤-없는-개통방법/", "/regions/prepaid/없는시도-99/", "/indexkit/no-such-batch/", "/regions/", "/REGIONS/prepaid/"]) {
    assert.equal((await get(local(path))).status, 404, path);
  }
});
