import assert from "node:assert/strict";
import fs from "node:fs";
import { createSourceVerifier } from "./regional-source-verifier.mjs";

const root = process.cwd();
const snapshots = JSON.parse(fs.readFileSync("seo-lab/regions/source-snapshots.json", "utf8"));
const admin = JSON.parse(fs.readFileSync("seo-lab/regions/administrative-areas.json", "utf8"));
const prepaid = JSON.parse(fs.readFileSync("src/data/research/prepaid-plans.json", "utf8"));
const plans = JSON.parse(fs.readFileSync("src/data/research/plans.json", "utf8"));
const verifier = createSourceVerifier(root, snapshots);
const area = admin.areas[0];
const areaItem = {
  status: "verified", ownerApproved: true, sourceSnapshotId: "sgis-admin-areas-20261001",
  sourcePointer: "/areas/0/fullName", sourceValue: area.fullName, sourceUrl: "https://github.com/vuski/admdongkor",
  sourceLabel: "행정구역 원본 자료", checkedAt: "2026-11-02", scopeCode: area.code,
  scopePointer: "/areas/0/code", factType: "administrative_identity"
};
assert.equal(verifier.verify(areaItem, { expectedScopeCode: area.code }).verified, true, "The exact administrative identity should resolve from the pinned source file.");
assert.equal(verifier.verify(areaItem, { expectedScopeCode: area.code, editorial: true }).verified, false, "Administrative identity is not a consumer-useful local fact.");
assert.equal(verifier.verify({ ...areaItem, sourceValue: "허위 지역 안내" }, { expectedScopeCode: area.code }).reason, "source_claim_value_mismatch", "A rewritten claim must fail exact source comparison.");
assert.equal(verifier.verify({ ...areaItem, sourceUrl: "https://example.invalid/fake" }, { expectedScopeCode: area.code }).reason, "source_snapshot_not_allowlisted", "An arbitrary URL must not authenticate a claim.");
assert.equal(verifier.verify({ ...areaItem, scopeCode: "1111053000" }, { expectedScopeCode: area.code }).verified, false, "A source row from another administrative code must fail scope matching.");

const prepaidItem = prepaid.find(item => item.id === "ntelecom-prepaid-pl23bt241");
const prepaidIndex = prepaid.findIndex(item => item.id === prepaidItem.id);
const productItem = {
  status: "verified", ownerApproved: true, sourceSnapshotId: "ntelecom-prepaid-catalog-20261102",
  sourcePointer: `/${prepaidIndex}/id`, sourceValue: prepaidItem.id,
  sourceUrl: "https://www.n-telecom.co.kr/Resources/MpolicyPDF/policy_24903.pdf",
  sourceLabel: "앤텔레콤 상품 약관", checkedAt: "2026-11-02", productId: prepaidItem.id,
  factType: "product_claim"
};
assert.equal(verifier.verify(productItem).verified, true, "The pinned product ID should resolve from the dated source catalog.");
assert.equal(plans.some(item => item.id === "ntelecom-k-7gb-coupang-cash"), true, "The MVNO content example product should exist in the current operator catalog.");
console.log(JSON.stringify({ passed: true, administrativeIdentityVerified: true, adminIdentityIndexable: false, tamperedClaimRejected: true, wrongScopeRejected: true, productCatalogVerified: true }, null, 2));
