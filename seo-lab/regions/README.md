# Regional page data and review pipeline

`administrative-areas.json` is a snapshot of 3,559 Korean administrative-area records across 256 city/county/district units. Its source snapshot and URL lock generate URL candidates; the number of generated files is not an index count. The checked-in `coverage-manifest.json` records the expected code/name set for that exact source version, so CI catches missing or unexpected regions.

The 2026-10-01 source contains 16 current metropolitan-level regions and includes Sejong (code `36`). The former list of 17 counted Gwangju and Jeollanam-do separately. The [special act](https://www.law.go.kr/LSW/lsRvsDocListP.do?chrClsCd=010202&lsId=015064&lsRvsGubun=all) took effect on 2026-07-01 and merged them into Jeonnam-Gwangju Special Metropolitan City, as the [Ministry of the Interior and Safety](https://mois.go.kr/frt/bbs/type010/commonSelectBoardArticle.do?bbsId=BBSMSTR_000000000008&nttId=126845) describes. The coverage manifest checks the post-merger source names and codes, including Sejong; it does not mistake the merger for a missing region.

## Commands

```bash
pnpm run regions:import -- /path/to/HangJeongDong_ver20261001.geojson
pnpm run regions:generate
pnpm run regions:audit
pnpm run regions:quality-test
pnpm run regions:pipeline-test
```

Review a source update before changing paths. `regions:import` only refreshes the normalized source; the version is read from the filename or can be provided using `--version=YYYYMMDD`. After comparing the new coverage against official code/name sources, update `coverage-manifest.json`; after reviewing names, codes, and proposed URL changes, explicitly run:

```bash
pnpm run regions:sync-url-lock -- /path/to/HangJeongDong_ver20261001.geojson
```

The URL lock keeps a code-derived suffix in each slug to prevent same-name collisions and path drift. Retired code mappings stay reserved. A renamed area requires review before its locked path changes.

## Evidence gate

Put checked source-backed facts in `evidence.json` keyed by `<type>:<10-digit-administrative-code>`, where type is `prepaid` or `mvno`. A page becomes an editorial index candidate only if it has owner approval, at least one current regional fact (180 days), at least one current product fact (90 days), and approved copy with at least 260 characters and 40 wordlike units. Each fact needs a source URL, source label, check date, and at least 40 characters. A local fact must carry `scopeCode` matching the page's exact 10-digit area code. A product fact must carry a `productId` present in the current prepaid or postpaid-MVNO source catalog. This prevents a district-level fact from being presented as unique dong-level evidence and prevents product claims without a matching source record.

The renderer places the checked regional facts, checked product facts, source links, and approved regional copy into separate sections. Exact repeated facts and near-duplicate regional copy are rejected across pages after region names and service terms are normalized. Near-duplicate copy uses character-trigram Jaccard similarity at a threshold of `0.82`; the quality audit re-runs the same detector against the evidence registry. The regional audit derives generated and candidate counts from the current source and evidence; it does not require 7,664 files or zero candidates. `regions:pipeline-test` temporarily uses synthetic fixture data, proves one content candidate passes and renamed near-duplicate copy is held, then restores the original empty evidence file and regenerates the review output. The default evidence registry is empty, so no local case, store, stock, coverage, price, or activation promise is invented.

Candidate status does not publish or index a page. All output is generated under the ignored `seo-lab-regions-preview/` directory, carries `noindex,follow`, and is disconnected from Astro routes, the public sitemap, robots, DNS, and deployment settings. `preview-candidate-sitemap.xml` is for offline QA only and must not be submitted. `editorial-index-candidates-sitemap.xml` lists evidence-qualified editorial candidates only. Search submission, crawl, Google index state, impressions, and clicks remain separately unobserved until connected to real Search Console or crawl data.

## Source attribution

The normalized records were derived from [vuski/admdongkor](https://github.com/vuski/admdongkor), snapshot `ver20261001`, based on administrative boundaries opened by Statistics Korea SGIS under KOGL Type 1 and distributed under CC BY 4.0:

> 본 데이터는 통계청 통계지리정보서비스(SGIS, https://sgis.kostat.go.kr)에서 공공누리 제1유형으로 개방한 행정동 경계를 가공한 것이며(가공: vuski/admdongkor, https://github.com/vuski/admdongkor), CC BY 4.0으로 배포됩니다.

Source snapshot SHA-256: `843ece3a0b3429742cd4a1b699cc13987a88b5e5401f382e7fdaaa194ea5e605`.
