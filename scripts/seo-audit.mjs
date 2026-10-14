import fs from "node:fs";
import path from "node:path";
import rawSite from "../src/data/site.json" with { type: "json" };
import pages from "../src/data/generated-pages.json" with { type: "json" };

const root=path.resolve("dist");
const productionReady=process.env.PRODUCTION_READY==="true" ? true : process.env.PRODUCTION_READY==="false" ? false : rawSite.productionReady;
const expectedOrigin=new URL(process.env.SITE_URL?.trim() || rawSite.siteUrl);
expectedOrigin.pathname="/";
expectedOrigin.search="";
expectedOrigin.hash="";
const baseValue=String(process.env.BASE_PATH || "/").trim().replace(/^\/+|\/+$/g,"");
const basePrefix=baseValue ? "/"+baseValue : "";
const withBase=value=>basePrefix+(value.startsWith("/") ? value : "/"+value);

const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
  const full=path.join(dir,entry.name);
  return entry.isDirectory()?walk(full):[full];
});
const htmlFiles=walk(root).filter(file=>file.endsWith(".html"));
const routeFor=file=>{
  const relative=path.relative(root,file).split(path.sep).join("/");
  if(relative==="index.html") return "/";
  return "/"+relative.replace(/index\.html$/,"");
};
const pageByPath=new Map(pages.map(page=>[page.path,page]));
const builtRoutes=new Set(htmlFiles.map(routeFor));
const errors=[];
const titles=new Map();
const canonicals=new Map();
const recordDuplicate=(map,value,route,label)=>{
  const previous=map.get(value);
  if(previous) errors.push(label+" 중복: "+previous+", "+route);
  else map.set(value,route);
};
const attr=(html,pattern)=>html.match(pattern)?.[1] || "";

for(const file of htmlFiles){
  const html=fs.readFileSync(file,"utf8");
  const route=routeFor(file);
  const source=pageByPath.get(route);
  if(!source) errors.push("페이지 맵에 없는 HTML: "+route);

  const title=attr(html,/<title>([\s\S]*?)<\/title>/i);
  const description=attr(html,/<meta name="description" content="([^"]+)"/i);
  const robots=attr(html,/<meta name="robots" content="([^"]+)"/i);
  const googlebot=attr(html,/<meta name="googlebot" content="([^"]+)"/i);
  const canonical=attr(html,/<link rel="canonical" href="([^"]+)"/i);
  const hreflang=attr(html,/<link rel="alternate" hreflang="ko-KR" href="([^"]+)"/i);
  const expectedCanonical=new URL(withBase(route),expectedOrigin).toString();
  const expectedRobots=productionReady && source?.effectiveIndex==="index" ? "index,follow" : "noindex,follow";

  if(!title) errors.push("title 없음: "+route);
  if(!description) errors.push("description 없음: "+route);
  if(title.length>60) errors.push("title 60자 초과: "+route+" ("+title.length+")");
  if(description.length<70 || description.length>160) errors.push("description 길이 오류: "+route+" ("+description.length+")");
  if(canonical!==expectedCanonical) errors.push("canonical 오류: "+route+" -> "+canonical);
  if(hreflang!==canonical) errors.push("hreflang 오류: "+route);
  if(robots!==expectedRobots) errors.push("robots 오류: "+route+" -> "+robots);
  if(googlebot!==robots) errors.push("googlebot 불일치: "+route);
  if((html.match(/<h1\b/gi)||[]).length!==1) errors.push("h1 개수 오류: "+route);
  for(const required of ['property="og:title"','property="og:description"','property="og:url"','property="og:image"','name="twitter:card"']){
    if(!html.includes(required)) errors.push("공유 메타 없음("+required+"): "+route);
  }
  const schemaText=attr(html,/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  try{
    const schema=JSON.parse(schemaText);
    if(!Array.isArray(schema["@graph"]) || !schema["@graph"].some(item=>item["@type"]==="WebPage")) throw new Error("WebPage 없음");
  }catch(error){
    errors.push("구조화 데이터 오류: "+route+" ("+error.message+")");
  }
  for(const tag of html.match(/<img\b[^>]*>/gi)||[]){
    if(!/\salt=/.test(tag)) errors.push("이미지 alt 없음: "+route);
    if(!/\swidth=/.test(tag) || !/\sheight=/.test(tag)) errors.push("이미지 크기 없음: "+route);
  }
  for(const href of html.matchAll(/href="([^"]+)"/gi)){
    const value=href[1];
    if(!value.startsWith("/") || value.startsWith("//")) continue;
    const clean=value.split(/[?#]/)[0];
    if(basePrefix && clean!==basePrefix && !clean.startsWith(basePrefix+"/")){
      errors.push("base 경로 누락: "+route+" -> "+value);
      continue;
    }
    const local=basePrefix ? (clean.slice(basePrefix.length) || "/") : clean;
    if(local.startsWith("/images/") || local.startsWith("/_astro/") || local==="/favicon.svg") continue;
    const normalized=local.endsWith("/") ? local : local+"/";
    if(!builtRoutes.has(normalized)) errors.push("깨진 내부 링크: "+route+" -> "+value);
  }
  recordDuplicate(titles,title,route,"title");
  recordDuplicate(canonicals,canonical,route,"canonical");
}

if(htmlFiles.length!==pages.length) errors.push("HTML 수 "+htmlFiles.length+", 페이지 맵 "+pages.length);
const robotsText=fs.readFileSync(path.join(root,"robots.txt"),"utf8");
const sitemapText=fs.readFileSync(path.join(root,"sitemap.xml"),"utf8");
const sitemapUrls=(sitemapText.match(/<url>/g)||[]).length;
const expectedSitemapUrls=productionReady ? pages.filter(page=>page.effectiveIndex==="index").length : 0;
if(sitemapUrls!==expectedSitemapUrls) errors.push("sitemap URL 수 "+sitemapUrls+", 기대값 "+expectedSitemapUrls);
if(productionReady){
  if(!robotsText.includes("Allow: /") || !robotsText.includes("Sitemap:")) errors.push("운영 robots.txt 오류");
  if(robotsText.includes("Disallow: /lp/")) errors.push("noindex 확인을 막는 /lp/ 차단");
}else if(!robotsText.includes("Disallow: /")){
  errors.push("배포 전 robots.txt 전체 차단 없음");
}

console.log(JSON.stringify({
  htmlPages:htmlFiles.length,
  uniqueTitles:titles.size,
  uniqueCanonicals:canonicals.size,
  basePath:basePrefix || "/",
  sitemapUrls,
  productionReady,
  errors:errors.length
},null,2));
if(errors.length){
  console.error(errors.slice(0,100).join("\n"));
  if(errors.length>100) console.error("외 "+(errors.length-100)+"건");
  process.exit(1);
}
