# test-post — 후불 알뜰폰 검색 점유 실험

2026-10-28. 기존 `ntelecom-budget-phone` 후불요금제 조사 자료를 기반으로 한 **독립 19페이지 정적 웹사이트**.

- 후보 도메인/Canonical: `https://prepaid1215.github.io/test-post/`
- 페이지마다 고유 H1, title, description, self-referential canonical, FAQ/Breadcrumb JSON-LD
- 실질 데이터: 2026-09-28 조사 후불 47개 중 해당 조건 상품 표시
- 19페이지 `site/**/index.html`, 반응형 CSS, sitemap, robots
- 후불 가입 자격/현재 요금/혜택은 개통 직전 공식 화면에서 검증

## 배포
현재 `prepaid1215/ntelecom-budget-phone`의 **test-post 브랜치에 준비**되어 있고, 기존 main/배포 사이트는 변경하지 않습니다. 새 공개 `prepaid1215/test-post` 저장소를 만든 다음 이 브랜치의 파일을 새 저장소 main으로 옮깁니다. GitHub Pages → Source는 GitHub Actions 선택. `.github/workflows/deploy.yml`에서 `site/` 폴더를 배포합니다.

## 사용자 도메인 연결 시
도메인이 확정되면 모든 HTML의 canonical/og:url/JSON-LD, sitemap, robots에서 `https://prepaid1215.github.io/test-post/`을 새 도메인으로 변경해야 합니다. CNAME과 DNS도 연결합니다. 링크는 상대 경로여서 독립 도메인에서도 작동합니다.