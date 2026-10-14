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
    return b ? `${b.name} 결합 요금제의 현재 혜택은 ${b.value}입니다. ${b.conditions} 조건을 확인하세요.` : page.angle;
  }
  if(page.path==="/card/") return "K망은 KT 마이알뜰폰 BC 바로카드, L망은 U+알뜰폰 파트너스 삼성카드를 쓸 수 있어요. 카드 할인은 전월 실적을 채워야 적용돼요.";
  if(page.path==="/card/compare/") return "두 카드 모두 연회비가 있고 통신요금 자동납부가 필요해요. 전월 실적 구간별 할인액을 비교해 보세요.";
  if(page.path==="/benefits/") return "쿠팡캐쉬, 네이버페이, 다이소 등 혜택이 붙는 요금제를 혜택별로 모았어요.";
  if(page.path==="/guide/") return "요금제를 고르고 신청하면 개통이 완료돼요. 유심을 꽂고 바로 쓰고, 사용 중에 오는 본사 확인 전화(해피콜, 1899-7700)는 꼭 받아 주세요.";
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
  else if([...tags].some(t=>["coupang","naverpay","daiso","content-benefit","oliveyoung","cu"].includes(t))) out.push(["혜택 조건","쿠폰형은 30일 사용 후 31일차 유지, 구독·할인형은 앱 제휴 인증 등 혜택별 조건을 확인하세요."]);
  else out.push(["가입 방법","신규가입인지 번호이동인지에 따라 절차가 조금 달라요."]);
  return out.slice(0,4);
}

const callTip="신청이 끝나면 개통돼요. 이후 해피콜은 꼭 받아 주세요.";

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

function planFaqs(plan, pageCards, pageBenefits){
  const name=plan.name.replace(/^앤텔레콤\s+/,"");
  const out=[];
  const daily=plan.daily_data_gb && !plan.data_gb;
  if(plan.after_speed){
    out.push({q:`${name} 데이터를 다 쓰면 어떻게 되나요?`,a: daily
      ? `매일 ${plan.daily_data_gb}GB를 다 쓰면 최대 ${plan.after_speed} 속도로 계속 쓸 수 있어요.`
      : `기본 ${plan.data_gb}GB${plan.daily_data_gb ? "와 매일 "+plan.daily_data_gb+"GB" : ""}를 다 쓰면 최대 ${plan.after_speed} 속도로 계속 쓸 수 있어요.`});
  }
  if(promoActive(plan.promotion) && plan.monthly_extra_data_gb){
    const end=plan.promotion.end_date ? plan.promotion.end_date.replace(/^(\d+)-0?(\d+)-0?(\d+)$/,"$1년 $2월 $3일") : null;
    out.push({q:`추가 데이터 ${plan.monthly_extra_data_gb}GB는 얼마 동안 받나요?`,a:`가입 후 24개월 동안 매월 ${plan.monthly_extra_data_gb}GB가 더해져요.${end ? " 이 프로모션은 "+end+"까지로 확인돼요." : ""} 기간이 끝나면 기본 제공량만 쓸 수 있어요.`});
  }
  const c=pageCards[0];
  if(c && c.discount_tiers?.length){
    const top=c.discount_tiers[c.discount_tiers.length-1];
    const low=Math.max(0,plan.monthly_price-top.monthly_discount);
    out.push({q:"제휴카드를 쓰면 월 얼마까지 내려가나요?",a:`${withTool(c.name)} 전월 ${Math.round(top.monthly_spend/10000)}만원 이상 쓰면 월 ${won(plan.monthly_price)}에서 ${won(top.monthly_discount)}이 빠져 ${won(low)}이 돼요. 연회비 ${won(c.annual_fee||0)}은 별도예요.`});
  }
  if(pageBenefits.length){
    const b=pageBenefits[0];
    out.push({q:`${b.name} 혜택은 어떻게 받나요?`,a:`${b.value} 혜택입니다. ${b.conditions}이며, ${b.delivery_method} 방식으로 이용합니다. 지급 시점은 ${b.delivery_timing}입니다.`});
  }
  if(plan.port_available===true){
    out.push({q:"지금 쓰는 번호 그대로 가입할 수 있나요?",a:"네, 번호이동으로 가입할 수 있어요. 요금을 연체 중이거나 최근 3개월 안에 번호이동을 했다면 제한될 수 있어요."});
  }
  out.push({q:"약정이 있나요?",a:"약정 없이 가입해요. 다만 프로모션이나 혜택에는 유지 기간 조건이 붙을 수 있어요."});
  out.push({q:"신청하면 바로 개통되나요?",a:"네, 신청이 끝나면 개통이 완료돼요. 유심을 꽂으면 바로 쓸 수 있어요. 다만 사용 중에 본사 확인 전화(해피콜, 1899-7700)가 오면 꼭 받아야 해요. 받지 않으면 회선이 해지될 수 있어요."});
  return out.slice(0,7);
}

function benefitHubFaqs(){
  return [
    {q:"요금제 하나에 혜택을 여러 개 받을 수 있나요?",a:"아니요, 요금제마다 혜택이 한 가지씩 붙어 있어요. 받고 싶은 혜택이 붙은 요금제를 골라야 해요."},
    {q:"혜택은 가입하자마자 받나요?",a:"혜택마다 달라요. 쿠팡캐쉬·네이버페이·다이소·올리브영은 가입·변경일부터 사용일수 30일을 채우고 31일차까지 요금제를 유지해야 쿠폰이 발송돼요. 밀리의서재는 가입일부터 제공되고, CU는 포켓CU 제휴 인증 후 결제 때 할인돼요."},
    {q:"받은 쿠폰을 바로 못 쓰면 어떻게 되나요?",a:"쿠폰은 발행일로부터 30일 안에 등록해야 해요. 등록하지 않으면 소멸하고 재발행되지 않아요."},
    {q:"중간에 요금제를 바꾸거나 해지하면요?",a:"밀리의서재와 CU는 정지·해지·요금제 변경 시 혜택이 중단돼요. 상품권·포인트 혜택은 변경일부터 사용일수를 다시 채워야 해요."},
    {q:"L망 요금제에도 이 혜택이 붙나요?",a:"아니요, 이 6가지 혜택은 모두 K망 요금제에 붙는 혜택이에요."},
    {q:"신청하면 바로 개통되나요?",a:"네, 신청이 끝나면 개통이 완료돼요. 유심을 꽂으면 바로 쓸 수 있어요. 다만 사용 중에 본사 확인 전화(해피콜, 1899-7700)가 오면 꼭 받아야 해요. 받지 않으면 회선이 해지될 수 있어요."}
  ];
}

function cardHubFaqs(){
  return [
    {q:"앤텔레콤에는 어떤 제휴카드를 쓸 수 있나요?",a:"K망 요금제는 KT 마이알뜰폰 BC 바로카드, L망 요금제는 U+알뜰폰 파트너스 삼성카드를 쓸 수 있어요."},
    {q:"카드를 만들면 월 얼마나 할인되나요?",a:"전월 카드 실적 30만원 이상이면 두 카드 모두 월 7,000원이 할인돼요. 실적이 높을수록 커지고, BC 바로카드는 최대 13,000원, 삼성카드는 최대 13,000원(생활요금 자동납부 포함 시 16,000원)이에요."},
    {q:"연회비는 얼마인가요?",a:"두 카드 모두 국내 전용 기준 연회비 20,000원이에요(BC 바로카드의 비자 브랜드는 23,000원). 가장 낮은 구간(7,000원 할인)만 받아도 3개월이면 회수돼요."},
    {q:"카드 할인은 어떻게 적용되나요?",a:"통신요금 자동납부를 앤텔레콤을 통해 카드로 등록하면, 카드사에 요금이 청구되는 시점부터 전월 실적에 따라 할인돼요."},
    {q:"카드 실적을 못 채우면요?",a:"실적 구간별 할인이라 전월 30만원 미만이면 할인이 없어요. 평소 카드 사용액이 30만원 이상인지 먼저 확인하세요."},
    {q:"K망에 삼성카드를 써도 되나요?",a:"아니요. 카드는 망에 맞춰 적용돼요. K망은 BC 바로카드, L망은 삼성카드만 해당돼요."}
  ];
}

function guideFaqs(){
  return [
    {q:"개통까지 얼마나 걸리나요?",a:"신청은 준비물만 있으면 몇 분이면 끝나요. 신청이 끝나면 개통이 완료돼서 유심을 꽂고 바로 쓸 수 있어요."},
    {q:"준비물은 무엇인가요?",a:"편의점에서 산 유심과 본인 명의 휴대폰의 간편인증, 두 가지예요."},
    {q:"K망 요금제에 다이소 유심을 써도 되나요?",a:"아니요. 다이소 유심은 L망에서만 쓸 수 있어요. K망은 바로유심(8982로 시작하는 19자리)을 편의점에서 구매하세요."},
    {q:"유심번호는 어떻게 입력하나요?",a:"K망은 유심 일련번호 숫자 19자리를 입력하고, 마지막 알파벳 F는 빼요. L망은 모델명(알파벳 1개+숫자 4개)과 유심번호(숫자 8개)를 입력하고, 예를 들면 U8680 + 00123456처럼 써요."},
    {q:"해피콜은 어떤 번호로 오나요?",a:"1899-7700으로 걸려 와요. 앤텔레콤 고객센터 번호예요. 사용 중에 이 번호로 전화가 오면 꼭 받아 주세요."},
    {q:"해피콜은 꼭 받아야 하나요?",a:"네. 사용 중에 본사 확인 전화(해피콜, 1899-7700)가 와요. 받지 않으면 회선이 해지될 수 있으니 모르는 번호라도 꼭 받아 주세요."},
    {q:"자급제폰으로도 개통할 수 있나요?",a:"네, 자급제폰에 유심을 꽂아 쓸 수 있어요. LTE 후불 요금제는 5G 자급 단말로도 가입할 수 있어요."},
    {q:"개통하다 막히면 어디로 문의하나요?",a:"카카오톡 채널 채팅이나 전화(010-7305-8253)로 바로 문의하세요. 운영시간은 평일 09:00~18:00이고 점심(12:00~13:00), 주말·공휴일은 쉬어요."}
  ];
}

function transferFaqs(){
  return [
    {q:"요금을 연체 중인데 번호이동할 수 있나요?",a:"아니요, 요금을 연체 중이면 번호이동이 제한돼요. 연체 요금을 먼저 납부한 뒤 신청하세요."},
    {q:"최근에 번호이동했는데 또 옮길 수 있나요?",a:"번호이동 후 3개월이 지나지 않으면 제한돼요. 번호이동관리센터에 직접 신청하는 예외가 있으니, 막히면 문의해 주세요."},
    {q:"번호이동하면 기존 통신사는 어떻게 되나요?",a:"번호이동이 완료되면 기존 통신사 회선은 해지돼요. 약정이나 할부금이 남아 있다면 위약금과 잔여 할부금이 청구될 수 있으니 기존 통신사에서 먼저 확인하세요."},
    {q:"L망 요금제로도 번호이동이 되나요?",a:"번호이동 가능 여부가 확인된 요금제는 K망(KT망) 요금제예요. L망으로 번호이동을 원하면 신청 전에 카카오톡 채널이나 전화(010-7305-8253)로 문의해 주세요."},
    {q:"번호이동하면 바로 쓸 수 있나요?",a:"네, 신청이 끝나면 개통이 완료돼요. 유심을 꽂으면 바로 쓸 수 있어요. 다만 사용 중에 1899-7700으로 본사 확인 전화(해피콜)가 오면 꼭 받아야 해요. 받지 않으면 회선이 해지될 수 있어요."},
    {q:"번호이동이 어려우면 어떻게 하나요?",a:"새 번호로 시작하는 신규가입을 선택할 수 있어요. 쓰던 번호는 그대로 두고 두 번째 번호로 쓰는 분도 많아요."}
  ];
}

const pageTitleOverrides={
  "/plans/":"앤텔레콤 후불 요금제 전체 비교",
  "/number-transfer/":"앤텔레콤 번호이동 방법과 조건"
};
const pageMetaOverrides={
  "/plans/":"앤텔레콤 후불 요금제 47개를 데이터·가격·망·혜택별로 걸러 보고 비교하세요. 약정 없이 월 17,900원부터, 제휴카드 할인 적용가까지 한 번에 볼 수 있어요.",
  "/number-transfer/":"쓰던 번호 그대로 앤텔레콤으로 옮기는 방법이에요. 연체·3개월 제한 확인부터 K망 요금제 가격, 신청 순서와 막혔을 때 해결법까지 정리했어요."
};

function plansHubFaqs(){
  return [
    {q:"요금제는 어떤 기준으로 고르면 되나요?",a:"최근 한 달 데이터 사용량으로 구간(7GB, 15GB, 100GB 등)을 먼저 정하세요. 비슷한 구간끼리는 월 기본료와 소진 후 속도를 비교하면 돼요."},
    {q:"K망과 L망은 뭐가 다른가요?",a:"K망은 KT망, L망은 LG U+망을 쓰는 요금제예요. 번호이동과 쿠팡·네이버페이 같은 혜택은 K망 요금제 기준으로 안내하고 있어요. L망 요금제는 번호이동 가능 여부를 신청 전에 문의해 주세요."},
    {q:"약정이 있나요?",a:"약정 없이 가입해요. 다만 프로모션이나 혜택에는 유지 기간 조건이 붙을 수 있어요."},
    {q:"데이터를 다 쓰면 어떻게 되나요?",a:"기본 데이터를 다 쓰면 요금제에 따라 최대 1Mbps, 3Mbps, 5Mbps 속도로 계속 쓸 수 있어요."},
    {q:"제휴카드를 쓰면 얼마나 할인되나요?",a:"K망은 KT 마이알뜰폰 BC 바로카드, L망은 U+알뜰폰 파트너스 삼성카드가 적용돼요. 전월 카드 실적 30만원 이상이면 월 7,000원이 할인되고, 실적이 높을수록 커져요."},
    {q:"신청하면 바로 개통되나요?",a:"네, 신청이 끝나면 개통이 완료돼요. 유심을 꽂으면 바로 쓸 수 있어요. 다만 사용 중에 1899-7700으로 본사 확인 전화(해피콜)가 오면 꼭 받아야 해요. 받지 않으면 회선이 해지될 수 있어요."}
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
    faqs:one ? planFaqs(one,pageCards,pageBenefits) : page.path==="/benefits/" ? benefitHubFaqs() : page.path==="/card/" ? cardHubFaqs() : page.path==="/guide/" ? guideFaqs() : page.path==="/number-transfer/" ? transferFaqs() : page.path==="/plans/" ? plansHubFaqs() : pageFaqs(page),
    related:related(page),
    seoTitle:page.pageType==="home" ? "앤텔레콤 알뜰폰" : (pageTitleOverrides[page.path]||seoTitle),
    meta:pageMetaOverrides[page.path]||metaFor(page,matched),
    activation,
    promoActive
  };
}
