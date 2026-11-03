// Observation ledger + window evaluation shared by scripts/seo-experiments/observe.mjs and report.mjs.
// Stages are kept separate on purpose: submitted ≠ discovered ≠ crawled ≠ indexed ≠ served.
// "unobservable" means the method cannot see the stage; it is never counted as success.
import crypto from "node:crypto";
import { experimentConfig } from "./common.js";
import { normalizeNaverBlogUrl } from "./indexkit.js";

export const STAGES = ["submitted", "discovered", "crawled", "indexed", "served"];
export const RESULTS = ["yes", "no", "unobservable"];
export const ENGINES = ["google", "naver"];
export const METHODS = {
  google: ["gsc_url_inspection", "gsc_page_indexing", "gsc_performance", "gsc_sitemap", "server_log", "site_operator", "exact_url_search", "manual_serp"],
  naver: ["searchadvisor_request", "searchadvisor_report", "searchadvisor_sitemap", "server_log", "site_operator", "exact_url_search", "manual_serp"]
};
// Methods that only exist for a property this project owns (Search Console, Search Advisor, our server logs).
export const OWN_PROPERTY_METHODS = new Set(["gsc_url_inspection", "gsc_page_indexing", "gsc_performance", "gsc_sitemap", "server_log", "searchadvisor_request", "searchadvisor_report", "searchadvisor_sitemap"]);
const METRIC_METHODS = new Set(["gsc_performance", "searchadvisor_report"]);
const DAY = 86400000;

export const normalizeUnitUrl = raw => {
  const url = new URL(String(raw).trim());
  if (/(^|\.)blog\.naver\.com$/i.test(url.hostname)) return normalizeNaverBlogUrl(url.toString());
  url.hash = ""; url.search = "";
  return url.toString();
};
export const isOwnUnit = (unitUrl, origin = experimentConfig().productionOrigin) => new URL(unitUrl).origin === new URL(origin).origin;
export const eventId = event => crypto.createHash("sha256")
  .update(JSON.stringify([event.unit, event.engine, event.stage, event.result, event.observedAt, event.method, event.metrics || null])).digest("hex").slice(0, 24);

// Returns a normalized event or throws with a reason a reviewer can act on.
export const validateEvent = (raw, units) => {
  const unit = normalizeUnitUrl(raw.unit);
  const known = units.get(unit);
  if (!known) throw new Error("unit is not a registered experiment URL: " + raw.unit);
  if (raw.experiment && raw.experiment !== known.experiment) throw new Error(`experiment ${raw.experiment} does not own ${unit} (owner ${known.experiment})`);
  if (!ENGINES.includes(raw.engine)) throw new Error("engine must be google or naver");
  if (!STAGES.includes(raw.stage)) throw new Error("stage must be one of " + STAGES.join(","));
  if (!RESULTS.includes(raw.result)) throw new Error("result must be yes, no or unobservable");
  if (!METHODS[raw.engine].includes(raw.method)) throw new Error(`method ${raw.method} is not valid for ${raw.engine}`);
  if (!Number.isFinite(Date.parse(raw.observedAt)) || !/^\d{4}-\d{2}-\d{2}T/.test(raw.observedAt)) throw new Error("observedAt must be an ISO date-time");
  if (!raw.source || String(raw.source).trim().length < 4) throw new Error("source (where the evidence can be re-checked) is required");
  const own = !known.external;
  if (!own && OWN_PROPERTY_METHODS.has(raw.method)) throw new Error(`${raw.method} only works for this site's own URLs, not ${unit}`);
  if (!own && ["discovered", "crawled"].includes(raw.stage) && raw.result !== "unobservable")
    throw new Error(`${raw.stage} of a third-party URL cannot be observed by this project; record result=unobservable`);
  if (!own && raw.stage === "indexed" && raw.result === "no") throw new Error("a negative search result does not prove a third-party URL is unindexed; record result=unobservable with the query in note");
  if (!own && raw.stage === "submitted") throw new Error("submitting a C target to a search engine contaminates the link experiment; record it as a note and exclude the unit instead");
  let metrics = null;
  if (raw.metrics != null) {
    if (raw.stage !== "served") throw new Error("metrics are only valid on stage=served");
    const m = raw.metrics;
    if (METRIC_METHODS.has(raw.method)) {
      if (!["impressions", "clicks"].every(k => Number.isInteger(m[k]) && m[k] >= 0)) throw new Error("impressions and clicks must be non-negative integers");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(m.rangeStart || "") || !/^\d{4}-\d{2}-\d{2}$/.test(m.rangeEnd || "") || m.rangeStart > m.rangeEnd) throw new Error("metrics need rangeStart <= rangeEnd (YYYY-MM-DD)");
      if (m.clicks > m.impressions) throw new Error("clicks cannot exceed impressions");
      metrics = { impressions: m.impressions, clicks: m.clicks, rangeStart: m.rangeStart, rangeEnd: m.rangeEnd, ...(m.position != null ? { position: Number(m.position) } : {}) };
    } else {
      if (m.impressions != null || m.clicks != null) throw new Error(`${raw.method} cannot measure impressions/clicks; only a query string may be attached`);
      metrics = m.query ? { query: String(m.query) } : null;
    }
  }
  if (raw.stage === "served" && METRIC_METHODS.has(raw.method) && !metrics) throw new Error(`${raw.method} served events need metrics`);
  const event = { unit, experiment: known.experiment, engine: raw.engine, stage: raw.stage, result: raw.result, observedAt: new Date(raw.observedAt).toISOString(),
    method: raw.method, source: String(raw.source).trim(), metrics, note: raw.note ? String(raw.note) : null };
  return { id: eventId(event), ...event };
};

// Maps the older experiment-B ledger (seo-lab/regions/index-flow-observations.json) onto the common stages.
export const legacyRegionalEvents = (ledger, units) => (ledger?.events || []).flatMap(item => {
  const map = { submission: "submitted", crawl: "crawled", googleIndex: "indexed", searchPerformance: "served" };
  const stage = map[item.type];
  let unit; try { unit = normalizeUnitUrl(item.url); } catch { return []; }
  if (!stage || !units.has(unit)) return [];
  const status = item.data?.status;
  const result = stage === "served" ? "yes" : ["submitted", "accepted", "crawled", "indexed"].includes(status) ? "yes" : status === "unobserved" ? null : "no";
  if (!result) return [];
  const metrics = stage === "served" ? { impressions: item.data.impressions, clicks: item.data.clicks, rangeStart: item.data.rangeStart, rangeEnd: item.data.rangeEnd } : null;
  const event = { unit, experiment: "B", engine: "google", stage, result: stage === "served" && !(item.data.impressions > 0) ? "no" : result,
    observedAt: new Date(item.observedAt).toISOString(), method: stage === "served" ? "gsc_performance" : stage === "submitted" ? "gsc_sitemap" : "gsc_url_inspection",
    source: item.source, metrics, note: "imported from legacy regional ledger" };
  return [{ id: eventId(event), ...event }];
});

const dayIndex = (iso, start) => Math.floor((Date.parse(iso) - start) / DAY);

// One row per unit × engine × window. Unknown stays null; unobservable stays "unobservable".
export const evaluateUnit = (unit, events, { windows, engines = ENGINES, today = new Date().toISOString().slice(0, 10), excludeIndexedAtBaseline = false }) => {
  const rows = [];
  const start = unit.startDate ? Date.parse(unit.startDate + "T00:00:00Z") : null;
  for (const engine of engines) {
    const mine = events.filter(e => e.unit === unit.unit && e.engine === engine).sort((a, b) => a.observedAt.localeCompare(b.observedAt));
    const baseline = start == null ? [] : mine.filter(e => Date.parse(e.observedAt) < start);
    const baselineIndexed = baseline.filter(e => e.stage === "indexed").at(-1)?.result ?? null;
    for (const windowDays of windows) {
      const row = { experiment: unit.experiment, unit: unit.unit, path: unit.path, kind: unit.kind, arm: unit.arm, engine, windowDays,
        startDate: unit.startDate, windowEnd: null, windowStatus: "not_started", baselineIndexed,
        excluded: Boolean(excludeIndexedAtBaseline && baselineIndexed === "yes"), eventsInWindow: 0, impressions: null, clicks: null };
      for (const stage of STAGES) Object.assign(row, { [stage]: null, [stage + "ObservedAt"]: null, [stage + "Method"]: null, [stage + "FirstYesDay"]: null });
      if (start != null) {
        const endExclusive = start + (windowDays + 1) * DAY;
        row.windowEnd = new Date(endExclusive - DAY).toISOString().slice(0, 10);
        row.windowStatus = today >= row.windowEnd ? "complete" : "in_progress";
        const inWindow = mine.filter(e => { const t = Date.parse(e.observedAt); return t >= start && t < endExclusive; });
        row.eventsInWindow = inWindow.length;
        for (const stage of STAGES) {
          const stageEvents = inWindow.filter(e => e.stage === stage);
          const latest = stageEvents.at(-1);
          if (latest) Object.assign(row, { [stage]: latest.result, [stage + "ObservedAt"]: latest.observedAt, [stage + "Method"]: latest.method });
          const firstYes = stageEvents.find(e => e.result === "yes");
          if (firstYes) row[stage + "FirstYesDay"] = dayIndex(firstYes.observedAt, start);
        }
        const metricEvents = inWindow.filter(e => e.stage === "served" && e.metrics && Number.isInteger(e.metrics.impressions)
          && e.metrics.rangeStart >= unit.startDate && e.metrics.rangeEnd <= row.windowEnd);
        if (metricEvents.length) {
          row.impressions = metricEvents.reduce((sum, e) => sum + e.metrics.impressions, 0);
          row.clicks = metricEvents.reduce((sum, e) => sum + e.metrics.clicks, 0);
        }
      }
      rows.push(row);
    }
  }
  return rows;
};

export const summarizeRows = rows => {
  const groups = new Map();
  for (const row of rows) {
    const key = [row.experiment, row.arm, row.engine, row.windowDays].join("|");
    if (!groups.has(key)) groups.set(key, { experiment: row.experiment, arm: row.arm, engine: row.engine, windowDays: row.windowDays,
      units: 0, started: 0, complete: 0, excluded: 0, impressions: null, clicks: null,
      ...Object.fromEntries(STAGES.flatMap(s => [[s + "Yes", 0], [s + "No", 0], [s + "Unobservable", 0], [s + "Unobserved", 0], [s + "YesRateAmongObserved", null]])) });
    const g = groups.get(key);
    g.units++;
    if (row.excluded) { g.excluded++; continue; }
    if (row.windowStatus === "not_started") continue;
    g.started++;
    if (row.windowStatus === "complete") g.complete++;
    for (const stage of STAGES) {
      const value = row[stage];
      if (value === "yes") g[stage + "Yes"]++; else if (value === "no") g[stage + "No"]++;
      else if (value === "unobservable") g[stage + "Unobservable"]++; else g[stage + "Unobserved"]++;
    }
    if (row.impressions != null) { g.impressions = (g.impressions || 0) + row.impressions; g.clicks = (g.clicks || 0) + row.clicks; }
  }
  for (const g of groups.values()) for (const stage of STAGES) {
    const observed = g[stage + "Yes"] + g[stage + "No"];
    g[stage + "YesRateAmongObserved"] = observed ? Number((g[stage + "Yes"] / observed).toFixed(4)) : null;
  }
  return [...groups.values()].sort((a, b) => (a.experiment + a.arm + a.engine).localeCompare(b.experiment + b.arm + b.engine) || a.windowDays - b.windowDays);
};

export const toCsv = rows => {
  if (!rows.length) return "";
  const columns = Object.keys(rows[0]);
  const cell = value => value == null ? "" : /[",\n]/.test(String(value)) ? '"' + String(value).replace(/"/g, '""') + '"' : String(value);
  return columns.join(",") + "\n" + rows.map(row => columns.map(c => cell(row[c])).join(",")).join("\n") + "\n";
};
