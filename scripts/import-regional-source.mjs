import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { normalizeArea, buildUrlLock } from "./regional-pages-lib.mjs";

const root = process.cwd();
const sourceArg = process.argv.find((arg, index) => index > 1 && !arg.startsWith("--"));
const sourcePath = sourceArg ? path.resolve(sourceArg) : "";
const initializeLock = process.argv.includes("--initialize-url-lock");
const syncLock = process.argv.includes("--sync-url-lock");
const explicitVersion = process.argv.find(arg => /^--version=\d{8}$/.test(arg))?.slice("--version=".length);
const dataPath = path.join(root, "seo-lab/regions/administrative-areas.json");
const lockPath = path.join(root, "seo-lab/regions/url-lock.json");

if (!sourcePath || !fs.existsSync(sourcePath)) {
  console.error("Usage: node scripts/import-regional-source.mjs <GeoJSON file> [--initialize-url-lock | --sync-url-lock]");
  process.exit(2);
}
if (initializeLock && syncLock) throw new Error("Choose only one URL lock operation.");

const sourceBytes = fs.readFileSync(sourcePath);
const sourceHash = crypto.createHash("sha256").update(sourceBytes).digest("hex");
const sourceDoc = JSON.parse(sourceBytes.toString("utf8"));
if (!Array.isArray(sourceDoc.features)) throw new Error("Source is not a GeoJSON FeatureCollection.");
const pathVersion = sourcePath.match(/(?:ver|[-_])(20\d{6})(?:\D|$)/i)?.[1];
const dataVersion = explicitVersion || pathVersion;
if (!dataVersion) throw new Error("Could not infer an 8-digit source version. Pass --version=YYYYMMDD after reviewing the source.");

const areas = sourceDoc.features.map(feature => normalizeArea(feature.properties));
areas.sort((a, b) => a.code.localeCompare(b.code));
const codes = new Set();
for (const area of areas) {
  if (codes.has(area.code)) throw new Error(`Duplicate administrative code: ${area.code}`);
  codes.add(area.code);
}

const data = {
  schemaVersion: 1,
  dataVersion,
  importedFrom: "https://github.com/vuski/admdongkor/blob/master/ver" + dataVersion + "/HangJeongDong_ver" + dataVersion + ".geojson",
  importedAt: new Date().toISOString().slice(0, 10),
  sourceSha256: sourceHash,
  sourceRecordCount: areas.length,
  sourceAttribution: "본 데이터는 통계청 통계지리정보서비스(SGIS, https://sgis.kostat.go.kr)에서 공공누리 제1유형으로 개방한 행정동 경계를 가공한 것이며(가공: vuski/admdongkor, https://github.com/vuski/admdongkor), CC BY 4.0으로 배포됩니다.",
  areas
};

fs.mkdirSync(path.dirname(dataPath), { recursive: true });
fs.writeFileSync(dataPath, JSON.stringify(data, null, 2) + "\n", "utf8");

const candidateLock = buildUrlLock(areas, data.dataVersion);
if (initializeLock) {
  if (fs.existsSync(lockPath)) throw new Error("URL lock already exists; use --sync-url-lock after reviewing changes.");
  fs.writeFileSync(lockPath, JSON.stringify(candidateLock, null, 2) + "\n", "utf8");
} else if (syncLock) {
  const current = fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath, "utf8")) : { schemaVersion: 1, dataVersion: null, segments: {} };
  const currentCodes = new Set(Object.keys(current.segments));
  const incoming = new Set(Object.keys(candidateLock.segments));
  const added = [...incoming].filter(code => !currentCodes.has(code));
  const retired = [...currentCodes].filter(code => !incoming.has(code));
  fs.writeFileSync(lockPath, JSON.stringify({
    schemaVersion: 1,
    dataVersion: data.dataVersion,
    segments: { ...candidateLock.segments, ...Object.fromEntries([...retired].map(code => [code, current.segments[code]])) },
    retiredCodes: [...new Set([...(current.retiredCodes || []), ...retired])].sort()
  }, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ added: added.length, retired: retired.length }, null, 2));
} else if (!fs.existsSync(lockPath)) {
  console.error("No URL lock exists. Review the source and run with --initialize-url-lock once.");
  process.exitCode = 2;
}

console.log(JSON.stringify({ dataVersion: data.dataVersion, records: areas.length, sha256: sourceHash }, null, 2));

