export const normalizeArea = properties => {
  const fullName = String(properties?.adm_nm || "").normalize("NFC").trim();
  const code = String(properties?.adm_cd2 || "").trim();
  const provinceCode = String(properties?.sido || "").trim();
  const districtCode = String(properties?.sgg || "").trim();
  const parts = fullName.split(/\s+/);
  if (!/^\d{10}$/.test(code)) throw new Error(`Invalid 10-digit administrative code: ${code}`);
  if (!/^\d{2}$/.test(provinceCode) || !/^\d{5}$/.test(districtCode))
    throw new Error(`Invalid parent code for ${fullName}`);
  if (parts.length !== 3 || parts.some(part => !part)) throw new Error(`Expected province, district, and area name: ${fullName}`);
  const [province, district, locality] = parts;
  if (!properties.sidonm || !properties.sggnm || properties.sidonm !== province || properties.sggnm !== district)
    throw new Error(`Administrative name/code mismatch for ${code}`);
  return { code, fullName, provinceCode, province, districtCode, district, locality };
};

export const slugifyName = value => String(value)
  .normalize("NFC")
  .trim()
  .toLocaleLowerCase("ko-KR")
  .replace(/\s+/g, "-")
  .replace(/[^\p{L}\p{N}-]/gu, "")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "");

export const regionSegment = (name, code) => {
  const slug = slugifyName(name);
  if (!slug || !/^\d+$/.test(String(code))) throw new Error(`Cannot form stable URL segment for ${name} (${code})`);
  return `${slug}-${code}`;
};

export const buildUrlLock = (areas, dataVersion) => {
  const segments = {};
  const add = (level, code, name) => {
    const key = `${level}:${code}`;
    const value = { level, code: String(code), name, segment: regionSegment(name, code) };
    if (segments[key] && JSON.stringify(segments[key]) !== JSON.stringify(value))
      throw new Error(`Conflicting URL lock value: ${key}`);
    segments[key] = value;
  };
  for (const area of areas) {
    add("sido", area.provinceCode, area.province);
    add("sgg", area.districtCode, area.district);
    add("emd", area.code, area.locality);
  }
  return { schemaVersion: 1, dataVersion, segments };
};

const validEvidenceItem = (item, now, maxAgeDays) => {
  if (!item || item.status !== "verified" || item.ownerApproved !== true) return false;
  if (!/^https?:\/\//i.test(String(item.sourceUrl || ""))) return false;
  if (String(item.sourceLabel || "").trim().length < 4 || String(item.fact || "").trim().length < 40) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(item.checkedAt || ""))) return false;
  const checkedAt = new Date(`${item.checkedAt}T00:00:00Z`).getTime();
  if (!Number.isFinite(checkedAt) || new Date(checkedAt).toISOString().slice(0, 10) !== item.checkedAt) return false;
  const age = (now - checkedAt) / 86400000;
  return Number.isFinite(checkedAt) && age >= 0 && age <= maxAgeDays;
};

export const evidenceEligibility = (record, now = Date.now()) => {
  const local = Array.isArray(record?.localEvidence) ? record.localEvidence : [];
  const product = Array.isArray(record?.productEvidence) ? record.productEvidence : [];
  const validLocal = local.filter(item => validEvidenceItem(item, now, 180));
  const validProduct = product.filter(item => validEvidenceItem(item, now, 90));
  const editorialText = String(record?.approvedCopy || "").trim();
  const reasons = [];
  if (record?.ownerApproved !== true) reasons.push("owner_approval_missing");
  if (!validLocal.length) reasons.push("verified_region_evidence_missing");
  if (!validProduct.length) reasons.push("verified_product_evidence_missing");
  if (editorialText.length < 260) reasons.push("approved_unique_copy_missing");
  const evidenceFingerprints = [...validLocal, ...validProduct].map(item =>
    String(item.fact).normalize("NFC").toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim()
  );
  if (new Set(evidenceFingerprints).size !== evidenceFingerprints.length) reasons.push("duplicate_evidence_item");
  return {
    eligible: reasons.length === 0,
    reasons,
    localEvidenceCount: validLocal.length,
    productEvidenceCount: validProduct.length,
    approvedCopy: reasons.length === 0 ? editorialText : ""
  };
};
