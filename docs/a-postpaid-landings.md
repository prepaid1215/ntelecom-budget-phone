# A 실험: 후불 알뜰폰 랜딩 9개

기준 브랜치: feat/start-conversion-funnel (PR #4). 이 변경은 후불 홈 및 /start/ 퍼널을 사용한다.

구현: src/data/a-postpaid-landings.json, src/components/PostpaidLanding.astro.
/guides/ 목록 및 공통 헤더에서 각 페이지를 발견할 수 있다. 사이트맵은 PRODUCTION_READY=true일 때만 새 10개 URL을 포함한다. 미리보기에서는 noindex를 유지한다.

각 페이지는 고유 제목·설명·본문 4개 절·FAQ 3개·관련 안내·전환 버튼을 갖는다. 직접 /start/로 이동하는 버튼은 exp_a_<id>를 사용한다. 상품 버튼은 상품 ID와 통신망도 전달한다. 요금제 목록으로 이동한 후 클릭하는 경로는 기존 목록 출처를 사용한다.

이 9개가 새 A 페이지 세트다. PR #3의 이전 선불 A 데이터와 함께 공개하지 않는다. B/C 병합 시 기존 [landing].astro와 구 A 데이터·검사를 새 A 세트로 대체해야 한다. B/C는 이번 변경에 병합하지 않는다.

가격·프로모션은 기존 상품 카탈로그를 사용한다. 이번 작업에서 최신 통신사 조건을 재조사하지 않았으며 새 금액이나 혜택을 만들지 않았다. 실개통 URL·GA4 설정 및 실제 가입 완료는 별도 검증 대상이다. 운영 도메인 배포는 하지 않았다.
