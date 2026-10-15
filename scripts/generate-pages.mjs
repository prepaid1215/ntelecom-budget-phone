import fs from "node:fs";

const read = p => JSON.parse(fs.readFileSync(p,"utf8"));
const rawPlans = read("src/data/research/plans.json");
const cards = read("src/data/research/cards.json");
const benefits = read("src/data/research/benefits.json");
const activation = read("src/data/research/activation-rules.json");
const overrides = read("src/data/owner-overrides.json");
const tagMeta = read("src/data/tag-meta.json");

const cleanName=n=>String(n||"").replace(/후불\s*/g," ").replace(/\s+/g," ").trim();
const plans = rawPlans.filter(p=>p.active).map(p=>{
  const tags = new Set(p.tags || []);
  if (overrides.contract?.apply_to_all_active_plans) tags.add(overrides.contract.tag);
  if (activation.devices?.self_phone === true) tags.add("self-phone");
  return {...p, name:cleanName(p.name), contract:p.contract || overrides.contract?.value || null, tags:[...tags].sort()};
});

const pages=[];
const seen=new Set();
const add=(row)=>{
  if(seen.has(row.path)) return false;
  const supportingPlanIds=row.supportingPlanIds||[];
  seen.add(row.path);
  pages.push({
    id:pages.length+1,
    supportCount:supportingPlanIds.length,
    effectiveIndex:row.indexCandidate&&supportingPlanIds.length ? "index":"noindex",
    priority:"P1",
    requiredTags:[],
    supportingPlanIds,
    ...row
  });
  return true;
};
const allIds=plans.map(p=>p.id);
const support=(tags)=>plans.filter(p=>tags.every(t=>p.tags.includes(t))).map(p=>p.id);

add({path:"/",keyword:"앤텔레콤 알뜰폰",pageType:"home",template:"T0",requiredTags:["ntelecom"],supportingPlanIds:allIds,indexCandidate:true,priority:"P0",angle:"판매 중인 요금제를 한곳에서 비교"});
add({path:"/plans/",keyword:"앤텔레콤 요금제",pageType:"hub",template:"T1",requiredTags:["ntelecom"],supportingPlanIds:allIds,indexCandidate:true,priority:"P0",angle:"데이터·가격·망별 요금제 비교"});
add({path:"/card/",keyword:"앤텔레콤 제휴카드",pageType:"card-hub",template:"T4",supportingPlanIds:allIds,indexCandidate:true,priority:"P0",angle:"K망·L망 제휴카드 할인 조건 비교"});
add({path:"/benefits/",keyword:"앤텔레콤 혜택",pageType:"benefit-hub",template:"T4",supportingPlanIds:[...new Set(benefits.flatMap(b=>b.eligible_plan_ids||[]))],indexCandidate:true,priority:"P0",angle:"혜택별로 고르는 요금제"});
add({path:"/guide/",keyword:"앤텔레콤 개통 안내",pageType:"guide-hub",template:"T5",supportingPlanIds:allIds,indexCandidate:true,angle:"신청부터 개통까지 한눈에"});
add({path:"/compare/",keyword:"앤텔레콤 요금제 비교",pageType:"compare-hub",template:"T5",supportingPlanIds:allIds,indexCandidate:true,angle:"가격·데이터·혜택 한눈에 비교"});

const cardPathById={
  "card-kt-my-alttel-bc-baro":"/card/kt-my-alttle-bc-baro/",
  "card-uplus-mvno-partners-samsung":"/card/uplus-partners-samsung/"
};
for(const c of cards){
  const ids=plans.filter(p=>(c.eligible_networks||[]).includes(p.network)).map(p=>p.id);
  add({path:cardPathById[c.id]||`/card/${c.id.replace("card-","")}/`,keyword:`앤텔레콤 ${c.name}`,pageType:"card",template:"T4",supportingPlanIds:ids,indexCandidate:!!c.active&&!!ids.length,priority:"P0",angle:`${c.name} 실적별 할인액 비교`,cardId:c.id});
}
for(const b of benefits){
  const ids=(b.eligible_plan_ids||[]).filter(id=>allIds.includes(id));
  add({path:`/benefits/${b.id.replace("benefit-","")}/`,keyword:`앤텔레콤 ${b.name} 요금제`,pageType:"benefit",template:"T4",supportingPlanIds:ids,indexCandidate:!!b.active&&ids.length>=2,angle:`${b.name} 혜택이 붙는 요금제`,benefitId:b.id});
}
for(const p of plans){
  const short=p.id.replace("ntelecom-k-","").replace("ntelecom-l-","");
  add({path:`/plans/${p.network.toLowerCase()}/item/${short}/`,keyword:p.name,pageType:"plan",template:"T2",requiredTags:p.tags,supportingPlanIds:[p.id],indexCandidate:true,angle:p.data_text||"",planId:p.id});
}

const tagPath=t=>{
  const g=tagMeta[t]?.group;
  if(t==="k-network") return "/plans/k/";
  if(t==="l-network") return "/plans/l/";
  if(g==="data") return `/plans/${t}/`;
  if(g==="speed") return `/plans/speed/${t}/`;
  if(g==="price") return `/plans/price/${t}/`;
  if(g==="join") return t==="new-number"?"/new-number/":"/number-transfer/";
  if(g==="contract") return "/no-contract/";
  if(g==="device") return "/self-phone/";
  if(g==="benefit") return `/benefits/${t}/`;
  if(g==="network-type") return `/plans/${t}/`;
  return `/plans/filter/${t}/`;
};
const tagKeyword=t=>{
  const m=tagMeta[t];
  if(m.group==="join") return `앤텔레콤 ${m.label}`;
  if(m.group==="contract") return "앤텔레콤 무약정";
  if(m.group==="device") return "앤텔레콤 자급제";
  return `앤텔레콤 ${m.label} 요금제`;
};

for(const [t,m] of Object.entries(tagMeta)){
  if(["ntelecom","kt","lg"].includes(t)) continue;
  const ids=support([t]);
  if(!ids.length) continue;
  add({path:tagPath(t),keyword:tagKeyword(t),pageType:"tag",template:"T2",requiredTags:[t],supportingPlanIds:ids,indexCandidate:ids.length>=2,priority:["k-network","l-network","15gb","under-30000","number-transfer","no-contract"].includes(t)?"P0":"P1",angle:`${m.label} 요금제 모아보기`});
}

const groups={};
for(const [t,m] of Object.entries(tagMeta)) (groups[m.group] ||= []).push(t);
const pairRules=[
["network","data"],["network","price"],["network","speed"],["data","speed"],
["data","price"],["data","join"],["data","benefit"],["price","join"],
["price","benefit"],["speed","benefit"],["join","benefit"],["contract","data"],
["contract","price"],["contract","benefit"],["device","data"],["device","price"],["device","benefit"]
];
const comboPath=(ga,gb,a,b)=>{
  if(ga==="network"&&gb==="data") return `/plans/${a==="k-network"?"k":"l"}/${b}/`;
  if(ga==="network"&&gb==="price") return `/plans/${a==="k-network"?"k":"l"}/price/${b}/`;
  if(ga==="network"&&gb==="speed") return `/plans/${a==="k-network"?"k":"l"}/speed/${b}/`;
  if(ga==="data"&&gb==="speed") return `/plans/${a}/${b}/`;
  if(ga==="data"&&gb==="price") return `/plans/${a}/price/${b}/`;
  if(ga==="data"&&gb==="join") return `/${b==="new-number"?"new-number":"number-transfer"}/${a}/`;
  if(ga==="data"&&gb==="benefit") return `/benefits/${b}/${a}/`;
  if(ga==="price"&&gb==="join") return `/${b==="new-number"?"new-number":"number-transfer"}/price/${a}/`;
  if(ga==="price"&&gb==="benefit") return `/benefits/${b}/price/${a}/`;
  if(ga==="speed"&&gb==="benefit") return `/benefits/${b}/speed/${a}/`;
  if(ga==="join"&&gb==="benefit") return `/${a==="new-number"?"new-number":"number-transfer"}/benefits/${b}/`;
  if(ga==="contract"&&gb==="data") return `/no-contract/${b}/`;
  if(ga==="contract"&&gb==="price") return `/no-contract/price/${b}/`;
  if(ga==="contract"&&gb==="benefit") return `/no-contract/benefits/${b}/`;
  if(ga==="device"&&gb==="data") return `/self-phone/${b}/`;
  if(ga==="device"&&gb==="price") return `/self-phone/price/${b}/`;
  if(ga==="device"&&gb==="benefit") return `/self-phone/benefits/${b}/`;
  return null;
};
for(const [ga,gb] of pairRules){
  for(const a of groups[ga]||[]) for(const b of groups[gb]||[]){
    const ids=support([a,b]);
    if(!ids.length) continue;
    const path=comboPath(ga,gb,a,b);
    if(!path) continue;
    add({path,keyword:`앤텔레콤 ${tagMeta[a].label} ${tagMeta[b].label} 요금제`,pageType:"combo",template:"T3",requiredTags:[a,b],supportingPlanIds:ids,indexCandidate:ids.length>=2,angle:`${tagMeta[a].label} · ${tagMeta[b].label} 요금제 모아보기`});
  }
}
add({path:"/number-transfer/restrictions/",keyword:"앤텔레콤 번호이동 제한",pageType:"guide",template:"T5",requiredTags:["number-transfer"],supportingPlanIds:support(["number-transfer"]),indexCandidate:true,priority:"P0",angle:"연체·최근 번호이동 제한 정리"});
add({path:"/self-phone/guide/",keyword:"앤텔레콤 자급제폰 개통",pageType:"guide",template:"T5",requiredTags:["self-phone"],supportingPlanIds:support(["self-phone"]),indexCandidate:true,priority:"P0",angle:"자급제폰으로 요금제 쓰기"});
add({path:"/card/compare/",keyword:"앤텔레콤 K망 L망 제휴카드 비교",pageType:"compare",template:"T5",supportingPlanIds:allIds,indexCandidate:true,priority:"P0",angle:"두 카드의 실적·할인액 비교"});

const adAngles=[["price","월 요금"],["number-transfer","번호이동"],["new-number","신규가입"],["benefit","혜택"],["card","카드 할인"]];
const adSubtitle={"price":"월 요금부터 확인하세요","number-transfer":"번호 그대로 옮겨 쓰세요","new-number":"새 번호로 가볍게 시작하세요","benefit":"혜택까지 챙겨 가입하세요","card":"카드 할인까지 반영한 실제 납부액"};
const short=p=>p.id.replace("ntelecom-k-","").replace("ntelecom-l-","");
for(const [key,label] of adAngles){
  for(const p of plans){
    if(pages.length>=500) break;
    if(key==="number-transfer"&&!p.tags.includes("number-transfer")) continue;
    if(key==="new-number"&&!p.tags.includes("new-number")) continue;
    if(key==="benefit"&&!(p.benefit_ids||[]).length) continue;
    if(key==="card"&&!cards.some(c=>c.active&&(c.eligible_networks||[]).includes(p.network))) continue;
    add({path:`/lp/${p.network.toLowerCase()}/${short(p)}/${key}/`,keyword:`${p.name} ${label}`,pageType:"ad",template:"T6",requiredTags:p.tags,supportingPlanIds:[p.id],indexCandidate:false,priority:"P2",angle:adSubtitle[key],planId:p.id,adAngle:key});
  }
  if(pages.length>=500) break;
}
const supportedTags=Object.keys(tagMeta).filter(t=>support([t]).length>=2&&!["ntelecom","kt","lg"].includes(t));
const catAngles=[l=>`${l} 요금제 한눈에 비교`,l=>`${l} 가장 저렴한 요금제는?`,l=>`${l} 요금제, 약정 없이 시작`,l=>`${l} 요금제 지금 확인`];
let v=1;
while(pages.length<500&&v<=20){
  for(const t of supportedTags){
    if(pages.length>=500) break;
    add({path:`/lp/category/${t}/v${v}/`,keyword:`앤텔레콤 ${tagMeta[t].label} 요금제`,pageType:"ad",template:"T6",requiredTags:[t],supportingPlanIds:support([t]),indexCandidate:false,priority:"P2",angle:catAngles[(v-1)%catAngles.length](tagMeta[t].label),adAngle:"category"});
  }
  v++;
}
if(pages.length!==500) throw new Error(`500 pages expected, got ${pages.length}`);
fs.writeFileSync("src/data/generated-pages.json",JSON.stringify(pages,null,2),"utf8");
console.log(`generated ${pages.length} pages / index ${pages.filter(p=>p.effectiveIndex==="index").length} / noindex ${pages.filter(p=>p.effectiveIndex==="noindex").length}`);
