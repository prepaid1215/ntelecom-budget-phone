# 앤텔레콤 알뜰폰 페이지 공장 v3

## 홈페이지 미리보기

![앤텔레콤 알뜰폰 홈페이지](docs/homepage-preview.png)

최신 `data-research`를 실제 데이터로 통합한 버전입니다.

## 현재 데이터

- 활성 후불 요금제: 47개
- K망: 42개
- L망: 5개
- 제휴카드: 2개
- 생활혜택: 6개

## 페이지 공장

- 자동 생성 페이지: 500개
- index 후보: 243개
- noindex: 257개
- 광고 LP는 항상 `/lp/` + noindex
- 실제 상품 근거가 있는 태그 조합만 SEO index 후보

`MAX 500`은 현재 generator 기본값이며,
규칙을 늘리면 1,000개 이상으로 확장할 수 있습니다.

## 중요한 설계

### 1. 조사 원본은 그대로 보존

`src/data/research/`

- plans.json
- cards.json
- benefits.json
- activation-rules.json
- tag-rules.json
- page-opportunities.json
- sources.csv
- research-report.md
- unresolved.md

원본 조사 결과를 직접 변형하지 않습니다.

### 2. 운영자 확인 정보는 별도 파일

`src/data/owner-overrides.json`

현재는 후불 상품의 `무약정` 조건만 별도 관리합니다.
공식 조사에서 미확정인 데이터를 연구 파일에 억지로 쓰지 않습니다.

### 3. 카드 프로모션 자동 만료

`U+알뜰폰 파트너스 삼성카드`처럼 start/end date가 있는 프로모션은
빌드 날짜가 기간을 벗어나면 화면에서 자동으로 프로모션 영역을 숨깁니다.

기본 카드혜택은 계속 남습니다.

### 4. 생활혜택

쿠팡캐쉬 / 네이버페이 / 다이소 / 밀리의서재 / 올리브영 / CU
상품 연결은 사용하지만,
조사에서 확인되지 않은 지급액·지급주기·유지조건은 임의 생성하지 않습니다.

## 페이지 종류

- 메인
- 요금제 허브
- K/L망
- 데이터 용량
- 가격대
- 소진 후 속도
- 신규가입 / 번호이동
- 무약정
- 자급제
- 생활혜택
- 제휴카드
- 실제 요금제 상세 47개
- 2조건 조합 SEO 페이지
- 광고 소재별 LP

## 실행

```bash
pnpm install
pnpm run generate
pnpm run validate
pnpm run report
pnpm run dev
```

배포 빌드:

```bash
pnpm run build
```

Vercel에서는 저장소의 `pnpm-lock.yaml`과 `packageManager`를 사용해 정적 Astro 빌드를 그대로 실행할 수 있습니다. 별도 서버나 `vercel.json`은 필요하지 않습니다.

## 운영 전에 반드시 설정

실제 도메인과 미러링 개통 URL을 연결할 때 배포 환경변수에 아래 값을 입력합니다. 저장소 기본값은 의도적으로 `example.com`과 `productionReady=false`를 유지합니다.

| 환경변수 | 값 |
| --- | --- |
| `SITE_URL` | 실제 사이트 도메인(https 포함) |
| `ACTIVATION_URL` | 실제 미러링 개통 URL(https 포함) |
| `PRODUCTION_READY` | 최종 검수 전 `false`, 공개 색인 전환 시 `true` |

로컬에서는 `.env.example`을 복사해 사용할 수 있습니다. 환경변수가 없으면 `src/data/site.json`의 값이 대체값으로 쓰입니다.

`PRODUCTION_READY=false`에서는 모든 HTML이 `noindex,follow`이고, `robots.txt`는 전체 크롤링을 차단하며 sitemap은 비어 있습니다. `true`로 전환하면 기존 `effectiveIndex` 판정에 따라 243개 후보만 index 대상으로 바뀌고 sitemap에 포함됩니다. 257개 noindex와 광고 LP 203개는 계속 제외됩니다.

배포 전 검증:

```bash
pnpm run build
pnpm run audit:seo
```

`audit:seo`는 500개 HTML의 title, description, canonical, robots, hreflang, Open Graph, 구조화 데이터, H1, 이미지 속성, 내부 링크, sitemap을 전수 검사합니다.
## 페이지를 더 늘릴 때

`scripts/generate-pages.mjs`의 조합 규칙을 늘립니다.

원칙:
- 실제 상품이 존재함
- 서로 다른 검색의도가 있음
- 본문에서 비교 가능한 정보가 있음
- 근거가 약한 조합은 noindex
- 광고 소재별 LP는 noindex로 자유롭게 확장

## 다음 단계

1. 실제 도메인/미러링 URL 연결
2. 전용 아이콘 자산 적용
3. 혜택 지급조건 추가 조사 후 Benefit 컴포넌트 강화
4. 카드별 계산기 UI 강화
5. GitHub Actions 자동 배포
6. 광고 UTM/소재 ID 자동 생성
