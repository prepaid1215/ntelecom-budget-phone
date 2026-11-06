// Single source of truth for every URL the experiments add, used by Astro routes,
// sitemap.xml, scripts/seo-audit.mjs, tests and the observation tooling.
import { experimentConfig, readJson, siteState, toSiteUrlFor } from "./common.js";
import { buildLandingModel } from "./landings.js";
import { buildRegionalModel, emittedRegionalPages, regionEmitMode } from "./regions.js";
import { buildIndexKitModel } from "./indexkit.js";

export const existingRoutes = () => {
  const generated = readJson("src/data/generated-pages.json");
  const dedicated = experimentConfig().intentOwners.map(owner => owner.path);
  const seoGuides = readJson("src/data/seo-guides.json").map(page => page.path);
  return new Set([...generated.map(page => page.path), ...dedicated, ...seoGuides]);
};

const summarize = page => ({
  experiment: page.experiment, path: page.path, title: page.title, h1: page.h1, description: page.description,
  effectiveIndex: page.effectiveIndex, gateReasons: page.gateReasons || [],
  kind: page.level || page.role || page.template || "landing"
});

const firstSegment = route => route.split("/").filter(Boolean)[0] || "";
// Throws on an exact path claimed twice, on an experiment prefix that shadows an existing section,
// and on an A landing whose single segment equals an existing first segment.
export const assertNoRouteConflicts = (existing, pages, prefixes) => {
  const owners = new Map();
  for (const route of existing) owners.set(route, "existing");
  for (const page of pages) {
    if (owners.has(page.path)) throw new Error(`Route conflict: ${page.path} claimed by ${owners.get(page.path)} and ${page.experiment}`);
    owners.set(page.path, page.experiment);
  }
  const existingSegments = new Set([...existing].map(firstSegment));
  for (const prefix of prefixes) if (existingSegments.has(firstSegment(prefix))) throw new Error("Experiment prefix shadows existing section: " + prefix);
  for (const page of pages.filter(p => p.experiment === "A")) {
    if (existingSegments.has(firstSegment(page.path))) throw new Error("A landing shares a segment with an existing section: " + page.path);
    if (prefixes.some(prefix => firstSegment(prefix) === firstSegment(page.path))) throw new Error("A landing shadows an experiment prefix: " + page.path);
  }
  return owners;
};

let cache;
export const buildExperimentRegistry = (env = process.env) => {
  const key = [env.SEO_REGIONS_EMIT || "", env.SEO_INDEXKIT_DATA || "", env.PRODUCTION_READY || "", env.SITE_URL || "", env.BASE_PATH || ""].join("|");
  if (cache?.key === key) return cache.value;
  const config = experimentConfig();
  const existing = existingRoutes();
  const landings = buildLandingModel();
  const regional = buildRegionalModel();
  const emittedRegions = emittedRegionalPages(env);
  const indexkit = buildIndexKitModel();

  const pages = [...landings.pages, ...emittedRegions, ...indexkit.pages].map(summarize);
  const owners = assertNoRouteConflicts(existing, pages, [config.experiments.B.routePrefix, config.experiments.C.routePrefix]);

  // Every internal link an experiment template prints must resolve to a route that is actually built.
  const built = new Set(owners.keys());
  const linkErrors = [];
  for (const page of landings.pages) for (const link of [...page.links, ...page.related, ...page.planRows.map(r => ({ path: r.path }))])
    if (!built.has(link.path)) linkErrors.push(`${page.path} -> ${link.path}`);
  for (const type of new Set(emittedRegions.map(p => p.type))) for (const guide of emittedRegions.find(p => p.type === type).guides)
    if (!built.has(guide.path)) linkErrors.push(`/regions/${type}/ guide -> ${guide.path}`);
  if (linkErrors.length) throw new Error("Broken experiment internal links:\n" + linkErrors.join("\n"));

  const titles = new Map();
  for (const page of pages) {
    if (titles.has(page.title)) throw new Error(`Duplicate experiment title '${page.title}' at ${titles.get(page.title)} and ${page.path}`);
    titles.set(page.title, page.path);
  }

  const counts = {
    A: { generatedUrls: landings.pages.length, emittedHtml: landings.pages.length, indexCandidates: landings.pages.filter(p => p.indexCandidate).length },
    B: {
      generatedUrls: regional.pages.length,
      emittedHtml: emittedRegions.length,
      emitMode: regionEmitMode(env),
      byLevel: Object.fromEntries(["root", "sido", "sgg", "emd"].map(level => [level, regional.pages.filter(p => p.level === level).length])),
      areaPages: regional.pages.filter(p => p.level === "emd").length,
      indexCandidates: regional.pages.filter(p => p.indexCandidate).length,
      duplicatePairs: regional.duplicatePairs.length
    },
    C: {
      linkingPages: indexkit.pages.length,
      targets: indexkit.source.targets.length,
      treatment: indexkit.source.targets.filter(t => t.group === "treatment").length,
      control: indexkit.source.targets.filter(t => t.group === "control").length,
      unassigned: indexkit.source.targets.filter(t => !t.group).length,
      batches: Object.fromEntries(indexkit.batches.map(b => [b.id, b.status])),
      renderedOutboundLinks: indexkit.expectedPlacements.length,
      indexCandidates: indexkit.pages.filter(p => p.effectiveIndex === "index").length
    }
  };
  for (const k of ["A", "B", "C"]) counts[k].noindexHtml = pages.filter(p => p.experiment === k && p.effectiveIndex !== "index").length;
  const value = { pages, owners, counts, landings, regional, emittedRegions, indexkit };
  cache = { key, value };
  return value;
};

export const experimentSitemapEntries = (env = process.env) => {
  const state = siteState(env);
  if (!state.productionReady) return [];
  return buildExperimentRegistry(env).pages.filter(page => page.effectiveIndex === "index")
    .map(page => ({ loc: toSiteUrlFor(state, page.path), path: page.path, experiment: page.experiment }));
};
