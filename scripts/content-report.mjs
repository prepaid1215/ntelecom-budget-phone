import fs from "node:fs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const pages=read("src/data/generated-pages.json");
const plans=read("src/data/research/plans.json");
const cards=read("src/data/research/cards.json");
const benefits=read("src/data/research/benefits.json");
const rows=[["id","path","keyword","page_type","template","support_count","effective_index","priority","angle"]];
for(const p of pages) rows.push([p.id,p.path,p.keyword,p.pageType,p.template,p.supportCount,p.effectiveIndex,p.priority,p.angle]);
const esc=x=>`"${String(x??"").replaceAll('"','""')}"`;
fs.writeFileSync("page-map-500.csv",rows.map(r=>r.map(esc).join(",")).join("\n"),"utf8");
const summary={
 totalPages:pages.length,
 indexPages:pages.filter(p=>p.effectiveIndex==="index").length,
 noindexPages:pages.filter(p=>p.effectiveIndex==="noindex").length,
 plans:plans.length,
 kPlans:plans.filter(p=>p.network==="K").length,
 lPlans:plans.filter(p=>p.network==="L").length,
 cards:cards.length,
 benefits:benefits.length
};
fs.writeFileSync("build-summary.json",JSON.stringify(summary,null,2),"utf8");
console.log(summary);
