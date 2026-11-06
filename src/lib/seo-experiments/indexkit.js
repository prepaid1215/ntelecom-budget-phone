// Experiment C (IndexKit형): plain HTML links from this site to Naver blog mobile post URLs.
// Treatment targets get links; control targets are registered but never linked anywhere.
// A link is an opportunity for discovery only. Nothing here assumes or forces Google indexing.
import crypto from "node:crypto";
import { experimentConfig, readJson, routeProblems } from "./common.js";

export const PLACEMENTS = ["list", "contextual", "hub"];
// Carrier = the page on this site that holds the link. "index" carriers are listed in sitemap.xml;
// "noindex" carriers are crawlable (noindex,follow) but only reachable through internal links, so the
// two arms measure different discovery paths. See seo-lab/indexkit/README.md for the limits.
export const CARRIERS = ["index", "noindex"];
export const indexKitDataFile = (env = process.env) => env.SEO_INDEXKIT_DATA || experimentConfig().experiments.C.dataFile;
export const GROUPS = ["treatment", "control"];

export const normalizeNaverBlogUrl = raw => {
  let url;
  try { url = new URL(String(raw).trim()); } catch { throw new Error("Not a URL: " + raw); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Unsupported protocol: " + raw);
  const host = url.hostname.toLowerCase();
  if (host !== "blog.naver.com" && host !== "m.blog.naver.com") throw new Error("Not a Naver blog host: " + raw);
  const parts = url.pathname.split("/").filter(Boolean);
  let blogId, logNo;
  if (parts.length === 2 && /^\d+$/.test(parts[1])) [blogId, logNo] = parts;
  else if (parts.length === 1 && /^PostView\.(naver|nhn)$/i.test(parts[0])) { blogId = url.searchParams.get("blogId"); logNo = url.searchParams.get("logNo"); }
  else if (parts.length === 1 && url.searchParams.get("logNo")) { blogId = parts[0]; logNo = url.searchParams.get("logNo"); }
  blogId = String(blogId || "").toLowerCase();
  if (!/^[a-z0-9_-]{2,40}$/.test(blogId) || !/^\d{6,20}$/.test(String(logNo || ""))) throw new Error("Not a Naver blog post URL: " + raw);
  return `https://m.blog.naver.com/${blogId}/${logNo}`;
};

export const assignmentRank = (seed, url) => crypto.createHash("sha256").update(seed + "\n" + url).digest("hex");

// Deterministic, balanced assignment of still-unassigned targets in one batch. Existing groups never change.
export const assignBatch = (targets, seed, assignedAt) => {
  const counts = { treatment: targets.filter(t => t.group === "treatment").length, control: targets.filter(t => t.group === "control").length };
  const pending = targets.filter(t => !t.group).sort((a, b) => assignmentRank(seed, a.url).localeCompare(assignmentRank(seed, b.url)));
  for (const target of pending) {
    const group = counts.treatment <= counts.control ? "treatment" : "control";
    target.group = group; counts[group]++;
    target.assignment = { method: "sha256-rank-alternating", seed, rank: assignmentRank(seed, target.url).slice(0, 16), assignedAt };
  }
  return targets;
};

export const validateIndexKitData = data => {
  if (data?.schemaVersion !== 1) throw new Error("[C] unsupported indexkit schema");
  const batchIds = new Set();
  for (const batch of data.batches) {
    if (!/^[a-z0-9][a-z0-9-]{2,40}$/.test(batch.id) || batchIds.has(batch.id)) throw new Error("[C] invalid or duplicate batch id " + batch.id);
    if (batch.publishedAt && !/^\d{4}-\d{2}-\d{2}$/.test(batch.publishedAt)) throw new Error("[C] publishedAt must be YYYY-MM-DD: " + batch.id);
    if (!CARRIERS.includes(batch.carrierRobots)) throw new Error("[C] carrierRobots must be index or noindex: " + batch.id);
    if ([...String(batch.title)].length > 30) throw new Error("[C] batch title over 30 chars (title budget 40): " + batch.id);
    batchIds.add(batch.id);
  }
  const ids = new Set(), urls = new Map();
  for (const target of data.targets) {
    if (!/^ik-\d{4,}$/.test(target.id) || ids.has(target.id)) throw new Error("[C] invalid or duplicate target id " + target.id);
    ids.add(target.id);
    const normalized = normalizeNaverBlogUrl(target.url);
    if (normalized !== target.url) throw new Error(`[C] ${target.id} url must be stored normalized as ${normalized}`);
    if (urls.has(normalized)) throw new Error(`[C] ${target.id} duplicates ${urls.get(normalized)} (${normalized})`);
    urls.set(normalized, target.id);
    if (!batchIds.has(target.batch)) throw new Error(`[C] ${target.id} references unknown batch ${target.batch}`);
    if (target.group !== null && !GROUPS.includes(target.group)) throw new Error(`[C] ${target.id} invalid group ${target.group}`);
    if (target.group && !target.assignment?.assignedAt) throw new Error(`[C] ${target.id} group recorded without assignment metadata`);
    if (!Array.isArray(target.placements) || !target.placements.length || target.placements.some(p => !PLACEMENTS.includes(p)))
      throw new Error(`[C] ${target.id} placements must be a non-empty subset of ${PLACEMENTS.join(",")}`);
    if (target.placements.includes("contextual") && !target.summary) throw new Error(`[C] ${target.id} contextual placement needs an operator-written summary`);
  }
  for (const batch of data.batches) {
    const members = data.targets.filter(t => t.batch === batch.id);
    if (batch.publishedAt && members.some(t => !t.group)) throw new Error(`[C] published batch ${batch.id} contains unassigned targets`);
  }
  return data;
};

let cache;
export const buildIndexKitModel = ({ data = null } = {}) => {
  if (!data && cache) return cache;
  const settings = experimentConfig().experiments.C;
  const source = validateIndexKitData(data || readJson(indexKitDataFile()));
  const min = settings.minTargetsPerGroup;
  const batches = source.batches.map(batch => {
    const members = source.targets.filter(t => t.batch === batch.id);
    const treatment = members.filter(t => t.group === "treatment"), control = members.filter(t => t.group === "control");
    const balanced = treatment.length >= min && control.length >= min && members.every(t => t.group);
    const status = !balanced ? "enrolling" : batch.publishedAt ? "live" : "ready";
    const path = settings.routePrefix + batch.id + "/";
    const problems = routeProblems(path);
    if (problems.length) throw new Error(`[C] invalid route ${path}`);
    return { ...batch, path, status, linksRendered: status !== "enrolling", treatment, control, unassigned: members.filter(t => !t.group),
      arm: "treatment:" + batch.carrierRobots + "-carrier" };
  });
  const live = batches.filter(b => b.linksRendered);
  const indexableLive = live.filter(b => b.carrierRobots === "index");
  const hub = {
    experiment: "C", role: "hub", path: settings.routePrefix, title: "네이버 블로그 원문 링크 모음 | 앤텔레콤", h1: "네이버 블로그 원문 링크 모음",
    description: "앤텔레콤 개통 안내 네이버 블로그 원문으로 이동하는 링크 묶음 목록입니다.",
    effectiveIndex: indexableLive.length ? "index" : "noindex", gateReasons: indexableLive.length ? [] : ["no_balanced_indexable_batch"],
    batches, hubTargets: live.flatMap(b => b.treatment.filter(t => t.placements.includes("hub")).map(t => ({ ...t, batchId: b.id })))
  };
  const batchPages = batches.map(batch => ({
    experiment: "C", role: "batch", path: batch.path, title: `${batch.title} | 앤텔레콤`, h1: batch.title, description: batch.intro.slice(0, 78),
    effectiveIndex: batch.linksRendered && batch.carrierRobots === "index" ? "index" : "noindex",
    gateReasons: !batch.linksRendered ? ["batch_enrolling_insufficient_or_unassigned_targets"] : batch.carrierRobots === "noindex" ? ["noindex_carrier_arm"] : [], batch
  }));
  for (const page of batchPages) if ([...page.title].length > 40) throw new Error("[C] title over 40 chars: " + page.path);
  // Expected placements: exactly what the HTML must contain (checked against built HTML by the link manifest).
  const expectedPlacements = [];
  for (const batch of live) for (const target of batch.treatment) for (const position of target.placements)
    expectedPlacements.push({ targetId: target.id, url: target.url, position, batchId: batch.id, carrierRobots: batch.carrierRobots,
      pagePath: position === "hub" ? settings.routePrefix : batch.path });
  const model = { settings, source, batches, pages: [hub, ...batchPages], expectedPlacements,
    controlUrls: source.targets.filter(t => t.group === "control").map(t => t.url) };
  if (!data) cache = model;
  return model;
};

export const targetLabel = target => target.label || `네이버 블로그 원문 ${target.url.replace("https://m.blog.naver.com/", "")}`;
