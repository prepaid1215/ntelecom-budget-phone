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

export const evidenceEligibility = (record, now = Date.now(), options = {}) => {
  const local = Array.isArray(record?.localEvidence) ? record.localEvidence : [];
  const product = Array.isArray(record?.productEvidence) ? record.productEvidence : [];
  const currentLocal = local.filter(item => validEvidenceItem(item, now, 180));
  const validLocal = options.regionCode
    ? currentLocal.filter(item => String(item.scopeCode) === String(options.regionCode))
    : currentLocal;
  const validProduct = product.filter(item => validEvidenceItem(item, now, 90)
    && /^[a-z0-9][a-z0-9-]+$/i.test(String(item.productId || ""))
    && (!options.productIds || options.productIds.has(String(item.productId))));
  const editorialText = String(record?.approvedCopy || "").trim();
  const editorialWordCount = (editorialText.match(/[\p{L}\p{N}]+/gu) || []).length;
  const reasons = [];
  if (record?.ownerApproved !== true) reasons.push("owner_approval_missing");
  if (!validLocal.length) reasons.push("verified_region_evidence_missing");
  if (options.regionCode && currentLocal.length && !validLocal.length) reasons.push("regional_fact_scope_mismatch");
  if (!validProduct.length) reasons.push("verified_product_evidence_missing");
  if (product.length && validProduct.length < product.filter(item => validEvidenceItem(item, now, 90)).length) reasons.push("product_id_unverified_or_unknown");
  if (editorialText.length < 260) reasons.push("approved_unique_copy_missing");
  if (editorialWordCount < 40) reasons.push("approved_copy_substance_below_40_words");
  const evidenceFingerprints = [...validLocal, ...validProduct].map(item =>
    String(item.fact).normalize("NFC").toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim()
  );
  if (new Set(evidenceFingerprints).size !== evidenceFingerprints.length) reasons.push("duplicate_evidence_item");
  return {
    eligible: reasons.length === 0,
    reasons,
    localEvidenceCount: validLocal.length,
    productEvidenceCount: validProduct.length,
    localEvidence: validLocal,
    productEvidence: validProduct,
    approvedCopy: reasons.length === 0 ? editorialText : ""
  };
};

const normalizedEditorialText = (text, regionTerms = []) => {
  let value = String(text || "").normalize("NFC").toLocaleLowerCase("ko-KR");
  const terms = [...new Set([...regionTerms, "선불폰", "알뜰폰"])].filter(term => String(term).trim().length > 1)
    .sort((a, b) => String(b).length - String(a).length);
  for (const term of terms) value = value.split(String(term).normalize("NFC").toLocaleLowerCase("ko-KR")).join(" 지역 ");
  return value.replace(/[^\p{L}\p{N}]+/gu, "").trim();
};

const charShingles = text => {
  const compact = [...text];
  const shingles = new Set();
  for (let i = 0; i <= compact.length - 3; i++) shingles.add(compact.slice(i, i + 3).join(""));
  return shingles;
};

const jaccard = (a, b) => {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  const smaller = a.size < b.size ? a : b;
  const larger = smaller === a ? b : a;
  for (const item of smaller) if (larger.has(item)) intersection++;
  return intersection / (a.size + b.size - intersection);
};

const hash32 = (text, seed) => {
  let hash = seed >>> 0;
  for (const char of text) hash = Math.imul(hash ^ char.codePointAt(0), 16777619) >>> 0;
  return hash;
};

const simHash64 = shingles => {
  const weights = new Int32Array(64);
  for (const gram of shingles) {
    const a = hash32(gram, 2166136261);
    const b = hash32(gram, 2246822519);
    for (let bit = 0; bit < 32; bit++) {
      weights[bit] += (a >>> bit) & 1 ? 1 : -1;
      weights[bit + 32] += (b >>> bit) & 1 ? 1 : -1;
    }
  }
  return Array.from({ length: 8 }, (_, band) => {
    let byte = 0;
    for (let bit = 0; bit < 8; bit++) if (weights[band * 8 + bit] >= 0) byte |= 1 << bit;
    return byte.toString(16).padStart(2, "0");
  });
};

// LSH narrows comparisons; Jaccard on character trigrams is the final decision.
// Region names and the service keyword are normalized so changing only those
// tokens cannot make an otherwise duplicated page look unique.
export const REGIONAL_CONTENT_SIMILARITY_THRESHOLD = 0.82;
export const findNearDuplicatePairs = (records, threshold = REGIONAL_CONTENT_SIMILARITY_THRESHOLD) => {
  const buckets = new Map();
  const prepared = [];
  const pairs = [];
  const duplicateIds = new Set();
  for (const record of records) {
    const text = normalizedEditorialText(record.text, record.regionTerms);
    const shingles = charShingles(text);
    if (shingles.size < 80) continue;
    const bands = simHash64(shingles);
    const candidates = new Set();
    for (let band = 0; band < bands.length; band++) {
      for (const previous of buckets.get(band + ":" + bands[band]) || []) candidates.add(previous);
    }
    for (const previousIndex of candidates) {
      const previous = prepared[previousIndex];
      const similarity = jaccard(shingles, previous.shingles);
      if (similarity >= threshold) {
        pairs.push({ left: previous.id, right: record.id, similarity: Number(similarity.toFixed(4)) });
        duplicateIds.add(previous.id);
        duplicateIds.add(record.id);
        break;
      }
    }
    const index = prepared.push({ id: record.id, shingles }) - 1;
    for (let band = 0; band < bands.length; band++) {
      const key = band + ":" + bands[band];
      const bucket = buckets.get(key) || [];
      bucket.push(index);
      buckets.set(key, bucket);
    }
  }
  return { pairs, duplicateIds };
};
