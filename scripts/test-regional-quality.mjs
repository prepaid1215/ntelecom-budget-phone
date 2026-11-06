import assert from "node:assert/strict";
import { evidenceEligibility, findNearDuplicatePairs } from "./regional-pages-lib.mjs";

const now = Date.parse("2026-11-02T12:00:00Z");
const validItem = (fact, sourceLabel = "공식 지역 자료", scopeCode = "1111051500", productId = "ntelecom-k-7gb-coupang-cash") => ({
  status: "verified",
  ownerApproved: true,
  sourceUrl: "https://example.gov.kr/source",
  sourceLabel,
  sourceSnapshotId: "isolated-unit-test",
  sourcePointer: "/records/0/value",
  sourceValue: sourceLabel === "공식 상품 자료" ? productId : fact,
  scopePointer: "/records/0/code",
  factType: sourceLabel === "공식 지역 자료" ? "official_store_address" : "product_claim",
  checkedAt: "2026-11-02",
  scopeCode,
  productId,
  fact
});
const baseCopy = "지역의 행정 정보와 이용 환경을 확인해 안내합니다. 통신 상품의 조건은 공식 자료를 기준으로 정리하고, 지역 주민이 신청 전에 살펴볼 항목을 구분합니다. 서비스 범위와 상품 구성은 서로 다른 출처에서 확인하며 해당 지역에 맞는 정보를 제공합니다.".repeat(2);
const record = (scopeCode = "1111051500", productId = "ntelecom-k-7gb-coupang-cash") => ({
  ownerApproved: true,
  localEvidence: [validItem("행정구역 단위 지역 자료에서 확인한 사실이며 해당 자료는 현재 지역의 서비스 안내 범위를 설명합니다.", "공식 지역 자료", scopeCode)],
  productEvidence: [validItem("공식 상품 안내에서 확인한 상품 조건과 이용 항목을 요약했으며 개통 전에 적용할 실제 기준입니다.", "공식 상품 자료", "", productId)],
  approvedCopy: baseCopy
});
const options = { regionCode: "1111051500", productIds: new Set(["ntelecom-k-7gb-coupang-cash"]) };
options.verifySource = (item, settings = {}) => ({
  verified: item.sourceSnapshotId === "isolated-unit-test"
    && (item.sourceValue === item.fact || item.sourceValue === item.productId)
    && item.sourcePointer.startsWith("/")
    && (!item.scopeCode || item.scopePointer === "/records/0/code")
    && (!settings.editorial || item.factType === "official_store_address"),
  sourceValue: item.sourceValue
});
const accepted = evidenceEligibility(record(), now, options);
assert.equal(accepted.eligible, true, "A test-only source resolver can verify protocol behavior; it does not establish real-world evidence.");
assert.equal(evidenceEligibility(undefined, now).eligible, false, "Missing evidence must fail closed.");
assert.ok(evidenceEligibility(record("1111053000"), now, options).reasons.includes("regional_fact_scope_mismatch"), "A local fact scoped to a different area must fail.");
assert.ok(evidenceEligibility(record("1111051500", "unknown-product-id"), now, options).reasons.includes("product_id_unverified_or_unknown"), "An unlisted product must fail.");
assert.ok(evidenceEligibility({ ...record(), localEvidence: [validItem("행정구역 단위 지역 자료에서 확인한 사실이며 해당 자료는 현재 지역의 서비스 안내 범위를 설명합니다.", "공식 지역 자료", "1111051500")] }, now + 181 * 86400000, options).reasons.includes("verified_region_evidence_missing"), "Stale regional evidence must fail.");

const near = findNearDuplicatePairs([
  { id: "first", text: baseCopy + " 청운효자동", regionTerms: ["청운효자동"] },
  { id: "second", text: baseCopy + " 사직동", regionTerms: ["사직동"] },
  { id: "distinct", text: "데이터 사용량과 음성 통화 제공량을 비교하는 알뜰폰 선택 안내입니다. 망 구분, 월별 기본량, 소진 이후 속도, 가입 대상과 변경 시점을 각 상품의 최신 공식 문서에 연결해 설명합니다.".repeat(3), regionTerms: ["부전동"] }
]);
assert.equal(near.duplicateIds.has("first"), true, "The first page in a duplicated group must be held.");
assert.equal(near.duplicateIds.has("second"), true, "Changing only a locality name must not make copy unique.");
assert.equal(near.duplicateIds.has("distinct"), false, "Substantively different content should not be held.");
assert.ok(near.pairs.every(pair => pair.sharedContentRatio > 0.3 || pair.jaccard >= 0.82), "Near-duplicate pair report must expose both overlap metrics.");
console.log(JSON.stringify({ passed: true, evidenceGate: "protocol behavior verified with isolated test resolver", nearDuplicatePairs: near.pairs, unrelatedCopyPassed: true }, null, 2));
