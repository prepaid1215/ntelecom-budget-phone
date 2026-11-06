const escapeHtml = value => String(value ?? "").replace(/[&<>\"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
const won = value => new Intl.NumberFormat("ko-KR").format(value) + "원";

const selectPlan = (plans, id) => {
  const plan = plans.find(item => item.id === id);
  if (!plan) throw new Error("Required reviewed product is missing: " + id);
  return plan;
};

export const buildCatalogIntentExamples = ({ prepaidPlans, mvnoPlans }) => {
  const prepaid396 = selectPlan(prepaidPlans, "ntelecom-prepaid-pl23bt241");
  const prepaid459 = selectPlan(prepaidPlans, "ntelecom-prepaid-pl23bt240");
  const mvno7 = selectPlan(mvnoPlans, "ntelecom-k-7gb-coupang-cash");
  const mvno10 = selectPlan(mvnoPlans, "ntelecom-k-10gb-coupang-cash");
  for (const plan of [mvno7, mvno10]) {
    if (!plan.active || !plan.new_available || !plan.checked_at || !plan.source_urls?.length) throw new Error("MVNO example plan lacks current catalog provenance: " + plan.id);
  }
  const prepaidDelta = prepaid459.price - prepaid396.price;
  const mvnoDelta = mvno10.current_sale_price - mvno7.current_sale_price;
  const prepaidBlocks = [
    { heading: "30일 요금과 기본 데이터", body: `선불폰 요금제를 고를 때는 30일 이용료와 데이터 기본량을 먼저 비교합니다. ${prepaid396.name} 상품의 30일 요금은 ${won(prepaid396.price)}이며 기본 데이터는 ${prepaid396.data}입니다. 상품표에 적힌 음성과 문자는 ${prepaid396.calls}입니다.` },
    { heading: "396과 459의 차이", body: `${prepaid459.name} 상품의 30일 요금은 ${won(prepaid459.price)}이며 기본 데이터는 ${prepaid459.data}입니다. 월 요금 차이는 ${won(prepaidDelta)}이고 기본 데이터 차이는 10GB입니다. 두 상품 모두 기본량을 모두 쓴 뒤 최대 3Mbps로 제공된다고 공식 상품 약관에 기재되어 있습니다.` },
    { heading: "사용량에 맞춘 선택", body: `월 요금을 우선하면 396 상품을, 월 기본 데이터를 더 확보하려면 459 상품을 비교하면 됩니다. 이 페이지는 요금과 제공량만 비교하며, 특정 동네의 매장·유심 재고·개통 사례를 안내하지 않습니다.` }
  ];
  const mvnoBlocks = [
    { heading: "월 요금과 기본 데이터", body: `알뜰폰 상품표 기준 ${mvno7.name}의 월 요금은 ${won(mvno7.current_sale_price)}입니다. 데이터는 ${mvno7.data_text}, 음성은 ${mvno7.calls}, 문자는 ${mvno7.sms}로 표시됩니다.` },
    { heading: "데이터를 더 쓰는 상품", body: `${mvno10.name}의 월 요금은 ${won(mvno10.current_sale_price)}이며 데이터는 ${mvno10.data_text}입니다. 7GB 상품보다 월 ${won(mvnoDelta)}을 더 내고 기본 데이터량을 10GB로 높이는 구성입니다.` },
    { heading: "기간 한정 혜택", body: `두 상품의 카탈로그에는 개통 뒤 24개월간 매월 데이터 10GB 추가 제공 문구가 있습니다. 혜택은 종료일이 있는 조건이므로 발행 직전 상품표를 다시 대조합니다. 이 예시는 전국 공통 상품 조건을 비교하며 지역 매장이나 재고 정보는 포함하지 않습니다.` }
  ];
  const catalogSources = [...new Set([...mvno7.source_urls, ...mvno10.source_urls])];
  return [
    {
      id: "prepaid-plan-choice",
      pageType: "prepaid",
      searchIntent: "선불 요금과 기본 데이터 비교",
      title: "선불폰 396·459 요금제, 월 요금과 데이터 비교",
      sections: prepaidBlocks.map(item => item.heading),
      contentBlocks: prepaidBlocks,
      body: prepaidBlocks.map(item => item.body).join("\n\n"),
      products: [prepaid396.id, prepaid459.id],
      checkedAt: prepaid396.source_received_at || null,
      sources: ["https://www.n-telecom.co.kr/Resources/MpolicyPDF/policy_24903.pdf"],
      status: "catalog-example-only"
    },
    {
      id: "mvno-monthly-plan-choice",
      pageType: "mvno",
      searchIntent: "알뜰폰 월 납부액과 데이터 제공량 비교",
      title: "알뜰폰 7GB·10GB 요금제, 월 요금 차이 비교",
      sections: mvnoBlocks.map(item => item.heading),
      contentBlocks: mvnoBlocks,
      body: mvnoBlocks.map(item => item.body).join("\n\n"),
      products: [mvno7.id, mvno10.id],
      checkedAt: mvno7.checked_at,
      sources: catalogSources,
      status: "catalog-example-only"
    }
  ];
};

export const renderCatalogExampleHtml = example => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><title>${escapeHtml(example.title)} | 콘텐츠 검수 예시</title></head><body><main><p>전국 공통 상품자료 기반 예시 · 지역 상세페이지가 아님 · 공개 불가</p><h1>${escapeHtml(example.title)}</h1><p>검색 의도: ${escapeHtml(example.searchIntent)}</p>${example.contentBlocks.map(block => `<section><h2>${escapeHtml(block.heading)}</h2><p>${escapeHtml(block.body)}</p></section>`).join("")}<section><h2>출처</h2><p>자료 확인일 ${escapeHtml(example.checkedAt)}</p><ul>${example.sources.map(url => `<li><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></li>`).join("")}</ul></section></main></body></html>`;
