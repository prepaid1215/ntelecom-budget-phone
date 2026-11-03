// Experiment A (테무쿠폰형): one static landing per distinct search intent.
// Data: src/data/seo-experiments/a-landings.json. Template: src/components/experiments/LandingPage.astro.
import { experimentConfig, normalizeKeyword, readJson, routeProblems, visibleLength, won } from "./common.js";
import { findNearDuplicatePairs } from "../../../scripts/regional-pages-lib.mjs";

const SLUG_A = /^앤텔레콤(?:-[가-힣a-z0-9]+)*-개통방법$/;
const SLUG_B = /^앤텔레콤(?:-[가-힣a-z0-9]+)+-개통(?:-[가-힣a-z0-9]+)+-방법$/;
const H1_A = /^앤텔레콤(?: .+)? 개통방법$/;
const H1_B = /^앤텔레콤 .+ 개통 .+ 방법$/;
const PRICE_FIELDS = new Set(["price", "current_sale_price", "monthly_price"]);
const TOKEN = /\{\{(prepaid|mvno):([a-z0-9-]+):([a-z_]+)\}\}/g;

export const slugPattern = path => {
  const slug = String(path).replace(/^\/+|\/+$/g, "");
  if (slug.includes("/")) return null;
  return SLUG_A.test(slug) ? "A" : SLUG_B.test(slug) ? "B" : null;
};

const catalogs = () => ({
  prepaid: new Map(readJson("src/data/research/prepaid-plans.json").map(item => [item.id, item])),
  mvno: new Map(readJson("src/data/research/plans.json").map(item => [item.id, item]))
});

// Same display rule as the existing pages (PlanCard/plan detail): no brand prefix, no "후불" in user copy.
export const displayPlanName = name => String(name).replace(/^앤텔레콤\s+/, "").replace(/^([KL])망후불\s*/, "$1망 ");
export const mvnoPlanPath = plan => `/plans/${plan.network.toLowerCase()}/item/${plan.id.replace(/^ntelecom-[kl]-/, "")}/`;

const resolveTokens = (text, cat, where) => String(text).replace(TOKEN, (_, catalog, id, field) => {
  const plan = cat[catalog].get(id);
  if (!plan) throw new Error(`[A] ${where}: unknown ${catalog} plan ${id}`);
  const value = plan[field];
  if (value === undefined || value === null || value === "") throw new Error(`[A] ${where}: ${catalog}:${id}.${field} is empty`);
  if (PRICE_FIELDS.has(field)) return won(value);
  return catalog === "mvno" && field === "name" ? displayPlanName(value) : String(value);
});

const planRow = (ref, cat, where) => {
  const plan = cat[ref.catalog]?.get(ref.id);
  if (!plan) throw new Error(`[A] ${where}: unknown plan reference ${ref.catalog}:${ref.id}`);
  if (ref.catalog === "prepaid") return {
    catalog: "prepaid", id: plan.id, name: plan.name, network: plan.network === "K" ? "KT망" : "LG망",
    priceLabel: "30일 " + won(plan.price), data: plan.data, voice: `통화 ${plan.calls} · 문자 ${plan.sms}`,
    path: "/선불폰/", active: true, promotionEnd: null
  };
  return {
    catalog: "mvno", id: plan.id, name: displayPlanName(plan.name), network: plan.network === "K" ? "KT망" : "LG망",
    priceLabel: "월 " + won(plan.current_sale_price), data: plan.data_text, voice: `통화 ${plan.calls} · 문자 ${plan.sms}`,
    path: mvnoPlanPath(plan), active: plan.active === true, promotionEnd: plan.promotion?.active ? plan.promotion.end_date || null : null
  };
};

let cache;
export const buildLandingModel = ({ today = new Date().toISOString().slice(0, 10) } = {}) => {
  if (cache && cache.today === today) return cache.model;
  const config = experimentConfig();
  const settings = config.experiments.A;
  const data = readJson(settings.dataFile);
  const cat = catalogs();
  const owners = config.intentOwners.map(owner => ({ ...owner, norm: normalizeKeyword(owner.keyword) }));
  // Rendered-HTML overlap is only measurable after a build; a-review.mjs pins its result here and
  // test-dist.mjs fails if the pinned list no longer matches the built pages.
  const renderedReview = readJson("src/data/seo-experiments/a-rendered-overlap.json");
  const demoted = new Map(renderedReview.demoted.map(item => [item.path, item]));
  const seen = { path: new Map(), title: new Map(), keyword: new Map(), id: new Map() };
  const pages = data.landings.map(item => {
    const where = item.id || item.path;
    for (const [key, value] of [["id", item.id], ["path", item.path], ["title", item.title], ["keyword", normalizeKeyword(item.keyword)]]) {
      if (!value) throw new Error(`[A] ${where}: missing ${key}`);
      if (seen[key].has(value)) throw new Error(`[A] duplicate ${key} '${value}' in ${seen[key].get(value)} and ${where}`);
      seen[key].set(value, where);
    }
    const problems = routeProblems(item.path);
    if (problems.length) throw new Error(`[A] ${where}: invalid route ${item.path} (${problems.join(", ")})`);
    const pattern = slugPattern(item.path);
    if (!pattern) throw new Error(`[A] ${where}: slug violates 앤텔레콤-…-개통방법 / 앤텔레콤-…-개통-…-방법 rule`);
    const h1 = item.title.split(" | ")[0].trim();
    if (!(pattern === "A" ? H1_A : H1_B).test(h1)) throw new Error(`[A] ${where}: H1 '${h1}' does not match slug pattern ${pattern}`);
    if (normalizeKeyword(h1) !== normalizeKeyword(item.keyword)) throw new Error(`[A] ${where}: H1 and keyword differ`);

    const sections = (item.sections || []).map(section => ({
      heading: section.heading,
      paragraphs: section.paragraphs.map(text => resolveTokens(text, cat, where)),
      factSources: section.factSources || []
    }));
    const planRows = (item.plans || []).map(ref => planRow(ref, cat, where));
    const bodyText = [item.lead, ...sections.flatMap(s => [s.heading, ...s.paragraphs]), ...(item.steps || []), ...(item.faq || []).flatMap(f => [f.q, f.a])].join("\n");

    const reasons = [];
    const owner = owners.find(o => o.norm === normalizeKeyword(item.keyword) && o.path !== item.path);
    if (owner) reasons.push("intent_owned_by_existing_page:" + owner.path);
    if ([...item.title].length > 40) reasons.push("title_over_40_chars");
    const descriptionLength = [...item.description].length;
    if (descriptionLength > 80 || descriptionLength < 30) reasons.push("description_length_out_of_range");
    if (visibleLength(bodyText) < settings.minBodyCharacters) reasons.push("body_below_minimum_characters");
    if ((item.links || []).length < settings.minInternalLinks) reasons.push("internal_links_below_minimum");
    if (!sections.length || sections.some(s => !s.factSources.length)) reasons.push("section_without_fact_source");
    if (planRows.some(row => !row.active)) reasons.push("referenced_plan_inactive");
    if (planRows.some(row => row.promotionEnd && row.promotionEnd < today)) reasons.push("referenced_promotion_expired");
    if (demoted.has(item.path)) reasons.push("rendered_overlap_with:" + demoted.get(item.path).with);
    return {
      experiment: "A", id: item.id, path: item.path, slugPattern: pattern, keyword: item.keyword, template: item.template,
      tags: item.tags || [], title: item.title, h1, description: item.description, lead: item.lead, sections,
      steps: item.steps || [], planRows, faq: item.faq || [], links: item.links || [], bodyText,
      intentOwner: owner?.path || null, gateReasons: reasons
    };
  });

  // Near-duplicate screen among pages that passed every other gate (same metric as experiment B).
  const contenders = pages.filter(page => !page.gateReasons.length);
  const duplicates = findNearDuplicatePairs(contenders.map(page => ({ id: page.id, text: page.bodyText, regionTerms: [] })));
  const flagged = new Set(duplicates.pairs.map(pair => pair.right));
  for (const page of pages) if (flagged.has(page.id)) page.gateReasons.push("near_duplicate_of_other_landing");

  for (const page of pages) {
    page.indexCandidate = page.gateReasons.length === 0;
    page.effectiveIndex = page.indexCandidate ? "index" : "noindex";
    page.related = pages.filter(other => other !== page && other.indexCandidate && other.tags.some(tag => page.tags.includes(tag)))
      .filter(other => !page.links.some(link => link.path === other.path)).slice(0, 3)
      .map(other => ({ path: other.path, label: other.h1 }));
  }
  const model = { pages, duplicatePairs: duplicates.pairs };
  cache = { today, model };
  return model;
};
