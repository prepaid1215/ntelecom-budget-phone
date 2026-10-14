import pages from "../data/generated-pages.json";
import tagMeta from "../data/tag-meta.json";
import faqs from "../data/faqs.json";
import { plans, cards, benefits, activation, planById, cardById, benefitById, cardsForPlan, benefitsForPlan, promoActive } from "./catalog.js";

const seed = s => [...String(s)].reduce((a,c)=>a+c.charCodeAt(0),0);
const pick = (key, arr) => arr[seed(key)%arr.length];

export function plansForPage(page){
  if(page.supportingPlanIds?.length){
    return page.supportingPlanIds.map(planById).filter(Boolean);
  }
  if(page.requiredTags?.length){
    return plans.filter(p=>page.requiredTags.every(t=>p.tags.includes(t)));
  }
  return plans;
}

function faqScore(faq, page){
  const tags = new Set(["all", ...(page.requiredTags||[])]);
  if(page.pageType.includes("card")) tags.add("card");
  let score=0;
  for(const t of faq.tags||[]) if(tags.has(t)) score += t==="all" ? 1 : 5;
  return score;
}
function pageFaqs(page){
  return faqs.map(f=>({f,score:faqScore(f,page)}))
    .filter(x=>x.score>0).sort((a,b)=>b.score-a.score)
    .slice(0,4).map(x=>x.f);
}
function related(page){
  const mine = new Set(page.requiredTags||[]);
  return pages.filter(p=>p.path!==page.path && p.effectiveIndex==="index")
    .map(p=>{
      const overlap=(p.requiredTags||[]).filter(t=>mine.has(t)).length;
      const sameType=p.pageType===page.pageType?2:0;
      const priority=p.priority==="P0"?1:0;
      return {p,score:overlap*4+sameType+priority};
    })
    .sort((a,b)=>b.score-a.score || a.p.id-b.p.id)
    .slice(0,6).map(x=>x.p);
}

function effectiveTags(page){
  if(!page.planId) return new Set(page.requiredTags||[]);
  const a=page.adAngle;
  if(a==="number-transfer") return new Set(["number-transfer"]);
  if(a==="new-number") return new Set(["new-number"]);
  if(a==="benefit") return new Set(["content-benefit"]);
  return new Set();
}

function lastHangul(word){
  const chars=[...String(word)].filter(c=>/[가-힣]/.test(c));
  return chars.length ? chars[chars.length-1] : null;
}
const hasBatchim=word=>{
  const c=lastHangul(word);
  return c ? (c.charCodeAt(0)-0xAC00)%28!==0 : false;
};
const topic=word=>word+(hasBatchim(word)?"은":"는");
const withTool=word=>word+(hasBatchim(word) && (lastHangul(word).charCodeAt(0)-0xAC00)%28!==8 ? "으로" : "로");

const won=n=>n.toLocaleString("ko-KR")+"원";

function directAnswer(page, matched){
  const tags=effectiveTags(page);
  const n=matched.length;
  if(page.pageType==="ad" && page.planId && matched[0]){
    const p=matched[0];
    const head=`${topic(p.name)} 월 기본료 ${won(p.monthly_price)}, ${p.data_text} 조건이에요.`;
    if(page.adAngle==="number-transfer") return head+" 쓰던 번호 그대로 옮길 수 있어요. 요금을 연체 중이거나 최근 3개월 안에 번호이동을 했다면 제한될 수 있어요.";
    if(page.adAngle==="new-number") return head+" 새 번호로 가입하는 방법으로 신청할 수 있어요.";
    if(page.adAngle==="benefit"){
      const names=benefitsForPlan(p).map(b=>b.name).join(", ");
      return head+(names ? ` ${names} 혜택이 함께 붙어요.` : "");
    }
    if(page.adAngle==="card"){
      const c=cardsForPlan(p)[0];
      return head+(c?.max_monthly_discount ? ` ${withTool(c.name)} 전월 실적을 채우면 최대 ${won(c.max_monthly_discount)}까지 할인받을 수 있어요.` : "");
    }
    return head+" 제휴카드 할인을 받으면 실제 납부액은 더 낮아질 수 있어요.";
  }
  if(page.path==="/plans/") return "한 달에 쓰는 데이터와 예산을 먼저 정하고, K망·L망 상품을 비교하면 금방 고를 수 있어요.";
  if(page.pageType==="plan" && matched[0]){
    const p=matched[0];
    return `${topic(p.name)} 월 기본료 ${won(p.monthly_price)}에 ${p.data_text}가 제공되는 후불 요금제예요.`;
  }
  if(page.pageType==="card"){
    const c=cardById(page.cardId);
    return c ? `${topic(c.name)} 앤텔레콤 ${c.eligible_networks.join("·")}망 요금제에 쓸 수 있는 제휴카드예요. 전월 카드 실적에 따라 할인액이 달라져요.` : page.angle;
  }
  if(page.pageType==="benefit"){
    const b=benefitById(page.benefitId);
    return b ? `${b.name} 혜택이 붙는 앤텔레콤 후불 요금제를 모았어요. 지급액과 조건은 요금제마다 다르니 신청 전에 확인하세요.` : page.angle;
  }
  if(page.path==="/card/") return "K망은 KT 마이알뜰폰 BC 바로카드, L망은 U+알뜰폰 파트너스 삼성카드를 쓸 수 있어요. 카드 할인은 전월 실적을 채워야 적용돼요.";
  if(page.path==="/card/compare/") return "두 카드 모두 연회비가 있고 통신요금 자동납부가 필요해요. 전월 실적 구간별 할인액을 비교해 보세요.";
  if(page.path==="/benefits/") return "쿠팡캐쉬, 네이버페이, 다이소 등 혜택이 붙는 요금제를 혜택별로 모았어요.";
  if(page.path==="/guide/") return "요금제를 고르고 신청하면 본사 확인 전화(해피콜)를 거쳐 개통돼요. 신청만으로는 개통이 끝나지 않으니 전화를 꼭 받아 주세요.";
  if(page.path==="/compare/") return `판매 중인 ${n}개 요금제를 월 기본료와 데이터 기준으로 한눈에 비교할 수 있어요.`;
  if(tags.has("number-transfer")) return "지금 쓰는 번호를 그대로 옮기는 가입이에요. 요금을 연체 중이거나 최근 3개월 안에 번호이동을 했다면 제한될 수 있어요.";
  if(tags.has("self-phone")) return "가지고 있는 자급제폰에 유심만 꽂아 쓸 수 있어요. 단말을 새로 사지 않아도 돼요.";
  if(tags.has("no-contract")) return `약정 없이 가입할 수 있는 요금제 ${n}개를 모았어요.`;
  if(tags.has("k-network") && tags.size===1) return `KT망을 쓰는 K망 요금제 ${n}개를 월 기본료와 데이터 기준으로 모았어요.`;
  if(tags.has("l-network") && tags.size===1) return `LG U+망을 쓰는 L망 요금제 ${n}개를 월 기본료와 데이터 기준으로 모았어요.`;
  return `${page.angle}. 조건에 맞는 요금제 ${n}개를 모았어요.`;
}

function checks(page){
  const tags=effectiveTags(page);
  const cardFocus=page.pageType.includes("card") || page.adAngle==="card";
  const out=[
    ["월 기본료","카드 할인을 빼기 전, 요금제 자체의 월 요금이에요."],
    ["데이터","기본 제공량과 다 쓴 뒤 속도(Mbps)를 같이 보세요."],
    ["통화·문자","기본제공인지, 100분·300분처럼 제한이 있는지 확인하세요."]
  ];
  if(tags.has("number-transfer")) out.push(["번호이동 제한","요금 연체나 최근 번호이동 이력이 있으면 막힐 수 있어요."]);
  else if(cardFocus) out.push(["카드 조건","전월 실적, 연회비, 자동납부, 프로모션 기간을 따로 확인하세요."]);
  else if([...tags].some(t=>["coupang","naverpay","daiso","content-benefit","oliveyoung","cu"].includes(t))) out.push(["혜택 조건","지급액과 지급 방식, 유지 조건은 신청 전에 다시 확인하세요."]);
  else out.push(["가입 방법","신규가입인지 번호이동인지에 따라 절차가 조금 달라요."]);
  return out.slice(0,4);
}

const callTip="신청 후 본사 확인 전화(해피콜)를 받아야 개통이 완료돼요.";

function steps(page){
  const tags=effectiveTags(page);
  const cardFocus=page.pageType.includes("card") || page.adAngle==="card";
  if(tags.has("number-transfer")) return [
    ["1","회선 상태 확인","요금 연체나 최근 번호이동 이력이 없는지 먼저 확인하세요."],
    ["2","요금제 선택","쓰는 데이터와 통화량에 맞춰 월 기본료를 비교하세요."],
    ["3","유심 준비","쓰던 휴대폰에 꽂을 유심을 준비하세요."],
    ["4","번호이동으로 신청",callTip]
  ];
  if(tags.has("new-number")) return [
    ["1","휴대폰 준비","자급제폰 등 사용할 휴대폰을 정하세요."],
    ["2","요금제 선택","데이터와 월 요금을 비교해 고르세요."],
    ["3","유심 준비","선택한 망(K망·L망)에 맞는 유심을 준비하세요."],
    ["4","신규가입으로 신청",callTip]
  ];
  if(cardFocus) return [
    ["1","기본료 확인","카드 할인 전 요금제 가격부터 확인하세요."],
    ["2","전월 실적 확인","실적 구간마다 할인액이 달라요."],
    ["3","추가 조건 확인","자동납부, 생활요금 할인, 기간 한정 프로모션을 따로 보세요."],
    ["4","요금제 선택 후 신청",callTip]
  ];
  return [
    ["1","필요한 데이터 정하기","최근 한 달 사용량을 기준으로 구간을 정하세요."],
    ["2","월 요금 비교하기","비슷한 데이터라면 기본료가 낮은 쪽부터 보세요."],
    ["3","혜택·카드 확인하기","요금제를 정한 뒤 혜택과 카드 할인을 따로 확인하세요."],
    ["4","신청하기",callTip]
  ];
}

function metaFor(page,matched){
  const low=matched.length ? Math.min(...matched.map(p=>p.monthly_price)) : null;
  let text;
  if(page.planId && matched[0]) text=`${matched[0].name}: 월 ${won(matched[0].monthly_price)}, ${matched[0].data_text}. 제휴카드 할인을 반영한 실제 납부액까지 확인해 보세요.`;
  else if(page.pageType==="home") text="앤텔레콤 후불 알뜰폰 요금제를 월 요금·데이터·제휴카드 할인까지 한 번에 비교하세요. 약정 없이 "+(low ? won(low)+"부터." : "가입할 수 있어요.");
  else text=`${page.keyword}, ${page.angle}.${matched.length>1 ? " 판매 중인 요금제 "+matched.length+"개를 월 요금과 데이터 기준으로 비교해 보세요." : ""}${low ? " "+won(low)+"부터 시작해요." : ""}`;
  if(text.length<70) text+=" 가입 전에 현재 판매 여부와 망, 통화·문자 조건, 혜택 적용 기준을 함께 확인하세요.";
  return text;
}

export function buildModel(page){
  const matched=plansForPage(page);
  const one=page.planId ? planById(page.planId) : null;
  const pageCards = one ? cardsForPlan(one) :
    page.cardId ? [cardById(page.cardId)].filter(Boolean) :
    cards.filter(c=>c.active && matched.some(p=>(c.eligible_networks||[]).includes(p.network)));
  const pageBenefits = one ? benefitsForPlan(one) :
    page.benefitId ? [benefitById(page.benefitId)].filter(Boolean) :
    benefits.filter(b=>b.active && matched.some(p=>(b.eligible_plan_ids||[]).includes(p.id)));

  const titleVariants=[
    page.keyword+" 요금·조건 비교",
    page.keyword+" 월 요금 한눈에 보기",
    page.keyword+" 한눈에 정리"
  ];
  const selectedTitle=pick(page.path+"title",titleVariants);
  const compactQualifier=page.pageType==="benefit" ? "혜택 안내" : "요금 비교";
  const seoTitle=selectedTitle.length<=48 ? selectedTitle : page.keyword+" | "+compactQualifier;
  return {
    page,
    matched,
    one,
    cards:pageCards,
    benefits:pageBenefits,
    directAnswer:directAnswer(page,matched),
    checks:checks(page),
    steps:steps(page),
    faqs:pageFaqs(page),
    related:related(page),
    seoTitle:page.pageType==="home" ? "앤텔레콤 알뜰폰" : seoTitle,
    meta:metaFor(page,matched),
    activation,
    promoActive
  };
}
