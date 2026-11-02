# 앤텔레콤 알뜰폰 홈페이지 — 독립 사용용 복제본

이 브랜치는 `feat/seo-three-experiments-v1`의 전체 코드를 바탕으로 독립 판매점이 설정해 사용할 수 있도록 분리한 작업본입니다.

## 변경한 기본값

- `src/data/site.json`에서 원래 운영자의 상호·주소·대표자명·연락처·사업자 정보 제거
- 기본 개통 링크 제거. `ACTIVATION_URL`을 설정하기 전까지 개통 CTA는 안내 페이지로 이동
- 기본 URL은 `https://example.com`; 공식 도메인과 블로그 링크는 운영자가 설정
- 기존 판매점의 UTM 식별 문자열 제거
- 재사용자가 모두 앤텔레콤 공식 파트너라는 표현을 사용하지 않음
- `PRODUCTION_READY=false` 및 검색 색인 차단 상태 유지

## 복제 후 반드시 변경할 파일과 설정

1. `src/data/site.json`: `business` 안에 실제 운영자/사업자 정보와 연락처 입력. 표시 의무가 있는 정보는 사실 그대로 기재
2. 배포 서비스 환경변수: `SITE_URL=https://본인도메인`, `BASE_PATH=/`, `ACTIVATION_URL=https://본인승인된개통주소`, `PRODUCTION_READY=false`
3. 요금제/프로모션은 `src/data/research/`에 보관된 자료의 기준일을 읽고 공식 안내와 대조 후 최신화
4. 이미지, 로고, 공식 판매점 명칭 및 제휴·혜택 표시는 사용권한 확인
5. `pnpm install && pnpm run build && pnpm run audit:seo` 실행
6. 화면·개통 연결·법정 고지·로봇 설정을 검수한 다음에만 `PRODUCTION_READY=true`로 전환

## GitHub에 별도 저장소로 복사하는 방법

기존 GitHub 저장소를 유지하고 독립 저장소를 만들려면 GitHub의 **Import repository**를 사용합니다.

- Source URL: `https://github.com/prepaid1215/ntelecom-budget-phone.git`
- Owner: `prepaid1215`
- 새 저장소 예시 이름: `ntelecom-budget-template`
- 소스 전체 Git 기록에는 기존 메인/실험/템플릿 브랜치가 포함될 수 있으니, 가져온 뒤 `template/mvno-site-reuse-v1` 브랜치가 있는지 확인하고 사용하세요.
- 가져온 저장소에는 기존 GitHub Pages·Cloudflare 도메인·DNS·환경변수가 자동 이전되는 것으로 간주하지 마세요.

**주의:** GitHub 저장소를 통째로 Import하면 기존 커밋 기록도 함께 복사될 수 있습니다. 과거 기록에 원운영자 식별 정보가 포함돼 있을 수 있습니다. 외부에 배포할 공개 템플릿은 기록 제거 및 비밀정보 점검 후 공유하세요.

이 템플릿은 완성된 개통 시스템이 아닙니다. 실전 사이트의 배포 전 설정과 실제 개통 권한 검증이 필요합니다.
