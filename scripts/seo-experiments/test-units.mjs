// Unit tests for the experiment libraries (no build needed).  node --test scripts/seo-experiments/test-units.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { routeProblems } from "../../src/lib/seo-experiments/common.js";
import { buildLandingModel, slugPattern } from "../../src/lib/seo-experiments/landings.js";
import { buildRegionalModel, emittedRegionalPages } from "../../src/lib/seo-experiments/regions.js";
import { assignBatch, buildIndexKitModel, normalizeNaverBlogUrl, validateIndexKitData } from "../../src/lib/seo-experiments/indexkit.js";
import { assertNoRouteConflicts, buildExperimentRegistry, existingRoutes } from "../../src/lib/seo-experiments/registry.js";
import { evaluateUnit, legacyRegionalEvents, summarizeRows, validateEvent } from "../../src/lib/seo-experiments/observations.js";
import { buildObservationUnits } from "../../src/lib/seo-experiments/units.js";

const fakeTargets = (n, batch = "test-b1") => Array.from({ length: n }, (_, i) => ({
  id: "ik-" + String(9000 + i).padStart(4, "0"), url: `https://m.blog.naver.com/ikfixture/22400000000${String(i).padStart(2, "0")}`,
  batch, addedAt: "2026-11-03", label: null, summary: null, group: null, assignment: null, placements: ["list"] }));
const kitData = (targets, batches = [{ id: "test-b1", title: "테스트 묶음", intro: "테스트용 링크 목록입니다.", carrierRobots: "index", createdAt: "2026-11-03", publishedAt: null }]) =>
  ({ schemaVersion: 1, batches, targets });

test("route hygiene rejects malformed paths", () => {
  assert.deepEqual(routeProblems("/앤텔레콤-바로유심-선불폰-개통방법/"), []);
  for (const bad of ["/no-trailing", "/Upper/", "/a b/", "/a--b/", "/-a/", "/a?x=1/", "/a/../b/", "/%EC%95/"]) assert.ok(routeProblems(bad).length, bad);
  assert.ok(routeProblems("/\u1100\u1161/").includes("not NFC normalized"));
});

test("A slug patterns follow the two documented formats", () => {
  assert.equal(slugPattern("/앤텔레콤-다이소유심-개통방법/"), "A");
  assert.equal(slugPattern("/앤텔레콤-원칩-개통-모델코드-입력-방법/"), "B");
  assert.equal(slugPattern("/다이소유심-개통방법/"), null);
  assert.equal(slugPattern("/앤텔레콤/개통방법/"), null);
});

test("A landings: 9 generated, 6 index candidates, 2 intent collisions, 1 pinned rendered-overlap demotion", () => {
  const { pages, duplicatePairs } = buildLandingModel();
  assert.equal(pages.length, 9);
  const candidates = pages.filter(p => p.indexCandidate).map(p => p.id).sort();
  assert.deepEqual(candidates, ["daiso-usim", "happycall-check", "kt-barousim-prepaid", "lg-onechip-prepaid", "naverpay-7gb-mvno", "onechip-modelcode-entry"]);
  assert.deepEqual(pages.find(p => p.id === "prepaid-396-plan").gateReasons, ["rendered_overlap_with:/앤텔레콤-원칩-선불폰-개통방법/"]);
  assert.equal(pages.find(p => p.id === "brand-choice").intentOwner, "/");
  assert.equal(pages.find(p => p.id === "prepaid-overall").intentOwner, "/선불폰/");
  assert.equal(duplicatePairs.length, 0);
  for (const p of pages) {
    assert.ok([...p.title].length <= 40 || !p.indexCandidate, p.path);
    assert.ok([...p.description].length <= 80, p.path);
    assert.ok(!/\{\{|\}\}/.test(p.bodyText), "unresolved catalog token in " + p.path);
    assert.ok(!p.bodyText.includes("후불"), "후불 must not appear in user copy (repo convention): " + p.path);
  }
});

test("route conflicts are detected", () => {
  const existing = new Set(["/", "/plans/", "/guide/"]);
  assert.throws(() => assertNoRouteConflicts(existing, [{ experiment: "A", path: "/guide/" }], ["/regions/"]), /Route conflict/);
  assert.throws(() => assertNoRouteConflicts(existing, [{ experiment: "B", path: "/x/" }, { experiment: "C", path: "/x/" }], []), /Route conflict/);
  assert.throws(() => assertNoRouteConflicts(existing, [], ["/plans/"]), /shadows existing/);
  assert.throws(() => assertNoRouteConflicts(existing, [{ experiment: "A", path: "/regions/" }], ["/regions/"]), /shadows an experiment prefix/);
  assert.doesNotThrow(() => assertNoRouteConflicts(existingRoutes(), buildExperimentRegistry().pages, ["/regions/", "/indexkit/"]));
});

test("B: 7,664 URLs generated, 0 index candidates, candidates mode emits nothing", () => {
  const { pages, duplicatePairs } = buildRegionalModel();
  assert.equal(pages.length, 7664);
  assert.deepEqual(Object.fromEntries(["root", "sido", "sgg", "emd"].map(l => [l, pages.filter(p => p.level === l).length])), { root: 2, sido: 32, sgg: 512, emd: 7118 });
  assert.equal(pages.filter(p => p.indexCandidate).length, 0);
  assert.ok(pages.every(p => p.effectiveIndex === "noindex"));
  assert.equal(duplicatePairs.length, 0);
  assert.equal(new Set(pages.map(p => p.title)).size, pages.length);
  assert.ok(pages.every(p => [...p.title].length <= 40 && [...p.description].length <= 80));
  assert.ok(pages.filter(p => p.level === "emd").every(p => p.gateReasons.includes("verified_region_evidence_missing")));
  assert.equal(emittedRegionalPages({ SEO_REGIONS_EMIT: "candidates" }).length, 0);
  assert.equal(emittedRegionalPages({ SEO_REGIONS_EMIT: "all" }).length, 7664);
  assert.throws(() => emittedRegionalPages({ SEO_REGIONS_EMIT: "everything" }), /must be/);
});

test("B paths and candidate set match the review generator's url-registry", { skip: !fs.existsSync("seo-lab-regions-preview/url-registry.json") }, () => {
  const preview = JSON.parse(fs.readFileSync("seo-lab-regions-preview/url-registry.json", "utf8")).pages;
  const { pages } = buildRegionalModel();
  assert.deepEqual(pages.map(p => p.path).sort(), preview.map(p => p.path).sort());
  assert.deepEqual(pages.filter(p => p.indexCandidate).map(p => p.path).sort(), preview.filter(p => p.editorialIndexCandidate).map(p => p.path).sort());
});

test("C: Naver blog URL normalization", () => {
  const want = "https://m.blog.naver.com/ntelecom59/224462343217";
  for (const raw of [want, "https://blog.naver.com/ntelecom59/224462343217", "http://m.blog.naver.com/NTelecom59/224462343217?referrerCode=0#x",
    "https://blog.naver.com/PostView.naver?blogId=ntelecom59&logNo=224462343217", "https://m.blog.naver.com/PostView.nhn?blogId=ntelecom59&logNo=224462343217",
    "https://blog.naver.com/ntelecom59?Redirect=Log&logNo=224462343217"]) assert.equal(normalizeNaverBlogUrl(raw), want, raw);
  for (const bad of ["https://in.naver.com/x/contents/1", "https://m.blog.naver.com/ntelecom59", "https://blog.naver.com.evil.com/a/224462343217",
    "ftp://blog.naver.com/a/224462343217", "not a url", "https://m.blog.naver.com/ntelecom59/abc"]) assert.throws(() => normalizeNaverBlogUrl(bad), Error, bad);
});

test("C: assignment is deterministic, balanced and frozen", () => {
  const a = assignBatch(fakeTargets(11), "seed", "2026-11-03");
  const b = assignBatch(fakeTargets(11).reverse(), "seed", "2026-11-03");
  const groupOf = list => Object.fromEntries(list.map(t => [t.url, t.group]));
  assert.deepEqual(groupOf(a), groupOf(b));
  assert.equal(a.filter(t => t.group === "treatment").length, 6);
  assert.equal(a.filter(t => t.group === "control").length, 5);
  const before = groupOf(a);
  const more = [...a, ...fakeTargets(14).slice(11)];
  assignBatch(more, "seed", "2026-11-04");
  for (const [url, group] of Object.entries(before)) assert.equal(groupOf(more)[url], group, "existing assignment changed");
  assert.notDeepEqual(groupOf(assignBatch(fakeTargets(11), "other-seed", "x")), before);
});

test("C: data validation", () => {
  assert.throws(() => validateIndexKitData(kitData([...fakeTargets(1), { ...fakeTargets(1)[0], id: "ik-9999" }])), /duplicates/);
  assert.throws(() => validateIndexKitData(kitData([{ ...fakeTargets(1)[0], url: "https://blog.naver.com/ikfixture/2240000000000" }])), /stored normalized/);
  assert.throws(() => validateIndexKitData(kitData([{ ...fakeTargets(1)[0], placements: ["contextual"] }])), /summary/);
  assert.throws(() => validateIndexKitData(kitData(fakeTargets(2), [{ id: "test-b1", title: "t", intro: "i", carrierRobots: "index", publishedAt: "2026-11-01" }])), /unassigned/);
  assert.throws(() => validateIndexKitData(kitData(fakeTargets(1), [{ id: "test-b1", title: "t", intro: "i", carrierRobots: "maybe", publishedAt: null }])), /carrierRobots/);
});

test("C: enrolling batch renders no links; balanced batches render treatment only, per carrier arm", () => {
  const real = buildIndexKitModel();
  assert.equal(real.source.targets.length, 1);
  assert.equal(real.batches[0].status, "enrolling");
  assert.equal(real.expectedPlacements.length, 0);
  assert.ok(real.pages.every(p => p.effectiveIndex === "noindex"));

  const targets = [...assignBatch(fakeTargets(10), "s", "2026-11-03"), ...assignBatch(fakeTargets(10, "test-b2").map((t, i) => ({ ...t, id: "ik-" + (9500 + i), url: t.url.replace("ikfixture", "ikfixtureb") })), "s", "2026-11-03")];
  const model = buildIndexKitModel({ data: kitData(targets, [
    { id: "test-b1", title: "색인 링크 묶음", intro: "i", carrierRobots: "index", publishedAt: null },
    { id: "test-b2", title: "비색인 링크 묶음", intro: "i", carrierRobots: "noindex", publishedAt: "2026-11-05" }]) });
  assert.deepEqual(model.batches.map(b => b.status), ["ready", "live"]);
  assert.equal(model.expectedPlacements.length, 10);
  assert.ok(model.expectedPlacements.every(p => targets.find(t => t.url === p.url).group === "treatment"));
  assert.deepEqual(model.pages.map(p => p.effectiveIndex), ["index", "index", "noindex"]);
  assert.deepEqual(model.batches.map(b => b.arm), ["treatment:index-carrier", "treatment:noindex-carrier"]);
});

const units = buildObservationUnits();
const aUnit = [...units.values()].find(u => u.experiment === "A" && u.arm === "index-candidate");
const cUnit = [...units.values()].find(u => u.kind === "target");
const event = (over = {}) => ({ unit: aUnit.unit, engine: "google", stage: "indexed", result: "yes", observedAt: "2026-11-10T03:00:00Z", method: "gsc_url_inspection", source: "GSC URL inspection export 2026-11-10", ...over });

test("observations: validation separates stages and refuses unobservable claims", () => {
  assert.equal(validateEvent(event(), units).stage, "indexed");
  assert.equal(validateEvent(event({ unit: aUnit.unit.replace(/%[0-9A-F]{2}/g, m => m) }), units).unit, aUnit.unit);
  assert.throws(() => validateEvent(event({ unit: "https://example.com/x/" }), units), /not a registered/);
  assert.throws(() => validateEvent(event({ stage: "ranked" }), units), /stage/);
  assert.throws(() => validateEvent(event({ engine: "naver" }), units), /not valid for naver/);
  assert.throws(() => validateEvent(event({ unit: cUnit.unit, method: "gsc_url_inspection" }), units), /own URLs/);
  assert.throws(() => validateEvent(event({ unit: cUnit.unit, stage: "crawled", result: "yes", method: "manual_serp" }), units), /unobservable/);
  assert.equal(validateEvent(event({ unit: cUnit.unit, stage: "crawled", result: "unobservable", method: "manual_serp" }), units).result, "unobservable");
  assert.throws(() => validateEvent(event({ unit: cUnit.unit, stage: "submitted", method: "manual_serp" }), units), /contaminates/);
  assert.throws(() => validateEvent(event({ unit: cUnit.unit, stage: "indexed", result: "no", method: "exact_url_search" }), units), /negative search result/);
  assert.throws(() => validateEvent(event({ stage: "served", method: "gsc_performance" }), units), /need metrics/);
  assert.throws(() => validateEvent(event({ stage: "served", method: "manual_serp", metrics: { impressions: 3, clicks: 0 } }), units), /cannot measure/);
  assert.throws(() => validateEvent(event({ stage: "served", method: "gsc_performance", metrics: { impressions: 1, clicks: 2, rangeStart: "2026-11-03", rangeEnd: "2026-11-09" } }), units), /exceed/);
  assert.throws(() => validateEvent(event({ observedAt: "2026-11-10" }), units), /ISO/);
  assert.throws(() => validateEvent(event({ experiment: "B" }), units), /does not own/);
});

test("observations: 7/14/28-day windows keep unknown and unobservable apart from success", () => {
  const unit = { ...aUnit, startDate: "2026-11-03" };
  const events = [
    event({ stage: "indexed", result: "no", observedAt: "2026-11-02T00:00:00Z" }),
    event({ stage: "crawled", result: "yes", observedAt: "2026-11-06T00:00:00Z" }),
    event({ stage: "indexed", result: "no", observedAt: "2026-11-09T00:00:00Z" }),
    event({ stage: "indexed", result: "yes", observedAt: "2026-11-15T00:00:00Z" }),
    event({ stage: "served", result: "yes", method: "gsc_performance", observedAt: "2026-11-30T00:00:00Z", metrics: { impressions: 40, clicks: 2, rangeStart: "2026-11-03", rangeEnd: "2026-11-29" } }),
    event({ engine: "naver", method: "searchadvisor_report", stage: "indexed", result: "unobservable", observedAt: "2026-11-08T00:00:00Z" })
  ].map(e => validateEvent(e, units));
  const rows = evaluateUnit(unit, events, { windows: [7, 14, 28], today: "2026-12-31" });
  const g = Object.fromEntries(rows.filter(r => r.engine === "google").map(r => [r.windowDays, r]));
  assert.equal(g[7].windowEnd, "2026-11-10");
  assert.equal(g[7].crawled, "yes"); assert.equal(g[7].indexed, "no"); assert.equal(g[7].discovered, null);
  assert.equal(g[14].indexed, "yes"); assert.equal(g[14].indexedFirstYesDay, 12);
  assert.equal(g[14].impressions, null);
  assert.equal(g[28].impressions, 40); assert.equal(g[28].clicks, 2);
  assert.equal(g[7].baselineIndexed, "no");
  const n7 = rows.find(r => r.engine === "naver" && r.windowDays === 7);
  assert.equal(n7.indexed, "unobservable");
  const summary = summarizeRows(rows);
  const naver7 = summary.find(s => s.engine === "naver" && s.windowDays === 7);
  assert.equal(naver7.indexedYes, 0); assert.equal(naver7.indexedUnobservable, 1); assert.equal(naver7.indexedYesRateAmongObserved, null);
  assert.equal(summary.find(s => s.engine === "google" && s.windowDays === 14).indexedYesRateAmongObserved, 1);
  const notStarted = evaluateUnit({ ...aUnit, startDate: null }, events, { windows: [7], today: "2026-12-31" });
  assert.ok(notStarted.every(r => r.windowStatus === "not_started" && r.indexed === null));
  assert.equal(evaluateUnit(unit, events, { windows: [28], today: "2026-11-20" })[0].windowStatus, "in_progress");
});

test("observations: C targets indexed before start are excluded, legacy B ledger maps to stages", () => {
  const unit = { ...cUnit, startDate: "2026-11-10" };
  const pre = validateEvent({ unit: cUnit.unit, engine: "google", stage: "indexed", result: "yes", observedAt: "2026-11-05T00:00:00Z", method: "exact_url_search", source: "manual check log #1" }, units);
  const rows = evaluateUnit(unit, [pre], { windows: [7], today: "2026-12-01", excludeIndexedAtBaseline: true });
  assert.ok(rows.find(r => r.engine === "google").excluded);
  assert.equal(summarizeRows(rows).find(s => s.engine === "google").started, 0);
  const bUnit = [...units.values()].find(u => u.experiment === "B");
  const mapped = legacyRegionalEvents({ events: [{ url: bUnit.unit, type: "googleIndex", observedAt: "2026-11-20T00:00:00Z", source: "https://search.google.com/search-console", data: { status: "not_indexed" } }] }, units);
  assert.equal(mapped.length, 1); assert.equal(mapped[0].stage, "indexed"); assert.equal(mapped[0].result, "no");
});
