import pages from "../data/generated-pages.json";
import tagMeta from "../data/tag-meta.json";
import faqs from "../data/faqs.json";
import { plans, cards, benefits, activation, planById, cardById, benefitById, cardsForPlan, benefitsForPlan, promoActive } from "./catalog.js";

const seed = s => [...String(s)].reduce((a,c)=>a+c.charCodeAt(0),0);
const pick = (key, arr) => arr[seed(key)%arr.length];

const leadVariants = [
  "{keyword}을 찾는다면 먼저 실제 판매 중인 상품부터 좁혀보면 됩니다.",
  "{keyword}에서는 이름보다 월요금·데이터·속도를 먼저 비교하는 편이 빠릅니다.",
  "{keyword}을 고를 때는 현재 가입 가능한 상품과 적용 조건을 함께 봐야 합니다.",
  "{keyword} 검색이라면 필요한 조건을 먼저 정한 뒤 상품을 비교하면 선택이 단순해집니다."
];

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

function directAnswer(page, matched){
  const tags=new Set(page.requiredTags||[]);
  if(page.pageType==="plan" && matched[0]){
    const p=matched[0];
    return `${p.name}은 월 ${p.monthly_price.toLocaleString("ko-KR")}원, ${p.data_text} 조건으로 현재 판매 목록에 등록된 후불 요금제입니다.`;
  }
  if(page.pageType==="card"){
    const c=cardById(page.cardId);
    return c ? `${c.name}은 앤텔레콤 ${c.eligible_networks.join("/")}망에 연결된 제휴카드입니다. 카드 실적에 따라 할인액이 달라집니다.` : page.angle;
  }
  if(page.pageType==="benefit"){
    const b=benefitById(page.benefitId);
    return b ? `${b.name} 혜택이 결합된 앤텔레콤 후불 요금제를 모아 비교합니다. 정확한 지급액·주기·유지조건은 가입 시점의 최종 안내를 함께 확인해야 합니다.` : page.angle;
  }
  if(tags.has("number-transfer")) return `기존 번호를 유지하려는 조건입니다. 조사된 정책상 요금 체납 상태이거나 번호이동 후 3개월이 지나지 않은 경우 제한될 수 있습니다.`;
  if(tags.has("self-phone")) return `자급제 단말을 가지고 있다면 단말을 새로 구매하지 않고 판매 중인 후불 요금제를 연결하는 방향으로 비교할 수 있습니다.`;
  if(tags.has("no-contract")) return `운영자가 확인한 무약정 조건을 기준으로 실제 판매 중인 앤텔레콤 후불 요금제를 비교합니다.`;
  if(tags.has("k-network")) return `앤텔레콤 K망에서 현재 판매 중인 상품만 모아 데이터와 월요금을 비교합니다.`;
  if(tags.has("l-network")) return `앤텔레콤 L망에서 현재 판매 중인 상품만 모아 데이터와 월요금을 비교합니다.`;
  return `${page.angle}. 현재 판매 데이터에 연결된 상품만 기준으로 정리합니다.`;
}

function checks(page){
  const tags=new Set(page.requiredTags||[]);
  const out=[
    ["월 기본료","카드 할인 전 요금제 자체의 월 기본료를 먼저 봅니다."],
    ["데이터","기본 제공량과 소진 후 최대 속도를 함께 봅니다."],
    ["통화·문자","기본제공인지 100분·300분 같은 제한형인지 확인합니다."]
  ];
  if(tags.has("number-transfer")) out.push(["번호이동 제한","체납 및 최근 번호이동 이력 같은 제한조건을 확인합니다."]);
  else if(page.pageType.includes("card")) out.push(["카드 조건","전월실적·연회비·자동납부·프로모션 기간을 분리해서 봅니다."]);
  else if([...tags].some(t=>["coupang","naverpay","daiso","content-benefit","oliveyoung","cu"].includes(t))) out.push(["혜택 조건","지급액·주기·유지조건은 최종 가입 안내에서 다시 확인합니다."]);
  else out.push(["가입 조건","현재 판매 여부와 가입 유형을 마지막에 확인합니다."]);
  return out.slice(0,4);
}

function steps(page){
  const tags=new Set(page.requiredTags||[]);
  if(tags.has("number-transfer")) return [
    ["1","현재 회선 상태 확인","요금 체납이나 최근 번호이동 제한 여부를 먼저 확인합니다."],
    ["2","요금제 선택","데이터·통화량과 월 기본료를 비교합니다."],
    ["3","유심과 단말 준비","사용할 단말과 유심 조건을 준비합니다."],
    ["4","번호이동으로 신청","바로 개통하기에서 번호이동 절차를 진행합니다."]
  ];
  if(tags.has("new-number")) return [
    ["1","사용할 단말 준비","자급제 등 사용할 휴대폰을 정합니다."],
    ["2","요금제 선택","데이터와 월요금을 비교합니다."],
    ["3","유심 준비","사용할 망에 맞는 유심을 준비합니다."],
    ["4","신규가입 진행","개통 페이지에서 새 번호 가입을 진행합니다."]
  ];
  if(page.pageType.includes("card")) return [
    ["1","기본요금 확인","카드 할인 전 요금제 가격을 먼저 확인합니다."],
    ["2","전월실적 확인","실적 구간별 기본 할인액을 확인합니다."],
    ["3","추가 조건 확인","자동납부·생활요금·기간 한정 프로모션을 분리해서 봅니다."],
    ["4","요금제 선택","실제 사용할 요금제를 정한 뒤 개통으로 이동합니다."]
  ];
  return [
    ["1","필요 데이터 정하기","최근 한 달 사용량을 기준으로 구간을 정합니다."],
    ["2","월요금 좁히기","비슷한 데이터 조건에서 기본료를 비교합니다."],
    ["3","혜택·카드 확인","상품을 정한 뒤 부가 혜택과 카드 할인을 따로 봅니다."],
    ["4","바로 개통","선택이 끝났다면 개통 페이지로 이동합니다."]
  ];
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

  const lead=pick(page.path,leadVariants).replace("{keyword}",page.keyword);
  const titleVariants=[
    page.keyword+" "+page.angle,
    page.keyword+" | 조건·월요금 비교",
    page.keyword+", 현재 판매 상품 기준 정리",
    page.keyword+" 요금제와 가입 조건"
  ];
  const selectedTitle=pick(page.path+"title",titleVariants);
  const compactQualifier=page.pageType==="benefit" ? "혜택 안내" : page.pageType==="tag" ? "판매 상품 비교" : "요금·조건 비교";
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
    lead,
    seoTitle:page.pageType==="home" ? "앤텔레콤 알뜰폰" : seoTitle,
    meta:`${page.keyword}을 현재 판매 중인 앤텔레콤 후불 상품 기준으로 정리했습니다. ${page.angle}, 월요금, 데이터, 관련 조건을 비교하세요.`,
    activation,
    promoActive
  };
}
