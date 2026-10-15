# 색인 후보(index) 243개 중복 분석

분석 기준: `src/data/generated-pages.json`에서 `effectiveIndex = index`인 페이지가 보여주는 **요금제 집합(supportingPlanIds)**. 같은 요금제 집합을 보여주는 페이지는 검색 의도가 같다면 중복 후보입니다. 이 문서는 분석만 하며, 생성 규칙이나 `PRODUCTION_READY`는 바꾸지 않았습니다.

## 요약

| 항목 | 값 |
|---|---|
| 색인 후보 페이지 | 243 |
| 서로 다른 요금제 집합 | 119 |
| 같은 집합을 공유하는 그룹(2개 이상) | 37 |
| 그 그룹에 속한 페이지 | 161 |
| 대표 1개를 빼면 남는 중복 페이지 | 124 |
| 대표만 남길 때 페이지 수 | 119 |

즉 243개 중 **약 124개는 다른 페이지와 정확히 같은 요금제 목록**을 보여줍니다. 136이라는 숫자는 근거가 아니라 참고 수치이고, "한 요금제 집합당 대표 1개"로 줄이면 119개, 의도가 다른 허브를 예외로 살리면 그보다 조금 늘어납니다.

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

## 제안(적용 전, 결정 필요)

1. **같은 요금제 집합당 URL 하나만 색인**하고 나머지는 `noindex`(또는 canonical)로 둔다. 대표는 검색 의도가 가장 분명한 URL(예: 데이터 구간은 `/plans/10gb/`, 혜택은 `/benefits/coupang-cash/`).
2. **의도가 다른 허브는 예외로 유지**: `/number-transfer/`, `/new-number/`, `/no-contract/`, `/self-phone/`, `/guide/`, `/card/`처럼 요금제 목록이 같아도 검색어와 본문이 다른 페이지.
3. **결과가 2개 이하인 조합 11개**(예: `/plans/k/price/under-20000/`)는 얇은 페이지라서 색인에서 뺀다.
4. 별칭 URL은 한쪽으로 통일한다(`/benefits/coupang/` → `/benefits/coupang-cash/` 등).
5. 위 규칙은 생성 스크립트의 `effectiveIndex` 계산에 넣고, 재빌드해도 결과가 유지되는지 테스트로 고정한다.

## 한계

- 243→198, 198→136 단계의 이전 검토 기록(제외 기준, URL 목록)은 저장소에 없어 비교하지 않았습니다.
- 요금제 집합이 같다고 해서 검색어까지 같은 것은 아닙니다. 예외 판단은 검색 의도 기준이 필요합니다.
