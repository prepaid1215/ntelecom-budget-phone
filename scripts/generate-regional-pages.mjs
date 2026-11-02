import fs from "node:fs";
import path from "node:path";
import { evidenceEligibility, findNearDuplicatePairs, REGIONAL_CONTENT_SIMILARITY_THRESHOLD, regionSegment } from "./regional-pages-lib.mjs";

const root = process.cwd();
const json = name => JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
const source = json("seo-lab/regions/administrative-areas.json");
const lock = json("seo-lab/regions/url-lock.json");
const evidence = json("seo-lab/regions/evidence.json");
const coverage = json("seo-lab/regions/coverage-manifest.json");
const site = json("seo-lab/seed.json");
const productIds = {
  prepaid: new Set(json("src/data/research/prepaid-plans.json").map(item => item.id)),
  mvno: new Set(json("src/data/research/plans.json").map(item => item.id))
};
const out = path.join(root, "seo-lab-regions-preview");
const generatedAt = new Date().toISOString();
const types = [{ key: "prepaid", name: "선불폰", color: "#ff438b" }, { key: "mvno", name: "알뜰폰", color: "#7258e9" }];
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const escXml = value => String(value).replace(/[<>&'"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
const words = value => (String(value).match(/[\p{L}\p{N}]+/gu) || []).length;
const key = (level, code) => level + ":" + code;
const segment = (level, code, name) => {
  const item = lock.segments?.[key(level, code)];
  if (!item || item.name !== name || item.segment !== regionSegment(name, code)) throw new Error("URL lock mismatch: " + key(level, code));
  return item.segment;
};
if (source.schemaVersion !== 1 || lock.schemaVersion !== 1 || evidence.schemaVersion !== 1 || coverage.schemaVersion !== 1) throw new Error("Unsupported regional data schema.");
if (source.sourceRecordCount !== source.areas.length) throw new Error("Administrative source count mismatch.");
if (source.dataVersion !== coverage.dataVersion || source.areas.length !== coverage.expectedAreaRecords) throw new Error("Source version or administrative record count differs from the reviewed coverage manifest.");

const provinces = new Map();
const districts = new Map();
const seenCodes = new Set();
for (const a of source.areas) {
  if (seenCodes.has(a.code)) throw new Error("Duplicate administrative code " + a.code);
  seenCodes.add(a.code);
  if (!provinces.has(a.provinceCode)) provinces.set(a.provinceCode, { code: a.provinceCode, name: a.province });
  const d = districts.get(a.districtCode);
  if (d && (d.provinceCode !== a.provinceCode || d.name !== a.district)) throw new Error("District code collision " + a.districtCode);
  if (!d) districts.set(a.districtCode, { code: a.districtCode, name: a.district, provinceCode: a.provinceCode, province: a.province });
}
const expectedSido = new Map(coverage.expectedSido.map(item => [item.code, item.name]));
if (provinces.size !== expectedSido.size || [...expectedSido].some(([code, name]) => provinces.get(code)?.name !== name))
  throw new Error("Current province codes/names differ from the reviewed coverage manifest.");
if (districts.size !== coverage.expectedDistrictRecords) throw new Error("District coverage differs from the reviewed coverage manifest.");
const pages = [];
const byPath = new Map();
const children = new Map();
const add = p => {
  if (byPath.has(p.path)) throw new Error("URL collision " + p.path);
  pages.push(p); byPath.set(p.path, p);
};
const child = (parent, target) => {
  const list = children.get(parent) || [];
  list.push(target); children.set(parent, list);
};
for (const type of types) {
  const base = "/regions/" + type.key + "/";
  add({ type, level: "root", code: "root", name: "전국 " + type.name, path: base });
  for (const p of provinces.values()) {
    const pPath = base + segment("sido", p.code, p.name) + "/";
    add({ type, level: "sido", code: p.code, name: p.name, province: p, path: pPath, parentPath: base });
    child(base, pPath);
  }
  for (const d of districts.values()) {
    const p = provinces.get(d.provinceCode);
    const parentPath = base + segment("sido", p.code, p.name) + "/";
    const dPath = parentPath + segment("sgg", d.code, d.name) + "/";
    add({ type, level: "sgg", code: d.code, name: p.name + " " + d.name, province: p, district: d, path: dPath, parentPath });
    child(parentPath, dPath);
  }
  for (const a of source.areas) {
    const p = provinces.get(a.provinceCode);
    const d = districts.get(a.districtCode);
    const parentPath = base + segment("sido", p.code, p.name) + "/" + segment("sgg", d.code, d.name) + "/";
    const aPath = parentPath + segment("emd", a.code, a.locality) + "/";
    const gate = evidenceEligibility(evidence.regions?.[type.key + ":" + a.code], Date.now(), { regionCode: a.code, productIds: productIds[type.key] });
    add({ type, level: "emd", code: a.code, name: a.fullName, province: p, district: d, area: a, path: aPath, parentPath, gate });
    child(parentPath, aPath);
  }
}
const eligibleContentPages = pages.filter(item => item.level === "emd" && item.gate.eligible);
const similar = findNearDuplicatePairs(eligibleContentPages.map(page => ({
  id: page.type.key + ":" + page.code,
  text: page.gate.approvedCopy,
  regionTerms: [page.name, page.province.name, page.district.name, page.area.locality]
})));
for (const page of eligibleContentPages) {
  if (similar.duplicateIds.has(page.type.key + ":" + page.code)) {
    page.gate.eligible = false;
    page.gate.approvedCopy = "";
    page.gate.reasons.push("near_duplicate_regional_copy");
  }
}
const href = (from, to) => {
  const fromFile = path.join(out, from.slice(1), "index.html");
  const toFile = path.join(out, to.slice(1), "index.html");
  let rel = path.relative(path.dirname(fromFile), toFile).split(path.sep).join("/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
};
const metadata = [], discoveries = [], flows = [], previewUrls = [];
fs.rmSync(out, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
for (const p of pages) {
  const parent = p.parentPath ? byPath.get(p.parentPath) : null;
  const label = p.level === "root" ? "전국 " + p.type.name + " 지역 안내" : p.name + " " + p.type.name + " 지역 안내";
  const title = label + " | " + site.domain + " 검수용";
  const canonical = new URL(p.path, site.siteUrl).toString();
  const intro = p.level === "emd"
    ? p.name + " 행정구역의 " + p.type.name + " 안내 후보입니다. 행정구역명은 출처 데이터로 확인했으며, 지역 고유의 서비스 정보는 별도 검수 전입니다."
    : label + "입니다. 하위 행정구역 탐색을 위한 검수용 허브이며 지역별 서비스 정보는 근거 확인 뒤 작성합니다.";
  const list = (children.get(p.path) || []).map(targetPath => {
    const target = byPath.get(targetPath);
    const targetLabel = target.level === "emd" ? target.area.locality : target.name;
    return '<li><a href="' + esc(href(p.path, targetPath)) + '">' + esc(targetLabel + " " + p.type.name + " 지역 안내") + "</a></li>";
  }).join("");
  const parentLink = parent ? '<a class="crumb" href="' + esc(href(p.path, parent.path)) + '">← ' + esc(parent.name) + "</a>" : "";
  const other = types.find(t => t.key !== p.type.key);
  const pending = p.level === "emd"
    ? "확인된 지역 정보와 최신 상품 근거가 등록되지 않았습니다. 지역 사례나 매장·재고·개통 조건을 만들지 않았습니다."
    : "행정구역 탐색을 위한 검수용 허브입니다. 지역 서비스 정보는 근거 확인 뒤 작성합니다.";
  const unique = p.level === "emd" && p.gate.eligible;
  const renderEvidence = (heading, items) => "<section><h2>" + esc(heading) + "</h2><ul>" + items.map(item =>
    '<li><p>' + esc(item.fact) + '</p><small>확인일 ' + esc(item.checkedAt) + ' · <a href="' + esc(item.sourceUrl) + '" rel="noopener noreferrer">' + esc(item.sourceLabel) + "</a></small></li>"
  ).join("") + "</ul></section>";
  const facts = unique
    ? renderEvidence(p.type.key === "prepaid" ? "지역에서 확인된 선불폰 정보" : "지역에서 확인된 알뜰폰 정보", p.gate.localEvidence)
      + renderEvidence(p.type.key === "prepaid" ? "선불 상품 근거" : "알뜰폰 상품 근거", p.gate.productEvidence)
      + '<section class="editorial-copy"><h2>' + esc(p.type.key === "prepaid" ? "지역 선불폰 안내" : "지역 알뜰폰 안내") + "</h2><p>" + esc(p.gate.approvedCopy) + "</p></section>"
    : '<section class="pending"><h2>' + (p.level === "emd" ? "지역별 사실 검수 대기" : "허브 검수 상태") + "</h2><p>" + pending + "</p></section>";
  const evidenceStatus = unique
    ? "지역 정보와 상품 조건을 출처에 연결했고 검수 승인된 안내를 제공합니다."
    : "최신 지역 정보와 상품 근거가 등록될 때까지 색인 후보에서 제외합니다.";
  const sections = p.level === "emd"
    ? "<section><h2>" + p.type.name + " 정보 작성 상태</h2><p>" + evidenceStatus + "</p></section>" + facts
    : "<section><h2>하위 지역 목록</h2>" + (list ? "<ul>" + list + "</ul>" : "<p>연결된 하위 지역이 없습니다.</p>") + "</section>" + facts;
  const html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>' + esc(title) + '</title><meta name="description" content="' + esc(intro) + '"><link rel="canonical" href="' + esc(canonical) + '"><meta property="og:url" content="' + esc(canonical) + '"><meta property="og:title" content="' + esc(title) + '"><style>:root{--brand:' + p.type.color + ';--ink:#171719;--line:#e8e8ec;--muted:#70727a}*{box-sizing:border-box}body{margin:0;font:16px/1.7 -apple-system,BlinkMacSystemFont,"Pretendard","Noto Sans KR",Arial,sans-serif;color:var(--ink)}.wrap{max-width:920px;margin:auto;padding:0 18px}header{border-bottom:1px solid var(--line);padding:14px 0;font-weight:900}.brand{color:var(--brand)}main{padding:28px 0 55px}.badge{display:inline-block;padding:4px 10px;border-radius:999px;color:var(--brand);background:#fff1f6;font-size:12px;font-weight:900}.draft,.pending{margin:14px 0;padding:14px;border:1px solid #efdfb4;border-radius:14px;background:#fff9e9}.draft{font-size:13px;font-weight:800}h1{font-size:clamp(28px,5vw,42px);line-height:1.25;letter-spacing:-1px}main>p{color:#555}.crumb{display:block;margin-bottom:16px;color:var(--muted)}section{margin-top:16px;padding:20px;border:1px solid var(--line);border-radius:18px}section h2{margin:0 0 8px;font-size:20px}ul{columns:2;column-gap:30px;padding-left:22px}li{break-inside:avoid;padding:5px 0}a{color:#373642;font-weight:750;text-decoration:none}.type{display:inline-block;margin:20px 14px 0 0}small{color:var(--muted)}footer{padding:20px 0;background:#f7f7f8;font-size:12px;color:var(--muted)}@media(max-width:600px){ul{columns:1}}</style></head><body><header><div class="wrap"><span class="brand">앤텔레콤 ' + esc(p.type.name) + ' 지역 안내</span> · 색인 보류</div></header><main class="wrap">' + parentLink + '<span class="badge">' + (p.level === "emd" ? "지역 상세 후보" : "행정구역 허브") + '</span><div class="draft">검수용 정적 HTML · noindex · 운영 사이트 경로에 연결되지 않음</div><h1>' + esc(label) + "</h1><p>" + esc(intro) + "</p>" + sections + '<a class="type" href="' + esc(href(p.path, "/regions/" + other.key + "/")) + '">' + esc(other.name + " 전국 허브") + "</a><small>" + esc(source.sourceAttribution) + '</small></main><footer><div class="wrap">URL 발견 및 내부 검수 전용 산출물입니다. 검색 노출이나 색인 여부를 뜻하지 않습니다.</div></footer></body></html>';
  const file = path.join(out, p.path.slice(1), "index.html");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html, "utf8");
  const candidate = p.level === "emd" && unique;
  const reasons = p.level === "emd" ? p.gate.reasons : ["hub_editorial_review_required"];
  metadata.push({ path: p.path, url: canonical, type: p.type.key, level: p.level, administrativeCode: p.code, title, canonical, previewGenerated: true, editorialIndexCandidate: candidate, publishable: false, contentWordCount: words(candidate ? p.gate.approvedCopy : ""), editorialCopy: candidate ? p.gate.approvedCopy : "", localEvidenceCount: candidate ? p.gate.localEvidence.length : 0, productEvidenceCount: candidate ? p.gate.productEvidence.length : 0, gateReasons: reasons });
  previewUrls.push(canonical);
  discoveries.push({ url: canonical, path: p.path, type: p.type.key, level: p.level, administrativeCode: p.code, discoveredVia: p.level === "root" ? "regional-type-root" : p.level === "sido" ? "type-root-hub" : p.level === "sgg" ? "sido-hub" : "sgg-hub", parentPath: parent?.path || null, previewGenerated: true, submittedToSearchEngine: false });
  flows.push({ url: canonical, path: p.path, type: p.type.key, level: p.level, editorialIndexCandidate: candidate, publishable: false, gateReasons: reasons, submission: { status: "not_submitted", timestamp: null, source: null }, crawl: { status: "unobserved", firstSeenAt: null, lastSeenAt: null, source: null }, googleIndex: { status: "unobserved", checkedAt: null, canonicalSelected: null, source: null }, searchPerformance: { impressions: null, clicks: null, rangeStart: null, rangeEnd: null, source: null } });
}
for (const p of pages) for (const target of [...(children.get(p.path) || []), ...(p.parentPath ? [p.parentPath] : [])]) {
  if (!byPath.has(target) || !fs.existsSync(path.join(out, target.slice(1), "index.html"))) throw new Error("Broken link " + p.path + " -> " + target);
}
const sitemap = urls => '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.map(url => "<url><loc>" + escXml(url) + "</loc></url>").join("") + "</urlset>\n";
const countsByType = Object.fromEntries(types.map(t => {
  const typed = pages.filter(p => p.type.key === t.key);
  return [t.key, { rootHubs: typed.filter(p => p.level === "root").length, provinceHubs: typed.filter(p => p.level === "sido").length, districtHubs: typed.filter(p => p.level === "sgg").length, areaPages: typed.filter(p => p.level === "emd").length, totalStaticPages: typed.length, editorialIndexCandidates: metadata.filter(p => p.type === t.key && p.editorialIndexCandidate).length }];
}));
const editorialUrls = metadata.filter(page => page.editorialIndexCandidate).map(page => page.url);
if (editorialUrls.length !== metadata.filter(page => page.editorialIndexCandidate).length) throw new Error("Editorial sitemap URLs differ from candidate registry count.");
const summary = { schemaVersion: 1, generatedAt, output: "seo-lab-regions-preview/ review-only; not connected to Astro, public/, or deployment", sourceDataVersion: source.dataVersion, sourceRecords: source.areas.length, sourceDistricts: districts.size, sourceProvinces: provinces.size, countsByType, contentQuality: { similarityMetric: "character-trigram-jaccard", threshold: REGIONAL_CONTENT_SIMILARITY_THRESHOLD, normalizedRegionAndServiceTerms: true }, totalStaticPages: pages.length, previewSitemapUrls: previewUrls.length, editorialSitemapUrls: editorialUrls.length, searchSubmission: { submittedUrlCount: 0, state: "not_submitted" }, searchObservations: { crawlState: "unobserved", indexedUrlCount: null, checkedAt: null, source: null, impressions: null, clicks: null }, productionRoutesChanged: 0, robotsOrDeploymentSettingsChanged: 0, sourceAttribution: source.sourceAttribution };
fs.writeFileSync(path.join(out, "build-summary.json"), JSON.stringify(summary, null, 2) + "\n");
fs.writeFileSync(path.join(out, "url-registry.json"), JSON.stringify({ schemaVersion: 1, generatedAt, pages: metadata }, null, 2) + "\n");
fs.writeFileSync(path.join(out, "url-discovery.json"), JSON.stringify({ schemaVersion: 1, generatedAt, records: discoveries }, null, 2) + "\n");
fs.writeFileSync(path.join(out, "index-flow.json"), JSON.stringify({ schemaVersion: 1, generatedAt, observationState: "unobserved_until_connected_to_search-console_or-crawl-logs", records: flows }, null, 2) + "\n");
fs.writeFileSync(path.join(out, "preview-candidate-sitemap.xml"), sitemap(previewUrls));
fs.writeFileSync(path.join(out, "editorial-index-candidates-sitemap.xml"), sitemap(editorialUrls));
console.log(JSON.stringify(summary, null, 2));
