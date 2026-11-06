// Experiment B (지역페이지형): nationwide 시도 → 시군구 → 읍면동 URLs for 선불폰/알뜰폰.
// Data only. Rendering lives in src/components/experiments/RegionPage.astro.
// URL segments come from the reviewed seo-lab/regions/url-lock.json and the evidence gate is the
// same one used by scripts/generate-regional-pages.mjs (checked by scripts/seo-experiments/test-units.mjs).
import { experimentConfig, projectRoot, readJson, routeProblems } from "./common.js";
import { evidenceEligibility, findNearDuplicatePairs, regionSegment } from "../../../scripts/regional-pages-lib.mjs";
import { createSourceVerifier, renderVerifiedLocalFact } from "../../../scripts/regional-source-verifier.mjs";
import { buildCatalogIntentExamples } from "../../../scripts/regional-content-engine.mjs";

export const REGION_TYPES = [
  { key: "prepaid", name: "선불폰", guides: [
    { path: "/선불폰/", label: "앤텔레콤 선불폰 개통방법 전체 안내" },
    { path: "/앤텔레콤-바로유심-선불폰-개통방법/", label: "KT 바로유심 선불폰 개통방법" },
    { path: "/앤텔레콤-원칩-선불폰-개통방법/", label: "LG 원칩 선불폰 개통방법" }
  ] },
  { key: "mvno", name: "알뜰폰", guides: [
    { path: "/알뜰폰/", label: "앤텔레콤 알뜰폰 개통방법 전체 안내" },
    { path: "/guide/", label: "유심 준비물과 개통 순서" },
    { path: "/number-transfer/", label: "번호이동 방법과 조건" }
  ] }
];

const SIDO_SHORT = { "11": "서울", "12": "전남광주", "26": "부산", "27": "대구", "28": "인천", "30": "대전", "31": "울산", "36": "세종",
  "41": "경기", "43": "충북", "44": "충남", "47": "경북", "48": "경남", "50": "제주", "51": "강원", "52": "전북" };

export const regionEmitMode = (env = process.env) => {
  const settings = experimentConfig().experiments.B;
  const mode = String(env[settings.emitEnv] || settings.emit || "all").trim();
  if (!["all", "candidates"].includes(mode)) throw new Error(`[B] ${settings.emitEnv} must be 'all' or 'candidates'`);
  return mode;
};

let cache;
export const buildRegionalModel = ({ now = Date.now() } = {}) => {
  if (cache) return cache;
  const source = readJson("seo-lab/regions/administrative-areas.json");
  const lock = readJson("seo-lab/regions/url-lock.json");
  const evidence = readJson("seo-lab/regions/evidence.json");
  const coverage = readJson("seo-lab/regions/coverage-manifest.json");
  const snapshots = readJson("seo-lab/regions/source-snapshots.json");
  const prepaidPlans = readJson("src/data/research/prepaid-plans.json");
  const mvnoPlans = readJson("src/data/research/plans.json");
  if (source.areas.length !== coverage.expectedAreaRecords || source.dataVersion !== coverage.dataVersion)
    throw new Error("[B] administrative source differs from reviewed coverage manifest");
  const verifier = createSourceVerifier(projectRoot, snapshots);
  const verify = (item, settings) => verifier.verify(item, settings);
  const catalogExamples = buildCatalogIntentExamples({ prepaidPlans, mvnoPlans });
  const productIds = { prepaid: new Set(prepaidPlans.map(p => p.id)), mvno: new Set(mvnoPlans.map(p => p.id)) };
  const segment = (level, code, name) => {
    const item = lock.segments?.[level + ":" + code];
    if (!item || item.name !== name || item.segment !== regionSegment(name, code)) throw new Error("[B] URL lock mismatch " + level + ":" + code);
    return item.segment;
  };

  const provinces = new Map(), districts = new Map();
  for (const a of source.areas) {
    if (!provinces.has(a.provinceCode)) provinces.set(a.provinceCode, { code: a.provinceCode, name: a.province, short: SIDO_SHORT[a.provinceCode] });
    if (!districts.has(a.districtCode)) districts.set(a.districtCode, { code: a.districtCode, name: a.district, provinceCode: a.provinceCode });
  }
  for (const p of provinces.values()) if (!p.short) throw new Error("[B] missing short name for province " + p.code);

  const pages = [], byPath = new Map();
  const add = page => {
    if (byPath.has(page.path)) throw new Error("[B] URL collision " + page.path);
    const problems = routeProblems(page.path);
    if (problems.length) throw new Error(`[B] invalid route ${page.path} (${problems.join(", ")})`);
    pages.push(page); byPath.set(page.path, page);
    if (page.parentPath) byPath.get(page.parentPath).children.push(page.path);
    return page;
  };
  for (const type of REGION_TYPES) {
    const base = "/regions/" + type.key + "/";
    add({ experiment: "B", type: type.key, typeName: type.name, level: "root", code: "root", path: base, parentPath: null, children: [],
      label: "전국", title: `전국 ${type.name} 개통 지역 안내 | 앤텔레콤`, h1: `전국 ${type.name} 개통 지역 안내`,
      description: `시도별 ${type.name} 개통 지역 안내 목록입니다. 지역 고유 정보는 출처 검수 후에만 게시합니다.` });
    for (const p of provinces.values()) {
      add({ experiment: "B", type: type.key, typeName: type.name, level: "sido", code: p.code, path: base + segment("sido", p.code, p.name) + "/",
        parentPath: base, children: [], label: p.name,
        title: `${p.short} ${type.name} 개통 지역 안내 | 앤텔레콤`, h1: `${p.name} ${type.name} 개통 지역 안내`,
        description: `${p.name} 시군구별 ${type.name} 개통 안내 목록입니다. 지역 고유 정보는 검수 후 게시합니다.` });
    }
    for (const d of districts.values()) {
      const p = provinces.get(d.provinceCode);
      const parentPath = base + segment("sido", p.code, p.name) + "/";
      add({ experiment: "B", type: type.key, typeName: type.name, level: "sgg", code: d.code, path: parentPath + segment("sgg", d.code, d.name) + "/",
        parentPath, children: [], label: d.name,
        title: `${d.name} ${type.name} 개통 지역 안내 | ${p.short}`, h1: `${p.name} ${d.name} ${type.name} 개통 지역 안내`,
        description: `${p.short} ${d.name} 읍면동별 ${type.name} 개통 안내 목록입니다.` });
    }
    for (const a of source.areas) {
      const p = provinces.get(a.provinceCode), d = districts.get(a.districtCode);
      const parentPath = base + segment("sido", p.code, p.name) + "/" + segment("sgg", d.code, d.name) + "/";
      const verifyForArea = (item, settings) => verify(item, { ...settings, expectedScopeCode: a.code });
      const gate = evidenceEligibility(evidence.regions?.[type.key + ":" + a.code], now, { regionCode: a.code, productIds: productIds[type.key], verifySource: verifyForArea });
      gate.localEvidence = gate.localEvidence.map(item => ({ ...item, sourceValue: verify(item, { editorial: true }).sourceValue }));
      gate.productEvidence = gate.productEvidence.map(item => ({ ...item, sourceValue: verify(item).sourceValue }));
      const catalog = catalogExamples.find(item => item.pageType === type.key);
      const attached = new Set(gate.productEvidence.map(item => item.productId));
      if (gate.eligible && catalog && !catalog.products.every(id => attached.has(id))) {
        gate.eligible = false; gate.reasons.push("intent_template_product_evidence_incomplete");
      }
      const localFacts = gate.localEvidence.map(renderVerifiedLocalFact).filter(Boolean);
      gate.generatedContent = gate.eligible && catalog ? [catalog.body, ...localFacts].join("\n\n") : "";
      add({ experiment: "B", type: type.key, typeName: type.name, level: "emd", code: a.code, path: parentPath + segment("emd", a.code, a.locality) + "/",
        parentPath, children: [], label: a.locality, fullName: a.fullName, regionTerms: [a.fullName, p.name, d.name, a.locality],
        title: `${a.locality} ${type.name} 개통 안내 | ${p.short} ${d.name}`, h1: `${p.short} ${d.name} ${a.locality} ${type.name} 개통 안내`,
        description: `${a.fullName} ${type.name} 개통 안내 후보입니다. 지역 고유 정보는 출처 검수 후 게시합니다.`,
        gate, catalogTitle: catalog?.title || null });
    }
  }

  const eligible = pages.filter(page => page.level === "emd" && page.gate.eligible);
  const similar = findNearDuplicatePairs(eligible.map(page => ({ id: page.type + ":" + page.code, text: page.gate.generatedContent, regionTerms: page.regionTerms })));
  for (const page of eligible) if (similar.duplicateIds.has(page.type + ":" + page.code)) {
    page.gate.eligible = false; page.gate.generatedContent = ""; page.gate.reasons.push("near_duplicate_regional_copy");
  }
  for (const page of pages) {
    page.indexCandidate = page.level === "emd" && page.gate.eligible;
    page.effectiveIndex = page.indexCandidate ? "index" : "noindex";
    page.gateReasons = page.level === "emd" ? page.gate.reasons : ["hub_editorial_review_required"];
    page.guides = REGION_TYPES.find(t => t.key === page.type).guides;
    const crumbs = [];
    for (let cursor = page; cursor; cursor = cursor.parentPath ? byPath.get(cursor.parentPath) : null) crumbs.unshift({ name: cursor.level === "root" ? `전국 ${page.typeName}` : cursor.label, path: cursor.path });
    page.crumbs = crumbs;
  }
  cache = { pages, byPath, duplicatePairs: similar.pairs, sourceAttribution: source.sourceAttribution, dataVersion: source.dataVersion };
  return cache;
};

// Pages actually emitted as HTML. "candidates" keeps only index candidates and the hubs above them.
export const emittedRegionalPages = (env = process.env) => {
  const model = buildRegionalModel();
  if (regionEmitMode(env) === "all") return model.pages;
  const keep = new Set();
  for (const page of model.pages.filter(p => p.indexCandidate)) for (const crumb of page.crumbs) keep.add(crumb.path);
  return model.pages.filter(page => keep.has(page.path));
};
