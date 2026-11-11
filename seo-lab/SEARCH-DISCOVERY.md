# Google · Naver 자동 발견 운영 기준

대상: https://xn--h49a29twjdmms77a5sofgdjwa.shop/

## 검색엔진 발견

- 단일 `/sitemap.xml`과 `/robots.txt`를 사용합니다. URL 접두어는 운영 자체 도메인입니다.
- index 가능한 URL만 사이트맵에 넣습니다. `/start/` 및 검사 통과하지 못한 A/B/C 실험 페이지는 제외합니다.
- `<priority>`는 Google에서 무시합니다. 별도 색인 가속 효과가 없습니다.
- `<lastmod>`는 `src/data/seo-lastmod.json`에서 실제 의미 있는 수정이 확인된 페이지에만 표기합니다.
- 날짜가 확인되지 않은 이전 페이지는 lastmod 없이 유지합니다. 매일 실행되는 빌드 날짜를 lastmod에 쓰지 않습니다.
- 자동 발행의 기준 데이터는 렌더링된 `<main>`과 title, description, JSON-LD이며 공통 헤더/푸터 교체는 수정일로 인정하지 않습니다.

## 수정일 자동화

GitHub Action `seo-lastmod.yml`은 새로운 main 콘텐츠 배포와 정기 실행 시 발행 가능한 URL만 빌드해 이전 지문과 비교합니다.

첫 실행은 기존 URL의 해시만 기록합니다. 이후 실제 콘텐츠가 변경되면 마지막 소스 커밋 날짜를 기록하고 `src/data/seo-lastmod.json`에 커밋합니다. 사이트맵은 다음 Cloudflare 배포에서 이를 반영합니다. 자동화 상태를 GitHub commit과 Cloudflare 실제 배포에서 분리해 검증하세요.

## 네이버 IndexNow

네이버 공식: https://searchadvisor.naver.com/guide/indexnow-about
- Key 파일: `/7be9bab21ea2fbefbb07353904211af3.txt` (검색엔진 소유확인용 공개 파일)
- 알림 API: `POST https://searchadvisor.naver.com/indexnow`
- 워크플로 `naver-indexnow.yml`: 정기 실행 및 수동 실행 지원
- 전송 조건: 실제 운영 사이트 robots Allow, sitemap 포함, HTML 200, index, canonical 일치, 원문 지문 일치, 공개 key 파일 일치
- 최초 도입 시 전체 과거 페이지 알림 없음. 페이지 내용이 새로 변경되어 lastmod가 생성된 URL만 전송
- 1회 최대 40 URL. 200/202만 수락 처리하며 전송 결과는 `src/data/seo-indexnow-sent.json`에 중복 방지 기록
- HTTP 200/202는 통보 접수이지 수집·색인 완료가 아닙니다.

## Google Search Console / Naver Search Advisor에서 해야 할 일

1. 운영 도메인의 소유권을 확인합니다.
2. 각 웹마스터도구에서 **한 번** `https://xn--h49a29twjdmms77a5sofgdjwa.shop/sitemap.xml`을 제출합니다.
3. 주요 랜딩과 홈 URL 검사 결과로 실제 수집·색인 상태를 별도 확인합니다.
4. 검색엔진에 수동 URL 요청을 반복할 필요는 없습니다. Sitemap 자동 갱신과 IndexNow는 발견 지원일 뿐, 색인을 강제하지 않습니다.

## 내부 링크 품질

`scripts/seo-experiments/check-discovery-links.mjs`는 홈에서 직접 따라갈 수 있는 내부 링크로 사이트맵의 색인 대상 URL 도달성/클릭 깊이를 계산하여 `reports/seo-experiments/crawl-depth.json`을 작성합니다. 링크가 없는 URL은 사이트맵에 있어도 발견·평가가 어려울 수 있습니다.
