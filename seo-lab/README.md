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

## 통합 구현 (v1, Astro 라우트)

위 미리보기 생성기는 검수 도구로 그대로 둡니다. 실제 사이트 라우트는 `src/lib/seo-experiments/registry.js` 한 곳에서 관리합니다.

| 실험 | 라우트 | 데이터 | 템플릿 | 현재 수치 |
|---|---|---|---|---|
| A 검색의도 랜딩 | `/앤텔레콤-…/` (`src/pages/[landing].astro`) | `src/data/seo-experiments/a-landings.json` | `components/experiments/LandingPage.astro` | 생성 9, 색인 후보 6 |
| B 지역 | `/regions/{prepaid\|mvno}/…` (`src/pages/regions/[...region].astro`) | `seo-lab/regions/*` (URL 잠금·근거 게이트 동일) | `components/experiments/RegionPage.astro` | 생성 7,664, 색인 후보 0 |
| C IndexKit | `/indexkit/`, `/indexkit/{batch}/` | `src/data/seo-experiments/indexkit.json` | `components/experiments/IndexKitPage.astro` | 대상 1, 링크 0(등록 중) |

**A 게이트.** 다음 기준은 모두 **이 프로젝트 내부 감사 기준**이며 검색엔진의 공식 색인 요건이 아닙니다.

- 슬러그와 H1 규칙
- title 40자 이하, description 30~80자
- 본문 600자 이상, 내부링크 3개 이상
- 근거 파일 명시, 참조 상품의 활성·프로모션 유효
- 기존 페이지와의 검색의도 충돌 없음(`config.json`의 `intentOwners`)
- 렌더링 본문 전수 중복률 0.30 이하

렌더링 중복은 빌드 후 `pnpm run seo:a-review --write-demotions`로 `a-rendered-overlap.json`에 고정합니다. 기록이 낡으면 `test-dist`가 실패합니다. 판정 근거는 `reports/seo-experiments/a-landing-review.{json,md}`에 남습니다.

**B 출력 범위.** `SEO_REGIONS_EMIT=all`(개발 기본값)은 7,664개를 모두 만듭니다. `candidates`(운영 `deploy-pages.yml`)는 색인 후보와 상위 허브만 만들며, 현재는 0개입니다. 근거 없는 지역은 noindex이고 sitemap에 넣지 않습니다.

**C와 관측.** [`indexkit/README.md`](indexkit/README.md), [`observations/README.md`](observations/README.md)를 참고하세요.

**기존 사이트 보존.** `seo-lab/baseline/`에 실험 전 503개 HTML의 SHA-256, 감사 결과, sitemap·robots를 기록해 두었습니다. `pnpm run seo:baseline`은 이 기록과, `pnpm run seo:baseline -- --base-ref=876d8c8`은 같은 날 재빌드한 기준 커밋과 비교합니다.

**전체 검증.** `pnpm run seo:test`는 빌드 4종과 테스트, 감사를 모두 실행하고 `reports/seo-experiments/test-summary.json`을 남깁니다. 배포는 하지 않습니다.
