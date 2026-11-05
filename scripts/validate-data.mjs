import fs from "node:fs";
const read=p=>JSON.parse(fs.readFileSync(p,"utf8"));
const plans=read("src/data/research/plans.json");
const cards=read("src/data/research/cards.json");
const benefits=read("src/data/research/benefits.json");
const pages=read("src/data/generated-pages.json");
const errors=[];

const planIds=new Set();
for(const p of plans){
 if(planIds.has(p.id)) errors.push(`중복 plan id: ${p.id}`); planIds.add(p.id);
 if(p.active && !Number.isFinite(p.monthly_price)) errors.push(`가격 오류: ${p.id}`);
 if(p.provider!=="ntelecom") errors.push(`타 사업자 혼입: ${p.id}`);
 if(!["K","L"].includes(p.network)) errors.push(`망 오류: ${p.id}`);
 if(!p.source_urls?.length) errors.push(`출처 없음: ${p.id}`);
}
const cardIds=new Set(cards.map(c=>c.id));
const benefitIds=new Set(benefits.map(b=>b.id));
for(const p of plans){
 for(const id of p.card_ids||[]) if(!cardIds.has(id)) errors.push(`없는 card_id: ${p.id} -> ${id}`);
 for(const id of p.benefit_ids||[]) if(!benefitIds.has(id)) errors.push(`없는 benefit_id: ${p.id} -> ${id}`);
}
const paths=new Set();
for(const p of pages){
 if(paths.has(p.path)) errors.push(`중복 path: ${p.path}`); paths.add(p.path);
 if(p.path.startsWith("/lp/") && p.effectiveIndex!=="noindex") errors.push(`LP index 오류: ${p.path}`);
 if(p.effectiveIndex==="index" && !(p.supportingPlanIds||[]).length) errors.push(`근거 상품 없는 index: ${p.path}`);
 for(const id of p.supportingPlanIds||[]) if(!planIds.has(id)) errors.push(`없는 supportingPlanId: ${p.path} -> ${id}`);
}
for(const requiredPath of ["/card/kt-my-alttle-bc-baro/","/card/uplus-partners-samsung/"]){
 if(!paths.has(requiredPath)) errors.push(`필수 카드 경로 없음: ${requiredPath}`);
}
if(pages.length!==500) errors.push(`페이지 수 ${pages.length}, 500 필요`);
if(cards.filter(c=>c.active).length!==2) errors.push("활성 제휴카드 2개가 아님");

console.log(`plans ${plans.length}, cards ${cards.length}, benefits ${benefits.length}, pages ${pages.length}`);
console.log(`index ${pages.filter(p=>p.effectiveIndex==="index").length}, noindex ${pages.filter(p=>p.effectiveIndex==="noindex").length}`);
if(errors.length){console.error(errors.join("\n"));process.exit(1)}
console.log("검증 통과");
