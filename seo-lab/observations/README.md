# 관측 원장과 7·14·28일 비교 결과

## 원장: `seo-lab/observations/ledger.json`

이벤트 하나는 다음 구조입니다.

```json
{ "unit": "https://…/앤텔레콤-다이소유심-개통방법/", "engine": "google", "stage": "indexed", "result": "yes",
  "observedAt": "2026-11-20T02:00:00Z", "method": "gsc_url_inspection", "source": "GSC 검사 결과 캡처 #12", "metrics": null, "note": null }
```

| 필드 | 값 |
|---|---|
| engine | `google`, `naver` |
| stage | `submitted`, `discovered`, `crawled`, `indexed`, `served`(검색 노출). 단계는 서로 독립이며, 앞 단계로 뒤 단계를 추정하지 않습니다. |
| result | `yes`, `no`, `unobservable`. 관측 불가이며 성공으로 집계하지 않습니다. |
| method | Google: `gsc_url_inspection`, `gsc_page_indexing`, `gsc_performance`, `gsc_sitemap`, `server_log`, `site_operator`, `exact_url_search`, `manual_serp`. 네이버: `searchadvisor_request`, `searchadvisor_report`, `searchadvisor_sitemap`, `server_log`, `site_operator`, `exact_url_search`, `manual_serp` |

**거부 규칙**

- 등록되지 않은 URL
- 자기 사이트 전용 방법(GSC, 서치어드바이저, 서버 로그)을 네이버 블로그 URL에 쓴 경우
- 제3자 URL의 `discovered`/`crawled`를 `yes`/`no`로 기록한 경우
- C 대상의 `submitted` (실험 오염)
- `metrics` 없이 기록한 `gsc_performance`/`searchadvisor_report` 노출
- 노출수·클릭을 측정할 수 없는 방법에 수치를 붙인 경우

하나라도 실패하면 원장은 바뀌지 않습니다.

```bash
pnpm run seo:observe --template --experiment=C --engine=google > todo.json   # 확인할 URL 목록
pnpm run seo:observe --input=events.json
```

예전 B 원장(`seo-lab/regions/index-flow-observations.json`)의 이벤트도 같은 단계로 변환해 함께 집계합니다.

## 결과: `pnpm run seo:report [--today=YYYY-MM-DD]`

`reports/seo-experiments/`에 `results-units.{json,csv}`(URL×엔진×창)와 `results-summary.{json,csv}`(실험×군×엔진×창)를 씁니다.

**창의 시작일**

- A·B: `config.json`의 `launchedAt`
- C: 배치 `publishedAt` (실험군·대조군이 같은 날짜를 공유)
- 시작일이 없으면 `not_started`입니다. 현재 세 실험 모두 미시작입니다.

**창 N의 범위**: 시작일 0일차부터 N일차 끝까지 관측된 최신 결과입니다.

**단위별 열**

- 단계별 결과와 관측 시각·방법
- 첫 `yes` 일차(`…FirstYesDay`)
- 시작 전 색인 상태(`baselineIndexed`)
- 창 범위 안의 노출수·클릭

**요약 열**

- 단계별 `Yes`/`No`/`Unobservable`/`Unobserved` 수
- `YesRateAmongObserved` = yes/(yes+no). 관측값이 없으면 빈칸이며, 0으로 채우지 않습니다.

C 대상 중 시작 전 이미 색인된 URL은 `excluded`로 빠집니다.
