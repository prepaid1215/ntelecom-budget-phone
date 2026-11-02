# SEO 3대 실험 v1 — 독립 검수 브랜치

기존 후불 알뜰폰 500페이지·Cloudflare 운영 배포를 변경하지 않고 검수용 HTML을 생성합니다.

## 실행

```bash
node scripts/seo-lab-preview.mjs
```

생성 결과: `seo-lab-preview/` (현재 Astro의 `src/pages` 또는 `public`에 연결하지 않음)

## 구현 상태

| 실험 | 검수용 구현 | 공개 색인 |
| --- | --- | --- |
| A 키워드 랜딩 | `seo-lab/seed.json` 기준 6개 검색의도 시드 | 보류 |
| B 지역페이지 | 부전동·전포동·역삼동·주안동·상인동 5개 미리보기 | 모두 보류 (지역 고유 근거 없음) |
| C 블로그 원문 | 1개 네이버 모바일 원문 URL 정규화·링크 목록 | 원본 색인 여부 미확인 |

모든 미리보기 HTML에는 `noindex,follow`가 삽입되고 별도 `robots.txt`에 `Disallow: /`가 기록됩니다. 이 조합은 테스트 산출물이 외부에서 우연히 공개될 경우의 색인 방지 목적입니다. 원문 색인 실험은 실제 원본의 색인 여부를 별도로 관측해야 합니다.

## 관측 상태

`seo-lab-preview/status.json`: 페이지별 `preview_generated`, `editorial_index_candidate`, `submitted`, `crawled`, `indexed`, `impressions`, `clicks`를 별개 필드로 관리합니다. 미관측 항목은 `null`이며 색인 완료로 해석하지 않습니다.

`seo-lab-preview/blog-originals.json`: 네이버 블로그 원문 URL과 Google 검색 발견·색인 여부를 기록할 자리입니다. 기존 블로그 게시물을 복제하지 않습니다.

## 공개 전에 남은 작업

1. 실제 유심·요금제·후불 혜택·상담 및 개통 링크의 최신 정확성 검증
2. 선불폰 및 후불 사이트 내비게이션, 사용자 선택 동선 설계
3. Astro 라우트로 검증 완료된 A 페이지를 통합하고 SEO 전수 검사 확장
4. 전국 지역페이지 검수 파이프라인은 `seo-lab/regions/` 및 `scripts/generate-regional-pages.mjs`에서 별도 생성하며, 근거 확인 전 공개·색인 전환 금지
5. 지역별 검증 가능한 실제 정보가 없는 B 페이지는 계속 비색인 유지
6. C는 자체 사이트의 발견 허브와 네이버 원문의 실제 색인 상태를 분리하여 측정
7. 검수와 승인 후 `PRODUCTION_READY` 전환

기존 GitHub Pages 주소와 Cloudflare 운영 도메인은 이 브랜치의 변경만으로 수정되지 않습니다.


## SEO 메타 규칙 (실험 A/B)

- 각 URL은 두 가지 형태 중 하나: `앤텔레콤-키워드-개통방법` 또는 `앤텔레콤-키워드-개통-세부키워드-방법`
- `<title>`: 주제별 고유 제목, 핵심 키워드와 함께 구체적 차이점 표기
- `<h1>`: title의 ` | ` 앞부분을 사용해 페이지당 정확히 1개로 생성
- `<link rel="canonical">`: `siteUrl + 각 페이지 자체 경로`로 절대 URL 생성. **모든 페이지를 홈 canonical로 통일하지 않음**
- `og:url`: canonical과 같은 URL
- H1·title·canonical 중복은 생성기에 오류로 처리
- 네이버 블로그 URL 실험 `/blog/`는 두 SEO 랜딩 슬러그 규칙의 예외
- `PRODUCTION_READY=false`와 별도로 이 미리보기는 `noindex`를 유지

예시:

```text
slug:      /앤텔레콤-네이버7gb-요금제-개통방법/
title:     앤텔레콤 네이버페이 7GB 요금제 개통방법 | K망 가입안내
H1:        앤텔레콤 네이버페이 7GB 요금제 개통방법
canonical: https://앤텔레콤개통방법.shop/앤텔레콤-네이버7gb-요금제-개통방법/
```

표시된 canonical의 실제 HTML URL은 국제화 도메인 및 한글 경로를 ASCII/퍼센트 인코딩한 값으로 정규화됩니다.

Google 검색 노출은 보장되지 않습니다. 고유한 title/H1과 자체 참조 canonical이 있어도 내용이 실질적으로 중복이면 검색엔진이 다른 표준 URL을 선택할 수 있습니다.


## 슬러그 패턴 두 가지

- 형식 A: `앤텔레콤 + 상품·상황·지역 + 개통방법` — 예: `/앤텔레콤-네이버7gb-요금제-개통방법/`
- 형식 B: `앤텔레콤 + 상품·상황·지역 + 개통 + 서브키워드 + 방법` — 예: `/앤텔레콤-원칩-개통-모델코드-입력-방법/`
- 지역 형식 A 예: `/앤텔레콤-부전동-개통방법/`
- 두 패턴을 모두 쓸 수 있지만 **동일 검색 의도를 같은 글 두 개로 복제하지 않음**
- SEO 실험용 미리보기는 실제 N플랫폼 연결 전까지 개통 버튼 대신 안내 문구로 처리
