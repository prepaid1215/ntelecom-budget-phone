# 색인 후보 페이지 중복 분석

분석 기준: `src/data/generated-pages.json`에서 `effectiveIndex = index`인 페이지가 보여주는 **요금제 집합(supportingPlanIds)**. 같은 상품 목록을 보여주는 태그·조건 조합 페이지는 색인 경쟁을 줄이기 위해 대표 URL 하나만 남깁니다. 허브·요금제 상세·혜택 상세처럼 내용과 검색 의도가 다른 페이지는 별도로 판단합니다.

## 현재 적용 상태

2026-10-21 기준 생성 결과:

| 항목 | 값 |
|---|---:|
| 전체 정적 페이지 | 500 |
| 색인 허용 후보 | 141 |
| `noindex` 페이지 | 359 |
| 색인 대상 태그·조합 페이지 | 같은 요금제 ID 집합당 대표 1개 |

광고 랜딩페이지(`/lp/`)는 계속 `noindex`입니다. 이 규칙은 `scripts/generate-pages.mjs`에서 매번 생성되므로 페이지를 다시 만들어도 유지됩니다.

## 검색어 설계

한 페이지에 무관한 단어를 많이 넣지 않고, 한 URL마다 검색 의도 하나를 맡깁니다. 주요 묶음은 `알뜰폰 요금제`, `알뜰폰 요금제 비교`, 데이터 용량·가격대별 요금제, `알뜰폰 번호이동`, `알뜰폰 신규가입`, `자급제폰 알뜰폰`, 제휴카드 및 생활혜택입니다. 해당 키워드는 각 페이지의 title, H1, 설명과 실제 요금제 목록이 같은 주제를 가리키도록 작성합니다.

네이버는 제목에 주제를 분명히 쓰고, 반복·무관 키워드와 중복 콘텐츠를 피하도록 권합니다. 제목 40자 이내, 설명 80자 이내를 기준으로 맞췄습니다. 키워드를 삽입하는 것만으로 순위나 모든 검색어 노출을 보장할 수는 없습니다.

## 과거 분석 기록

아래 그룹 목록은 색인 중복 제거 전 243개 후보 상태를 확인한 기록입니다. 현재 정책과 개수는 위의 `현재 적용 상태` 및 페이지 생성 스크립트를 기준으로 합니다.

## 요약

| 항목 | 값 |
|---|---|
| 색인 후보 페이지 | 243 |
| 서로 다른 요금제 집합 | 119 |
| 같은 집합을 공유하는 그룹(2개 이상) | 37 |
| 그 그룹에 속한 페이지 | 161 |
| 대표 1개를 빼면 남는 중복 페이지 | 124 |
| 대표만 남길 때 페이지 수 | 119 |

당시 243개 중 약 124개는 다른 페이지와 정확히 같은 요금제 목록을 보여줬습니다.

## 원인별 분류

| 원인 | 설명 | 영향 페이지 |
|---|---|---|
| 무약정·자급제 축 | 모든 요금제에 붙는 태그라 필터 효과가 없음. 일반 데이터·가격 페이지와 동일 | 무약정 조합 18개, 자급제 조합 18개 |
| 신규가입·번호이동 축 | K망 요금제 전부에 붙는 태그라 `/plans/k/…`와 동일하고 두 축끼리도 동일 | 신규가입 조합 18개, 번호이동 조합 18개 |
| 혜택 × 가입 축 | 혜택 페이지 하나가 신규·번호이동·무약정·자급제 4축으로 복제됨 | 혜택별 최대 5개 URL이 같은 7개 요금제 |
| 별칭 URL | `/benefits/coupang/`와 `/benefits/coupang-cash/`, `/benefits/millie/`와 `/benefits/content-benefit/` 등 | 혜택 별칭 2쌍 |
| 가격대·속도 겹침 | 다른 가격 구간(예: 3만원 이하, 2만원대)이 같은 상품을 반환 | 가격·속도 조합 다수 |

## 같은 요금제 집합을 공유하는 그룹

| # | 요금제 집합 | 페이지 수 | 대표 후보(첫 URL) | 나머지 중복 URL |
|---|---|---|---|---|
| 1 | 6개 (K망, 혜택 6종) | 12 | `/plans/100gb/` | `/plans/k/100gb/`, `/plans/k/price/40000-range/`, `/plans/k/speed/5mbps/`, `/plans/100gb/5mbps/`, `/plans/100gb/price/40000-range/` 외 6개 |
| 2 | 47개 (K+L망, 혜택 6종) | 10 | `/` | `/plans/`, `/card/`, `/guide/`, `/compare/`, `/no-contract/` 외 4개 |
| 3 | 6개 (K망, 혜택 6종) | 10 | `/plans/10gb/` | `/plans/k/10gb/`, `/plans/10gb/1mbps/`, `/plans/10gb/price/under-30000/`, `/plans/10gb/price/under-40000/`, `/plans/10gb/price/20000-range/` 외 4개 |
| 4 | 3개 (K+L망, 혜택 cu·millie) | 8 | `/plans/price/under-20000/` | `/plans/price/10000-range/`, `/plans/7gb/price/under-20000/`, `/plans/7gb/price/10000-range/`, `/no-contract/price/under-20000/`, `/no-contract/price/10000-range/` 외 2개 |
| 5 | 42개 (K망, 혜택 6종) | 6 | `/benefits/` | `/card/kt-my-alttle-bc-baro/`, `/plans/k/`, `/new-number/`, `/number-transfer/`, `/number-transfer/restrictions/` |
| 6 | 7개 (K망, 혜택 coupang-cash) | 6 | `/benefits/coupang-cash/` | `/benefits/coupang/`, `/new-number/benefits/coupang/`, `/number-transfer/benefits/coupang/`, `/no-contract/benefits/coupang/`, `/self-phone/benefits/coupang/` |
| 7 | 7개 (K망, 혜택 millie) | 6 | `/benefits/millie/` | `/benefits/content-benefit/`, `/new-number/benefits/content-benefit/`, `/number-transfer/benefits/content-benefit/`, `/no-contract/benefits/content-benefit/`, `/self-phone/benefits/content-benefit/` |
| 8 | 7개 (K+L망, 혜택 6종) | 6 | `/plans/7gb/` | `/plans/7gb/1mbps/`, `/plans/7gb/price/under-30000/`, `/plans/7gb/price/under-40000/`, `/no-contract/7gb/`, `/self-phone/7gb/` |
| 9 | 7개 (K+L망, 혜택 6종) | 6 | `/plans/11gb/` | `/plans/11gb/3mbps/`, `/plans/11gb/price/under-40000/`, `/plans/11gb/price/30000-range/`, `/no-contract/11gb/`, `/self-phone/11gb/` |
| 10 | 2개 (K망, 혜택 cu·millie) | 6 | `/plans/k/price/under-20000/` | `/plans/k/price/10000-range/`, `/new-number/price/under-20000/`, `/number-transfer/price/under-20000/`, `/new-number/price/10000-range/`, `/number-transfer/price/10000-range/` |
| 11 | 7개 (K망, 혜택 naverpay) | 5 | `/benefits/naverpay/` | `/new-number/benefits/naverpay/`, `/number-transfer/benefits/naverpay/`, `/no-contract/benefits/naverpay/`, `/self-phone/benefits/naverpay/` |
| 12 | 7개 (K망, 혜택 daiso) | 5 | `/benefits/daiso/` | `/new-number/benefits/daiso/`, `/number-transfer/benefits/daiso/`, `/no-contract/benefits/daiso/`, `/self-phone/benefits/daiso/` |
| 13 | 7개 (K망, 혜택 oliveyoung) | 5 | `/benefits/oliveyoung/` | `/new-number/benefits/oliveyoung/`, `/number-transfer/benefits/oliveyoung/`, `/no-contract/benefits/oliveyoung/`, `/self-phone/benefits/oliveyoung/` |
| 14 | 7개 (K망, 혜택 cu) | 5 | `/benefits/cu/` | `/new-number/benefits/cu/`, `/number-transfer/benefits/cu/`, `/no-contract/benefits/cu/`, `/self-phone/benefits/cu/` |
| 15 | 20개 (K+L망, 혜택 6종) | 4 | `/plans/15gb/` | `/plans/15gb/price/under-40000/`, `/no-contract/15gb/`, `/self-phone/15gb/` |
| 16 | 7개 (K+L망, 혜택 6종) | 4 | `/plans/speed/5mbps/` | `/plans/price/40000-range/`, `/no-contract/price/40000-range/`, `/self-phone/price/40000-range/` |
| 17 | 40개 (K+L망, 혜택 6종) | 3 | `/plans/price/under-40000/` | `/no-contract/price/under-40000/`, `/self-phone/price/under-40000/` |
| 18 | 36개 (K망, 혜택 6종) | 3 | `/plans/k/price/under-40000/` | `/new-number/price/under-40000/`, `/number-transfer/price/under-40000/` |
| 19 | 22개 (K+L망, 혜택 6종) | 3 | `/plans/price/under-30000/` | `/no-contract/price/under-30000/`, `/self-phone/price/under-30000/` |
| 20 | 20개 (K망, 혜택 6종) | 3 | `/plans/k/price/under-30000/` | `/new-number/price/under-30000/`, `/number-transfer/price/under-30000/` |
| 21 | 19개 (K+L망, 혜택 6종) | 3 | `/plans/price/20000-range/` | `/no-contract/price/20000-range/`, `/self-phone/price/20000-range/` |
| 22 | 18개 (K+L망, 혜택 6종) | 3 | `/plans/price/30000-range/` | `/no-contract/price/30000-range/`, `/self-phone/price/30000-range/` |
| 23 | 18개 (K망, 혜택 6종) | 3 | `/plans/k/15gb/` | `/new-number/15gb/`, `/number-transfer/15gb/` |
| 24 | 18개 (K망, 혜택 6종) | 3 | `/plans/k/price/20000-range/` | `/new-number/price/20000-range/`, `/number-transfer/price/20000-range/` |
| 25 | 16개 (K망, 혜택 6종) | 3 | `/plans/k/price/30000-range/` | `/new-number/price/30000-range/`, `/number-transfer/price/30000-range/` |
| 26 | 6개 (K망, 혜택 6종) | 3 | `/plans/k/7gb/` | `/new-number/7gb/`, `/number-transfer/7gb/` |
| 27 | 6개 (K망, 혜택 6종) | 3 | `/plans/k/11gb/` | `/new-number/11gb/`, `/number-transfer/11gb/` |
| 28 | 3개 (K망, 혜택 coupang-cash) | 3 | `/benefits/coupang/price/under-30000/` | `/benefits/coupang/price/20000-range/`, `/benefits/coupang/speed/1mbps/` |
| 29 | 3개 (K망, 혜택 naverpay) | 3 | `/benefits/naverpay/price/under-30000/` | `/benefits/naverpay/price/20000-range/`, `/benefits/naverpay/speed/1mbps/` |
| 30 | 3개 (K망, 혜택 daiso) | 3 | `/benefits/daiso/price/under-30000/` | `/benefits/daiso/price/20000-range/`, `/benefits/daiso/speed/1mbps/` |
| 31 | 3개 (K망, 혜택 oliveyoung) | 3 | `/benefits/oliveyoung/price/under-30000/` | `/benefits/oliveyoung/price/20000-range/`, `/benefits/oliveyoung/speed/1mbps/` |
| 32 | 9개 (K+L망, 혜택 6종) | 2 | `/plans/15gb/price/under-30000/` | `/plans/15gb/price/20000-range/` |
| 33 | 5개 (L망) | 2 | `/card/uplus-partners-samsung/` | `/plans/l/` |
| 34 | 3개 (K망, 혜택 coupang-cash) | 2 | `/benefits/coupang/price/30000-range/` | `/benefits/coupang/speed/3mbps/` |
| 35 | 3개 (K망, 혜택 naverpay) | 2 | `/benefits/naverpay/price/30000-range/` | `/benefits/naverpay/speed/3mbps/` |
| 36 | 3개 (K망, 혜택 daiso) | 2 | `/benefits/daiso/price/30000-range/` | `/benefits/daiso/speed/3mbps/` |
| 37 | 3개 (K망, 혜택 oliveyoung) | 2 | `/benefits/oliveyoung/price/30000-range/` | `/benefits/oliveyoung/speed/3mbps/` |

## 한계

- 요금제 ID 집합이 같아도 사용자 의도가 다를 수 있으므로 상품과 본문을 바꿀 때 대표 URL 정책도 함께 검토해야 합니다.
- 실제 노출 키워드는 네이버 서치어드바이저에 사이트를 등록한 뒤 노출·클릭 리포트로 보완해야 합니다.
