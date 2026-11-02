// SEO 3-experiment prototype. Deliberately separate from Astro production routes.
// Run: node scripts/seo-lab-preview.mjs
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const input = JSON.parse(fs.readFileSync(path.join(root, "seo-lab/seed.json"), "utf8"));
const output = path.join(root, "seo-lab-preview");
const routes = new Set();
const titles = new Set();
const report = [];

const escapeHtml = value => String(value).replace(/[&<>"']/g, char =>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char])
);
const requireRoute = (route, experiment) => {
  if (!/^\/[가-힣a-z0-9-]+\/$/.test(route) || routes.has(route))
    throw new Error("Missing, invalid, or duplicate route: " + route);
  // Search experiment landing pages must carry all three words:
  // 앤텔레콤 + 개통 + 방법. /blog/ is intentionally not a landing page.
  const slug = decodeURIComponent(route);
  if ((experiment === "A" || experiment === "B") &&
      (!slug.includes("앤텔레콤") || !slug.includes("개통방법")))
    throw new Error("Slug violates 앤텔레콤 + 개통방법 policy: " + route);
  routes.add(route);
};
const requireTitle = title => {
  if (!title || titles.has(title)) throw new Error("Missing or duplicate title: " + title);
  titles.add(title);
};
const page = (route, title, description, inner, experiment, eligible = false) => {
  requireRoute(route, experiment);
  requireTitle(title);
  const folder = path.join(output, ...route.split("/").filter(Boolean));
  fs.mkdirSync(folder, {recursive:true});
  // All prototypes stay noindex: eligibility is only an editorial review state.
  const html = [
    "<!doctype html><html lang=\"ko\"><head><meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
    "<meta name=\"robots\" content=\"noindex,follow\">",
    "<title>" + escapeHtml(title) + "</title>",
    "<meta name=\"description\" content=\"" + escapeHtml(description) + "\">",
    "<style>body{font-family:system-ui,sans-serif;line-height:1.75;max-width:760px;margin:36px auto;padding:0 22px;color:#17243b}h1{font-size:2rem}a{color:#315bca}li{margin-bottom:8px}.note{background:#f3f5f9;padding:16px;border-radius:12px}</style>",
    "</head><body><header><a href=\"/\">SEO 실험 미리보기</a></header>",
    "<main><h1>" + escapeHtml(title) + "</h1>" + inner + "</main>",
    "<footer><p class=\"note\">검수용 초안입니다. 검색 색인 대상이 아니며 상업적 정보의 최신성을 검증해야 합니다.</p></footer>",
    "</body></html>"
  ].join("");
  fs.writeFileSync(path.join(folder, "index.html"), html, "utf8");
  report.push({
    experiment, path:route, preview_generated:true,
    editorial_index_candidate:eligible,
    submitted:false, crawled:null, indexed:null, impressions:null, clicks:null
  });
};
fs.rmSync(output, {recursive:true,force:true});
fs.mkdirSync(output,{recursive:true});

for (const item of input.keywords) {
  if (!item.intro || item.intro.length < 30 || !Array.isArray(item.steps) || item.steps.length < 3)
    throw new Error("Keyword lacks unique information: " + item.path);
  const body = "<p>" + escapeHtml(item.intro) + "</p><h2>진행 순서</h2><ol>" +
    item.steps.map(step => "<li>" + escapeHtml(step) + "</li>").join("") +
    "</ol><p><a href=\"https://preplan.site/\">59만모바일 개통 안내</a></p>";
  page(item.path, item.title, item.description, body, "A", true);
}

for (const region of input.regions) {
  const name = region.dong;
  // A real unique locality signal is needed before allowing any region SEO indexing.
  const eligible = !!(region.uniqueEvidence && String(region.uniqueEvidence).trim().length >= 60);
  const location = [region.city,region.district,name].join(" ");
  const body = "<p>" + escapeHtml(location) + "을 검색한 분을 위한 온라인 선불폰 가입 안내 초안입니다.</p>" +
    "<p class=\"note\">이 지역만의 검증된 개통 정보가 확보되지 않았으므로 색인 후보에서 제외합니다.</p>" +
    (eligible ? "<p>" + escapeHtml(region.uniqueEvidence) + "</p>" : "") +
    "<p><a href=\"/앤텔레콤-선불폰-개통방법/\">공통 선불폰 개통 순서 보기</a></p>";
  page("/" + name + "-앤텔레콤-개통방법/",
    name + " 선불폰 개통방법 | 온라인 신규가입 안내",
    location + " 선불폰 유심 준비와 신규가입 절차 안내.",
    body, "B", eligible);
}

const normalizeNaver = raw => {
  const u = new URL(raw);
  if (!["blog.naver.com","m.blog.naver.com"].includes(u.hostname))
    throw new Error("Not a Naver blog post: " + raw);
  const p = u.pathname.split("/").filter(Boolean);
  if (p.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(p[0]) || !/^[0-9]+$/.test(p[1]))
    throw new Error("Unrecognized Naver blog URL: " + raw);
  return "https://m.blog.naver.com/" + p[0] + "/" + p[1];
};
const blogLinks = [...new Set(input.blogs.map(b => normalizeNaver(b.url)))];
const blogContent = "<p>공개 네이버 블로그 글의 발견 경로를 관찰하는 실험입니다. 원문을 복제하지 않습니다.</p>" +
  "<ul>" + blogLinks.map(u => "<li><a rel=\"noopener noreferrer\" href=\"" +
     escapeHtml(u) + "\">" + escapeHtml(u) + "</a></li>").join("") + "</ul>" +
  "<p class=\"note\">링크 게시와 Google 검색 색인 성공은 서로 다른 상태입니다.</p>";
page("/blog/", "네이버 블로그 원문 URL 발견 실험", "네이버 블로그 원문 주소 정규화와 검색 발견 실험 안내.",
  blogContent, "C", false);

fs.writeFileSync(path.join(output, "robots.txt"), "User-agent: *\nDisallow: /\n", "utf8");
fs.writeFileSync(path.join(output, "blog-originals.json"),
  JSON.stringify(blogLinks.map(url=>({url, discovered_by_google:null, indexed_by_google:null})),null,2) + "\n");
fs.writeFileSync(path.join(output, "status.json"), JSON.stringify(report,null,2) + "\n");
const summary = {
  keywordPreviews:report.filter(x=>x.experiment==="A").length,
  regionPreviews:report.filter(x=>x.experiment==="B").length,
  regionEditorialCandidates:report.filter(x=>x.experiment==="B" && x.editorial_index_candidate).length,
  blogOriginalLinks:blogLinks.length,
  livePagesModified:0,
  previewRobots:"noindex + Disallow /"
};
console.log(JSON.stringify(summary,null,2));
