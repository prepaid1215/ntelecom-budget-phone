import fs from "node:fs";
import { spawnSync } from "node:child_process";

const evidencePath = "seo-lab/regions/evidence.json";
const source = JSON.parse(fs.readFileSync("seo-lab/regions/administrative-areas.json", "utf8"));
const original = fs.readFileSync(evidencePath);
const areas = source.areas.slice(0, 3);
if (areas.length < 3) throw new Error("Regional pipeline fixture needs at least three source records.");
const today = new Date().toISOString().slice(0, 10);
const commonCopy = "지역에서 확인한 행정 정보와 통신 서비스 이용 절차를 설명합니다. 고객은 주소에 맞는 기본 안내를 읽고, 상품 조건과 신청 준비 항목을 서로 다른 공식 근거에서 확인합니다. 특정 지역에서 실제로 제공되는 사항만 본문에 담고 일반적인 상품 조건과 지역에 한정된 사실을 구분합니다. 신청 전에 확인할 정보의 기준과 출처를 함께 표시해 정확한 선택을 돕습니다. ";
const distinctCopy = "월 납부표에서는 기본료, 데이터 제공량, 음성 통화 분수, 문자 건수, 충전 주기와 만료일을 나란히 적습니다. 잔액 차감 순서와 사용량 소진 뒤 제한 속도를 읽고, 기기 잠금 상태나 주파수 대역에 따른 호환 목록을 대조합니다. 예산에 맞춰 월 비용과 필요한 통화량을 계산한 다음 숫자로 비교해 선택합니다. ";
const local = area => ({
  status: "verified", ownerApproved: true, sourceUrl: "https://example.gov.kr/areas/" + area.code,
  sourceLabel: "공식 행정 자료", checkedAt: today,
  scopeCode: area.code,
  fact: area.fullName + "의 행정구역 식별코드 " + area.code + "를 행정동 자료에서 확인했습니다. 이 출처는 지역 안내의 적용 범위를 식별하는 데 사용합니다."
});
const product = type => ({
  status: "verified", ownerApproved: true, sourceUrl: "https://example.gov.kr/products/" + type,
  sourceLabel: "공식 상품 자료", checkedAt: today,
  productId: type === "prepaid" ? "ntelecom-prepaid-pl23bt241" : "ntelecom-k-7gb-coupang-cash",
  fact: type + " 상품의 이용 조건과 가입에 필요한 항목은 공식 상품 안내의 최신 내용을 기준으로 정리했습니다."
});
const record = (area, type, copy) => ({
  ownerApproved: true,
  localEvidence: [local(area)],
  productEvidence: [product(type)],
  approvedCopy: copy
});
const fixture = {
  schemaVersion: 1,
  policy: { localEvidenceMaxAgeDays: 180, productEvidenceMaxAgeDays: 90, minimumApprovedCopyCharacters: 260, ownerApprovalRequired: true },
  regions: {
    ["prepaid:" + areas[0].code]: record(areas[0], "prepaid", commonCopy.repeat(2) + areas[0].fullName),
    ["prepaid:" + areas[1].code]: record(areas[1], "prepaid", commonCopy.repeat(2) + areas[1].fullName),
    ["mvno:" + areas[2].code]: record(areas[2], "mvno", distinctCopy.repeat(2) + areas[2].fullName)
  }
};
const run = script => {
  const result = spawnSync(process.execPath, [script], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(script + " failed:\n" + result.stdout + "\n" + result.stderr);
  return result.stdout;
};
try {
  fs.writeFileSync(evidencePath, JSON.stringify(fixture, null, 2) + "\n");
  run("scripts/generate-regional-pages.mjs");
  const registry = JSON.parse(fs.readFileSync("seo-lab-regions-preview/url-registry.json", "utf8"));
  const candidate = registry.pages.find(page => page.editorialIndexCandidate);
  const sitemap = fs.readFileSync("seo-lab-regions-preview/editorial-index-candidates-sitemap.xml", "utf8");
  const sitemapCount = [...sitemap.matchAll(/<loc>/g)].length;
  if (sitemapCount !== registry.pages.filter(page => page.editorialIndexCandidate).length) throw new Error("Generated candidate sitemap mismatch before audit: " + sitemapCount + " vs " + registry.pages.filter(page => page.editorialIndexCandidate).length);
  const candidateHtml = fs.readFileSync("seo-lab-regions-preview/" + candidate.path.slice(1) + "index.html", "utf8");
  if (!candidateHtml.includes('class="editorial-copy"')) throw new Error("Fixture page template omitted approved editorial copy.");
  const candidateEvidence = fixture.regions[candidate.type + ":" + candidate.administrativeCode];
  for (const item of [...candidateEvidence.localEvidence, ...candidateEvidence.productEvidence]) {
    if (!candidateHtml.includes(item.sourceUrl) || !candidateHtml.includes(item.fact)) throw new Error("Fixture evidence is not rendered before the auditor: " + item.fact);
  }
  const output = run("scripts/audit-regional-pages.mjs");
  const report = JSON.parse(output.slice(output.indexOf("{")));
  if (!report.passed || report.editorialIndexCandidates !== 1 || report.nearDuplicateCopyPairs < 1)
    throw new Error("Fixture did not prove dynamic candidate acceptance and near-duplicate rejection:\n" + output);
  console.log(JSON.stringify({ passed: true, dynamicCandidates: report.editorialIndexCandidates, similarCopiesHeld: report.nearDuplicateCopyPairs }, null, 2));
} finally {
  fs.writeFileSync(evidencePath, original);
  run("scripts/generate-regional-pages.mjs");
}
