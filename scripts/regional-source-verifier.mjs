import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const digest = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const stable = value => JSON.stringify(value);

export const createSourceVerifier = (root, manifest) => {
  const loaded = new Map();
  const getSnapshot = id => {
    const descriptor = manifest.snapshots?.[id];
    if (!descriptor) return null;
    if (!loaded.has(id)) {
      const file = path.resolve(root, descriptor.path);
      if (!file.startsWith(path.resolve(root) + path.sep) || !fs.existsSync(file)) throw new Error("Untrusted or missing source snapshot: " + id);
      if (digest(file) !== descriptor.sha256) throw new Error("Source snapshot changed; review and repin it before using evidence: " + id);
      loaded.set(id, JSON.parse(fs.readFileSync(file, "utf8")));
    }
    return { descriptor, data: loaded.get(id) };
  };
  const resolvePointer = (value, pointer) => {
    if (typeof pointer !== "string" || !pointer.startsWith("/")) return undefined;
    return pointer.slice(1).split("/").map(part => part.replace(/~1/g, "/").replace(/~0/g, "~"))
      .reduce((current, key) => current == null ? undefined : current[key], value);
  };
  const verify = (item, { editorial = false, expectedScopeCode = null } = {}) => {
    const snapshot = getSnapshot(item?.sourceSnapshotId);
    let host = "";
    try { host = new URL(item?.sourceUrl).hostname.toLowerCase(); } catch {}
    if (!snapshot || item.sourceUrl !== snapshot.descriptor.sourceUrl || !manifest.allowedHosts?.includes(host)) return { verified: false, reason: "source_snapshot_not_allowlisted" };
    const sourceValue = resolvePointer(snapshot.data, item.sourcePointer);
    if (sourceValue === undefined || stable(sourceValue) !== stable(item.sourceValue)) return { verified: false, reason: "source_claim_value_mismatch" };
    if (expectedScopeCode && item.scopeCode !== expectedScopeCode) return { verified: false, reason: "evidence_scope_does_not_match_page" };
    if (item.scopeCode) {
      const scopeValue = resolvePointer(snapshot.data, item.scopePointer);
      if (scopeValue === undefined || String(scopeValue) !== String(item.scopeCode) || String(scopeValue) !== String(expectedScopeCode ?? item.scopeCode))
        return { verified: false, reason: "source_scope_pointer_mismatch" };
    }
    if (item.checkedAt !== snapshot.descriptor.checkedAt) return { verified: false, reason: "source_review_date_mismatch" };
    if (editorial && !snapshot.descriptor.editorialFactTypes?.includes(item.factType)) return { verified: false, reason: "source_fact_type_not_indexable" };
    return { verified: true, sourceValue, descriptor: snapshot.descriptor };
  };
  return { verify, getSnapshot };
};

export const renderVerifiedLocalFact = item => {
  const value = String(item.sourceValue ?? "");
  if (item.factType === "administrative_identity") return `행정구역 원본 자료에서 이 지역의 공식 표기는 ${value}이며 식별코드는 ${item.scopeCode}입니다.`;
  if (item.factType === "official_store_address") return `공식 매장 안내에 등록된 주소는 ${value}입니다.`;
  if (item.factType === "official_store_hours") return `공식 매장 안내에 표시된 운영시간은 ${value}입니다.`;
  if (item.factType === "official_service_point") return `공식 안내에 등록된 지역 서비스 지점은 ${value}입니다.`;
  return "";
};
