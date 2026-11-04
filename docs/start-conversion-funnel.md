# 앤텔레콤개통방법.shop /start/ 후불 전용 전환 홈페이지

## 사업 구조
- 기본 상품은 **후불 알뜰폰**입니다.
- `/start/`는 `preplan.site`의 홈 레이아웃(큰 KT·LG 버튼, 빠른 메뉴, 아래 추천 요금제)을 참고한 **독립 후불 전용 홈페이지**입니다. 단순 KT/LG 선택 화면이 아닙니다.
- 후불 요금제 47개 비교, 후불 추천 요금제, 유심 구매 안내, 후불 가입 절차, 제휴 혜택·카드 할인, FAQ를 제공합니다.
- 선불폰은 후불 가입이 어려운 고객에게만 하단 접힌 메뉴로 안내합니다. 선불 요금제는 추천 후불 목록에 노출하지 않습니다.

## 경로
1. `앤텔레콤개통방법.shop`에서 개통하기 클릭 → `/start/?from=antelcom_hero` 등으로 이동.
2. 요금제를 먼저 고른 경우 `plan`, `net`, `plan_name`도 전달해 선택 내용을 보여줍니다.
3. `/start/` 상단 **KT 개통하기 / LG 개통하기**, 추천 후불 상품의 개통 버튼 또는 후불 47개 비교기의 **신청하기**를 누르면 실제 온라인 신청 주소로 이동합니다.
4. 후불 버튼의 목적지는 `START_KT_URL`, `START_LG_URL`로 각각 설정합니다. 미설정이면 기존 `ACTIVATION_URL`(현재 `preplan.site`)로 임시 이동하여 브랜드 분리가 완성되지 않습니다. **운영 전 검증된, 해당 판매점의 실개통 직행 URL로 교체해야 합니다.** 승인/태블릿번호를 요구하는 멤버십 앱 페이지로 연결하지 않습니다.
5. 선불 대안은 `START_PREPAID_KT_URL`, `START_PREPAID_LG_URL`로 후불과 별도로 연결할 수 있습니다. 기본은 현재 `ACTIVATION_URL`입니다.

## 전환 측정
- `PUBLIC_GA4_MEASUREMENT_ID`가 빌드 시 설정되면 GA4로 실제 이벤트 전송이 시작됩니다. **설정하지 않으면 이벤트 수집은 되지 않습니다.**
- `start_view`: /start 진입 (traffic_source, plan_id, network_hint)
- `activation_outbound`: 최종 개통 버튼 클릭 (traffic_source, plan_id, network, billing_type, button_location)
- `prepaid_alternative_open`: 후불 가입이 어려운 경우 선불 대안 영역 펼침
- 외부 URL에는 `from=start_<billing>_<network>_<original source>`를 붙입니다. 수신 측에서 해당 값을 저장하는지는 별도 검증이 필요합니다.
- **개통 버튼 클릭은 가입 신청 완료나 실제 개통 완료와 다릅니다.** 실제 성공 건수는 개통 시스템 기록과 별도로 대조해야 합니다.

## SEO · PR
- `/start/` 자체는 검색 랜딩이 아닌 전환 목적이므로 `noindex,follow` 및 self-canonical 적용.
- 기존 후불 500페이지와 홈의 후불 비교 기능은 보존합니다. CTA URL만 전환 페이지로 변경합니다.
- PR #4는 Draft, main 병합 및 운영 배포하지 않습니다.
- PR #3의 '기존 503 HTML SHA-256 무변경' 검사는 **의도된 CTA URL 변경**을 구분하도록 기준 조정 후 병합해야 합니다.
