# 앤텔레콤개통방법.shop — 공개 URL 변경 알림 (IndexNow)

운영 배포와 **분리된 빌드 산출물 후처리**입니다. 기존 503개 HTML을 변경하지 않습니다.

## 실행

```bash
# 운영 도메인으로 빌드할 때(로컬/임시 산출물에만, 자동 배포 아님)
SITE_URL=https://xn--h49a29twjdmms77a5sofgdjwa.shop PRODUCTION_READY=true SEO_REGIONS_EMIT=candidates pnpm run build

# 미리보기: 원본 HTML 해시 비교, 사이트맵 대상만 인벤토리 작성, RSS 미리보기 생성
node scripts/seo-experiments/indexnow-pipeline.mjs --dist=dist --origin=https://xn--h49a29twjdmms77a5sofgdjwa.shop

# 실제 공개일이 검증됐을 때만 lastmod 기록; 이전 배포의 manifest를 --previous에 지정
node scripts/seo-experiments/indexnow-pipeline.mjs --dist=dist --origin=https://xn--h49a29twjdmms77a5sofgdjwa.shop --previous=previous-publication-manifest.json --published-at=2026-11-04 --write

# IndexNow를 사용하려면 배포 산출물에 키 파일을 포함해야 합니다.
INDEXNOW_KEY=<도메인별-키> node scripts/seo-experiments/indexnow-pipeline.mjs --dist=dist --origin=https://xn--h49a29twjdmms77a5sofgdjwa.shop --previous=previous-publication-manifest.json --published-at=2026-11-04 --write

# 실제 운영 주소에 배포된 키 파일 내용 확인 이후, 운영자가 명시적으로 실행할 때만 전송
INDEXNOW_ALLOW_SEND=yes node scripts/seo-experiments/indexnow-send.mjs --send --payload=dist/indexnow-new.json

# 파이프라인 단위 검사
node --test scripts/seo-experiments/test-indexnow.mjs
```

## 안전 장치

- 사이트맵에 존재하고 **실제 정적 HTML이 빌드된 색인 대상** URL만 처리합니다.
- B는 `SEO_REGIONS_EMIT=candidates`에서 근거가 승인된 지역만 처리합니다. 현재 후보 0개를 임의로 올리지 않습니다.
- 첫 스냅샷 도입은 과거 URL을 전부 신규 변경으로 전송하지 않습니다. 과거 전체 재전송은 네이버 권장 방식이 아닙니다.
- 기존 HTML의 실제 바이트를 SHA-256으로 비교합니다. 이전 배포 스냅샷은 운영자가 보존해야 하며 자동 생성된 파일만으로 배포 이력을 증명하지 않습니다.
- `lastmod`는 검증된 공개·변경일을 넘긴 URL에만 추가합니다. 단순 빌드 시각을 대입하지 않습니다.
- 전송은 빌드·push·PR로 자동 실행되지 않습니다. 도메인 전용 키 파일이 실제 주소에 올라와 있고 일치해야 합니다.
- IndexNow 200/202는 접수 확인이며, 검색 색인·노출 성공이 아닙니다. Google의 일반 페이지 Indexing API로 대체하지 않습니다.
- RSS는 기존 페이지 HTML을 수정하지 않고 별도 `rss.xml` 파일로 출력합니다. 검색엔진의 RSS 제출·발견은 별도 운영 절차입니다.

현재 버전은 **배포 연동 준비용**입니다. 실제 전송을 수행한 기록은 없습니다.
