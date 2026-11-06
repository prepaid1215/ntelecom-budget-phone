# 실험 C — IndexKit형 네이버 블로그 원문 링크 실험

이 사이트의 HTML 페이지(carrier)에 네이버 블로그 모바일 원문 URL로 가는 일반 `<a href>` 링크를 둡니다. 그 뒤 링크가 있는 원문(실험군)과 링크가 없는 원문(대조군)의 검색엔진 상태를 같은 날짜 창으로 비교합니다. 링크는 발견 기회를 줄 뿐입니다. **Google·네이버의 수집이나 색인을 보장하거나 강제하지 않습니다.**

## 데이터와 명령

데이터는 `src/data/seo-experiments/indexkit.json` 한 곳에만 있으며, 아래 CLI로만 바꿉니다.

```bash
pnpm run seo:indexkit status
pnpm run seo:indexkit add --url=https://blog.naver.com/<id>/<logNo> [--label="원문 제목"] [--summary="직접 쓴 한 줄 요약"] [--placements=list,contextual]
pnpm run seo:indexkit new-batch --id=2026-12-b2 --title="링크 묶음 2" --carrier=index|noindex
pnpm run seo:indexkit assign --batch=2026-11-b1
pnpm run seo:indexkit publish --batch=2026-11-b1 --date=YYYY-MM-DD   # 배포된 HTML이 실제로 공개된 날
```

- **URL 형식.** `blog.naver.com`, `PostView.naver/nhn`, `?Redirect=Log&logNo=` 형식을 모두 `https://m.blog.naver.com/{id}/{logNo}`로 정규화합니다. 중복과 글 URL이 아닌 주소는 거부합니다.
- **배정.** `sha256(seed:batch + url)` 순위에 따라 실험군과 대조군을 번갈아 배정합니다. 이미 배정된 대상은 다시 섞지 않습니다. 게시일이 기록된 배치에는 대상을 추가할 수 없으므로 새 배치를 만듭니다.
- **게시 조건.** 배치 안 실험군·대조군이 각각 `minTargetsPerGroup`(기본 5) 이상이고 미배정 대상이 없어야 상태가 `ready`가 되고 링크가 출력됩니다. 그 전(`enrolling`)에는 어떤 대상 URL도 HTML에 나오지 않습니다.
- **현재 상태.** 실제 등록 URL은 1건(`ik-0001`)뿐이어서 `enrolling` 상태이고 링크는 0개입니다. **실제 실험 개시는 실제 원문 URL이 최소 10건(그룹당 5건) 확보된 뒤입니다.** 시스템 테스트(`seo:test:system`)는 임시 복사본과 합성 픽스처 URL로 전 과정을 검증하며, 실제 데이터 파일은 바꾸지 않습니다.

## 링크 매니페스트

`pnpm run seo:manifest`는 **빌드된 HTML**에서 네이버 블로그 링크를 모두 찾아 다음 항목을 기록합니다.

- 대상 ID, 링크가 있는 페이지와 위치(`list`/`contextual`/`hub`), 앵커 문구, `rel`
- carrier의 robots 값과 sitemap 포함 여부
- 게시일
- 홈과 sitemap에서 출발한 최단 내부 발견 경로

기대 배치와 다르거나, 대조군·미배정 URL이 링크되거나, `nofollow`/`ugc`가 붙으면 실패합니다.

## noindex carrier의 측정 한계와 비교 설계

배치마다 `carrierRobots`(`index` | `noindex`)를 정합니다. 실험군은 carrier 종류에 따라 `treatment:index-carrier`와 `treatment:noindex-carrier` 두 군으로 나뉘어 대조군과 비교됩니다.

noindex carrier에는 다음 한계가 있습니다.

1. **발견 경로가 하나뿐입니다.** noindex 페이지는 sitemap에 넣지 않습니다. 따라서 검색엔진이 carrier를 찾는 길은 내부 링크(현재 `/indexkit/` 허브)밖에 없고, 허브 자체도 색인 가능한 배치가 있어야 sitemap에 실립니다.
2. **링크 추적이 약해질 수 있습니다.** `noindex,follow`라도 오래 noindex로 남은 페이지의 링크는 Google이 따라가지 않게 될 수 있다고 알려져 있습니다. 결과가 나빠도 '링크 효과 없음'과 'carrier가 수집되지 않음'을 구별해야 합니다.
3. **carrier 수집 여부는 별도로 기록합니다.** 서버 로그나 Search Console로 carrier 페이지 자체의 `crawled`를 기록해야 실험군 결과를 해석할 수 있습니다. 제3자 URL(원문)의 `discovered`/`crawled`는 이 프로젝트가 관측할 수 없으므로 원장이 `unobservable`만 허용합니다.

색인 가능한 carrier와 비교하려면 같은 시기에 두 배치를 만들고(`--carrier=index`, `--carrier=noindex`), 각각 그룹당 5건 이상을 배정해 같은 날 게시합니다.
