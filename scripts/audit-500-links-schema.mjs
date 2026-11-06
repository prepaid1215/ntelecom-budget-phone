// Independent built-HTML checks for paths, assets and metadata across 500 MVNO URLs.
import fs from "node:fs";
import path from "node:path";
import pages from "../src/data/generated-pages.json" with {type:"json"};
const dist=path.resolve("dist"),out=path.resolve("audit-results");
fs.mkdirSync(out,{recursive:true});
const issues=[];
const seenDescription=new Map();
const known=new Set([...pages.map(p=>p.path),"/선불폰/","/알뜰폰/","/start/","/404/"]);
const fileFor=r=>path.join(dist,...r.split("/").filter(Boolean),"index.html");
const check=(level,kind,url,detail)=>issues.push({level,kind,url,detail});
let scanned=0,imageCount=0,localLinks=0,schemas=0,missingDescriptions=0;
for(const p of pages){
 const fp=fileFor(p.path);
 if(!fs.existsSync(fp))continue;
 const html=fs.readFileSync(fp,"utf8");
 scanned++;
 const description=(html.match(/<meta name="description" content="([^"]*)"/)||[])[1]||"";
 if(!description)missingDescriptions++;
 if(seenDescription.has(description)&&p.effectiveIndex==="index")
   check("warning","description-same",p.path,seenDescription.get(description));
 else if(p.effectiveIndex==="index")seenDescription.set(description,p.path);
 const schema=(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)||[])[1]||"";
 try {
  const parsed=JSON.parse(schema);
  if(!Array.isArray(parsed["@graph"]) || !parsed["@graph"].some(x=>x["@type"]==="WebPage"))
   check("error","schema-missing-webpage",p.path,"");
  else schemas++;
 }catch(e){check("error","invalid-json-ld",p.path,String(e.message))}
 for(const m of html.matchAll(/<img\b[^>]*>/g)){
  imageCount++;
  const img=m[0];
  if(!/\balt="/.test(img))check("error","image-alt-missing",p.path,img.slice(0,130));
  if(!/\bwidth="/.test(img)||!/\bheight="/.test(img))check("warning","image-size-missing",p.path,img.slice(0,130));
 }
 for(const href of html.matchAll(/\bhref="([^"]*)"/g)){
  const raw=href[1];
  if(!raw.startsWith("/") || raw.startsWith("//"))continue;
  const route=decodeURIComponent(raw.split(/[?#]/)[0]);
  if(!route)continue;
  localLinks++;
  if(route.startsWith("/_astro/")||route.startsWith("/images/")||route==="/favicon.svg"){
   if(!fs.existsSync(path.join(dist,...route.split("/").filter(Boolean))))
     check("error","asset-link-broken",p.path,route);
   continue;
  }
  if(route.match(/\.(xml|txt|svg|jpg|png|webp|pdf|js|css)$/i)){
   if(!fs.existsSync(path.join(dist,...route.split("/").filter(Boolean))))
     check("error","file-link-broken",p.path,route);
   continue;
  }
  const normalized=route.endsWith("/")?route:route+"/";
  if(!known.has(normalized) || !fs.existsSync(fileFor(normalized)))
   check("error","internal-link-broken",p.path,normalized);
 }
}
const categoryCounts={};
for(const issue of issues)categoryCounts[issue.level+":"+issue.kind]=(categoryCounts[issue.level+":"+issue.kind]||0)+1;
const result={scanned,schemas,imageCount,localLinks,missingDescriptions,errors:issues.filter(x=>x.level==="error").length,warnings:issues.filter(x=>x.level==="warning").length,categoryCounts,issues};
fs.writeFileSync(path.join(out,"link-schema-results.json"),JSON.stringify(result,null,2)+"\n");
console.log("LINKS AND SCHEMA AUDIT SUMMARY\n"+JSON.stringify({...result,issues:issues.slice(0,20)},null,2));
if(result.errors)process.exitCode=1;
