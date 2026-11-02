import fs from "node:fs";
import path from "node:path";
import pages from "../src/data/generated-pages.json" with { type: "json" };
import seed from "../seo-lab/seed.json" with { type: "json" };

const out = path.resolve("seo-lab-regions-preview");
const summary = JSON.parse(fs.readFileSync(path.join(out, "build-summary.json"), "utf8"));
const registry = JSON.parse(fs.readFileSync(path.join(out, "url-registry.json"), "utf8"));
const discovery = JSON.parse(fs.readFileSync(path.join(out, "url-discovery.json"), "utf8"));
const flow = JSON.parse(fs.readFileSync(path.join(out, "index-flow.json"), "utf8"));
const errors = [];
const paths = new Set();
const require = (condition, message) => { if (!condition) errors.push(message); };
const routeFile = route => path.join(out, route.slice(1), "index.html");
require(pages.length === 500, "Existing generated page count changed from 500.");
require(summary.totalStaticPages === 7664, "Expected 7,664 review pages from current source snapshot.");
require(summary.previewSitemapUrls === summary.totalStaticPages, "Preview sitemap count does not match generated files.");
require(summary.editorialSitemapUrls === 0, "Empty evidence registry should produce zero editorial candidates.");
require(summary.submittedUrls === 0 && summary.crawledUrls === 0 && summary.indexedUrls === 0, "Unobserved state was reported as a search result.");
require(registry.pages.length === summary.totalStaticPages, "URL registry count mismatch.");
require(discovery.records.length === summary.totalStaticPages, "URL discovery count mismatch.");
require(flow.records.length === summary.totalStaticPages, "Index flow count mismatch.");
require(summary.countsByType.prepaid.totalStaticPages === 3832 && summary.countsByType.mvno.totalStaticPages === 3832, "Expected 3,832 pages per page type.");
require(summary.countsByType.prepaid.editorialIndexCandidates === 0 && summary.countsByType.mvno.editorialIndexCandidates === 0, "Unexpected candidate despite empty evidence.");
const xml = fs.readFileSync(path.join(out, "preview-candidate-sitemap.xml"), "utf8");
require([...xml.matchAll(/<loc>/g)].length === summary.totalStaticPages, "Preview sitemap XML URL count mismatch.");
const editorialXml = fs.readFileSync(path.join(out, "editorial-index-candidates-sitemap.xml"), "utf8");
require([...editorialXml.matchAll(/<loc>/g)].length === 0, "Editorial sitemap should be empty.");
for (const p of registry.pages) {
  require(!paths.has(p.path), "Duplicate generated path: " + p.path);
  paths.add(p.path);
  const file = routeFile(p.path);
  require(fs.existsSync(file), "Missing preview HTML: " + p.path);
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, "utf8");
  require((html.match(/<h1\b/gi) || []).length === 1, "Expected one H1: " + p.path);
  require(html.includes('<meta name="robots" content="noindex,follow">'), "Missing noindex: " + p.path);
  require(html.includes('<link rel="canonical" href="' + p.canonical + '">'), "Canonical mismatch: " + p.path);
  require(html.includes("운영 사이트 경로에 연결되지 않음"), "Preview status label missing: " + p.path);
  for (const hit of html.matchAll(/href="([^"]+)"/g)) {
    const link = hit[1];
    if (/^(https?:|#|mailto:)/.test(link)) continue;
    const target = path.resolve(path.dirname(file), link);
    const targetFile = target.endsWith(".html") ? target : path.join(target, "index.html");
    require(fs.existsSync(targetFile), "Broken local link in " + p.path + ": " + link);
  }
}
for (const record of flow.records) {
  require(record.submission.status === "not_submitted", "Unexpected submission state: " + record.path);
  require(record.crawl.status === "unobserved", "Unexpected crawl observation: " + record.path);
  require(record.googleIndex.status === "unobserved", "Unexpected Google index observation: " + record.path);
  require(record.searchPerformance.impressions === null && record.searchPerformance.clicks === null, "Unexpected performance observation: " + record.path);
}
const labSeed = JSON.parse(fs.readFileSync("seo-lab/seed.json", "utf8"));
require(labSeed.keywords.length === 6, "A experiment must retain 6 keyword seeds.");
require(labSeed.regions.length === 5, "B experiment must retain 5 preview seeds.");
require(labSeed.blogs.length === 1, "C experiment must retain 1 original URL.");
const result = { passed: errors.length === 0, existingPostpaidPages: pages.length, aExperimentSeeds: labSeed.keywords.length, bExperimentSeeds: labSeed.regions.length, cExperimentSeeds: labSeed.blogs.length, regionalStaticPages: summary.totalStaticPages, generatedFiles: summary.totalStaticPages, editorialIndexCandidates: summary.editorialSitemapUrls, searchSubmitted: summary.submittedUrls, searchObservedIndexed: summary.indexedUrls, errors: errors.length, errorSample: errors.slice(0, 30) };
console.log(JSON.stringify(result, null, 2));
if (errors.length) process.exitCode = 1;
