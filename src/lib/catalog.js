import rawPlans from "../data/research/plans.json";
import cards from "../data/research/cards.json";
import benefits from "../data/research/benefits.json";
import activation from "../data/research/activation-rules.json";
import overrides from "../data/owner-overrides.json";

const cleanName=n=>String(n||"").replace(/후불\s*/g," ").replace(/\s+/g," ").trim();
export const plans = rawPlans.filter(p=>p.active).map(p=>{
  const tags = new Set(p.tags || []);
  if(overrides.contract?.apply_to_all_active_plans) tags.add(overrides.contract.tag);
  if(activation.devices?.self_phone === true) tags.add("self-phone");
  return {...p, name:cleanName(p.name), official_name:cleanName(p.official_name), contract:p.contract || overrides.contract?.value || null, tags:[...tags].sort()};
});
export { cards, benefits, activation };

export const planById = id => plans.find(p=>p.id===id);
export const cardById = id => cards.find(c=>c.id===id);
export const benefitById = id => benefits.find(b=>b.id===id);

export const cardsForPlan = plan => cards.filter(c=>c.active && (c.eligible_networks||[]).includes(plan.network));
export const benefitsForPlan = plan => benefits.filter(b=>(plan.benefit_ids||[]).includes(b.id));

export function promoActive(promo, now = new Date()){
  if(!promo?.active) return false;
  const parts = new Intl.DateTimeFormat("en-US", {timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
  const value = type => parts.find(part=>part.type===type)?.value;
  const day = `${value("year")}-${value("month")}-${value("day")}`;
  if(promo.start_date && day < promo.start_date) return false;
  if(promo.end_date && day > promo.end_date) return false;
  return true;
}
