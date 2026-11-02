import fs from "node:fs";
import path from "node:path";
import postpaidPages from "../src/data/generated-pages.json" with { type: "json" };
import seed from "../seo-lab/seed.json" with { type: "json" };
import { evidenceEligibility, findNearDuplicatePairs, REGIONAL_CONTENT_SIMILARITY_THRESHOLD } from "./regional-pages-lib.mjs";

const root = process.cwd();
const out = path.resolve("seo-lab-regions-preview");
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
const source = read("seo-lab/regions/administrative-areas.json");
const coverage = read("seo-lab/regions/coverage-manifest.json");
const evidence = read("seo-lab/regions/evidence.json");
const productIds = {
  prepaid: new Set(read("src/data/research/prepaid-plans.json").map(item => item.id)),
  mvno: new Set(read("src/data/research/plans.json").map(item => item.id))
};
const summary = JSON.parse(fs.readFileSync(path.join(out, "build-summary.json"), "utf8"));
const registry = JSON.parse(fs.readFileSync(path.join(out, "url-registry.json"), "utf8"));
const discovery = JSON.parse(fs.readFileSync(path.join(out, "url-discovery.json"), "utf8"));
const flow = JSON.parse(fs.readFileSync(path.join(out, "index-flow.json"), "utf8"));
const errors = [];
const paths = new Set();
const require = (condition, message) => { if (!condition) errors.push(message); };
const routeFile = route => path.join(out, route.slice(1), "index.html");
const expectedProvinceMap = new Map(coverage.expectedSido.map(item => [item.code, item.name]));
const provinces = new Map();
const districts = new Map();
for (const area of source.areas) {
  provinces.set(area.provinceCode, area.province);
  districts.set(area.districtCode, area.district);
}
const perType = 1 + provinces.size + districts.size + source.areas.length;
const expectedTotal = perType * 2;
require(postpaidPages.length === 500, "Existing postpaid page count changed from 500.");
require(source.dataVersion === coverage.dataVersion, "Source data version does not match reviewed coverage manifest.");
require(source.areas.length === coverage.expectedAreaRecords, "Source administrative-area count differs from the reviewed snapshot.");
require(districts.size === coverage.expectedDistrictRecords, "Source district count differs from the reviewed snapshot.");
require(provinces.size === expectedProvinceMap.size && [...expectedProvinceMap].every(([code, name]) => provinces.get(code) === name), "Province coverage differs from the reviewed code/name manifest.");
require(expectedProvinceMap.has("36") && expectedProvinceMap.get("36") === "세종특별자치시", "Sejong is missing from the reviewed province set.");
require(summary.totalStaticPages === expectedTotal, "Generated count does not match counts derived from source data.");
require(summary.sourceRecords === source.areas.length, "Generator summary source count mismatch.");
require(summary.contentQuality?.threshold === REGIONAL_CONTENT_SIMILARITY_THRESHOLD, "Regional similarity threshold is missing or differs from the audit implementation.");
require(summary.previewSitemapUrls === registry.pages.length, "Preview sitemap count differs from generated registry.");
require(summary.editorialSitemapUrls === registry.pages.filter(p => p.editorialIndexCandidate).length, "Editorial sitemap count differs from dynamic candidate count.");
require(registry.pages.length === expectedTotal, "URL registry count differs from source-derived page count.");
require(discovery.records.length === expectedTotal && flow.records.length === expectedTotal, "Discovery/index-flow registry count mismatch.");
for (const type of ["prepaid", "mvno"]) {
  const typePages = registry.pages.filter(p => p.type === type);
  require(typePages.length === perType, type + " page count differs from source-derived count.");
  require(typePages.filter(p => p.level === "root").length === 1, type + " root hub count mismatch.");
  require(typePages.filter(p => p.level === "sido").length === provinces.size, type + " province hub count mismatch.");
  require(typePages.filter(p => p.level === "sgg").length === districts.size, type + " district hub count mismatch.");
  require(typePages.filter(p => p.level === "emd").length === source.areas.length, type + " area-page count mismatch.");
}

const eligibleSourceRecords = [];
const areaByCode = new Map(source.areas.map(area => [area.code, area]));
for (const type of ["prepaid", "mvno"]) for (const area of source.areas) {
  const gate = evidenceEligibility(evidence.regions?.[type + ":" + area.code], Date.now(), { regionCode: area.code, productIds: productIds[type] });
  if (gate.eligible) eligibleSourceRecords.push({ id: type + ":" + area.code, text: gate.approvedCopy, regionTerms: [area.fullName, area.province, area.district, area.locality] });
}
const similarity = findNearDuplicatePairs(eligibleSourceRecords);
const duplicateIds = similarity.duplicateIds;
const candidateCount = registry.pages.filter(p => p.editorialIndexCandidate).length;
require(summary.countsByType.prepaid.editorialIndexCandidates === registry.pages.filter(p => p.type === "prepaid" && p.editorialIndexCandidate).length, "Prepaid candidate summary mismatch.");
require(summary.countsByType.mvno.editorialIndexCandidates === registry.pages.filter(p => p.type === "mvno" && p.editorialIndexCandidate).length, "MVNO candidate summary mismatch.");

const candidateSitemap = fs.readFileSync(path.join(out, "editorial-index-candidates-sitemap.xml"), "utf8");
require([...candidateSitemap.matchAll(/<loc>/g)].length === candidateCount, "Editorial sitemap URL count mismatch (sitemap=" + [...candidateSitemap.matchAll(/<loc>/g)].length + ", registry=" + candidateCount + ").");
const previewSitemap = fs.readFileSync(path.join(out, "preview-candidate-sitemap.xml"), "utf8");
require([...previewSitemap.matchAll(/<loc>/g)].length === expectedTotal, "Preview sitemap URL count mismatch.");
for (const p of registry.pages) {
  require(!paths.has(p.path), "Duplicate generated path: " + p.path);
  paths.add(p.path);
  const file = routeFile(p.path);
  require(fs.existsSync(file), "Missing preview HTML: " + p.path);
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, "utf8");
  require((html.match(/<h1\b/gi) || []).length === 1, "Expected one H1: " + p.path);
  require(html.includes('<meta name="robots" content="noindex,follow">'), "Missing preview noindex: " + p.path);
  require(html.includes('<link rel="canonical" href="' + p.canonical + '">'), "Canonical mismatch: " + p.path);
  require(html.includes("운영 사이트 경로에 연결되지 않음"), "Review-only status missing: " + p.path);
  if (p.level === "emd") {
    const area = areaByCode.get(p.administrativeCode);
    const gate = evidenceEligibility(evidence.regions?.[p.type + ":" + p.administrativeCode], Date.now(), { regionCode: p.administrativeCode, productIds: productIds[p.type] });
    const evidenceKey = p.type + ":" + p.administrativeCode;
    const expectedCandidate = gate.eligible && !duplicateIds.has(evidenceKey);
    require(p.editorialIndexCandidate === expectedCandidate, "Candidate state differs from evidence/uniqueness checks: " + p.path);
    require(p.editorialIndexCandidate === !p.gateReasons.length, "Candidate flag and gate reasons disagree: " + p.path);
    if (p.editorialIndexCandidate) {
      require(p.publishable === false, "Review candidate became publishable without the release gate: " + p.path);
      require(p.editorialCopy === gate.approvedCopy, "Candidate copy differs from approved evidence record: " + p.path);
      require(p.contentWordCount >= 40 && p.editorialCopy.length >= 260, "Candidate content is too thin: " + p.path);
      require((html.match(/class=\"editorial-copy\"/g) || []).length === 1, "Candidate copy section missing: " + p.path);
      for (const item of [...gate.localEvidence, ...gate.productEvidence]) {
        require(html.includes(item.sourceUrl) && html.includes(escHtml(item.fact)), "Evidence not rendered in candidate HTML: " + p.path);
      }
    }
    if (duplicateIds.has(evidenceKey)) {
      require(!p.editorialIndexCandidate && p.gateReasons.includes("near_duplicate_regional_copy"), "Near duplicate was not held from candidate set: " + p.path);
    }
  }
  for (const hit of html.matchAll(/href="([^"]+)"/g)) {
    const link = hit[1];
    if (/^(https?:|#|mailto:)/.test(link)) continue;
    const target = path.resolve(path.dirname(file), link);
    const targetFile = target.endsWith(".html") ? target : path.join(target, "index.html");
    require(fs.existsSync(targetFile), "Broken local link in " + p.path + ": " + link);
  }
}
const flowByPath = new Map(flow.records.map(record => [record.path, record]));
for (const page of registry.pages) {
  const record = flowByPath.get(page.path);
  require(!!record, "Index-flow record missing: " + page.path);
  if (!record) continue;
  require(record.editorialIndexCandidate === page.editorialIndexCandidate, "Index-flow candidate mismatch: " + page.path);
  require(record.submission.status === "not_submitted", "Unexpected submission state: " + page.path);
  require(record.crawl.status === "unobserved" && record.googleIndex.status === "unobserved", "Unobserved search state was reported as observed: " + page.path);
  require(record.searchPerformance.impressions === null && record.searchPerformance.clicks === null, "Unobserved performance values must stay null: " + page.path);
}
const labSeed = read("seo-lab/seed.json");
require(labSeed.keywords.length === 6 && labSeed.regions.length === 5 && labSeed.blogs.length === 1, "SEO A/B/C experiment seeds changed.");
const result = {
  passed: errors.length === 0,
  sourceDataVersion: source.dataVersion,
  currentProvinceCount: provinces.size,
  previousProvinceCountBeforeGwangjuJeonnamMerger: 17,
  sejongIncluded: expectedProvinceMap.has("36"),
  sourceDistrictCount: districts.size,
  sourceAreaRecords: source.areas.length,
  existingPostpaidPages: postpaidPages.length,
  aExperimentSeeds: labSeed.keywords.length,
  bExperimentSeeds: labSeed.regions.length,
  cExperimentSeeds: labSeed.blogs.length,
  regionalGeneratedPages: registry.pages.length,
  editorialIndexCandidates: candidateCount,
  nearDuplicateCopyPairs: similarity.pairs.length,
  submittedUrls: 0,
  crawlAndIndexState: "unobserved",
  errors: errors.length,
  errorSample: errors.slice(0, 30)
};
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;

function escHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
