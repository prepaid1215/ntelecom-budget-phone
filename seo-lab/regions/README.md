# Regional page data and review pipeline

`administrative-areas.json` is a snapshot of 3,559 Korean administrative-dong records. Its source snapshot and URL lock generate URL candidates; the number of generated files is not an index count.

## Commands

```bash
pnpm run regions:import -- /path/to/HangJeongDong_ver20261001.geojson
pnpm run regions:generate
pnpm run regions:audit
```

Review a source update before changing paths. `regions:import` only refreshes the normalized source. After reviewing names, codes, and the proposed URL changes, explicitly run:

```bash
pnpm run regions:sync-url-lock -- /path/to/HangJeongDong_ver20261001.geojson
```

The URL lock keeps a code-derived suffix in each slug to prevent same-name collisions and path drift. Retired code mappings stay reserved. A renamed area requires review before its locked path changes.

## Evidence gate

Put checked source-backed facts in `evidence.json` keyed by `<type>:<10-digit-administrative-code>`, where type is `prepaid` or `mvno`. A page becomes an editorial index candidate only if it has owner approval, at least one current regional fact (180 days), at least one current product fact (90 days), and at least 260 characters of approved unique copy. Each fact needs a source URL, source label, check date, and at least 40 characters. Duplicate fact text blocks eligibility. The default evidence registry is empty, so no local case, store, stock, coverage, price, or activation promise is invented.

Candidate status does not publish or index a page. All output is generated under the ignored `seo-lab-regions-preview/` directory, carries `noindex,follow`, and is disconnected from Astro routes, the public sitemap, robots, DNS, and deployment settings. `preview-candidate-sitemap.xml` is for offline QA only and must not be submitted. `editorial-index-candidates-sitemap.xml` lists evidence-qualified editorial candidates only. Search submission, crawl, Google index state, impressions, and clicks remain separately unobserved until connected to real Search Console or crawl data.

## Source attribution

The normalized records were derived from [vuski/admdongkor](https://github.com/vuski/admdongkor), snapshot `ver20261001`, based on administrative boundaries opened by Statistics Korea SGIS under KOGL Type 1 and distributed under CC BY 4.0:

> 본 데이터는 통계청 통계지리정보서비스(SGIS, https://sgis.kostat.go.kr)에서 공공누리 제1유형으로 개방한 행정동 경계를 가공한 것이며(가공: vuski/admdongkor, https://github.com/vuski/admdongkor), CC BY 4.0으로 배포됩니다.

Source snapshot SHA-256: `843ece3a0b3429742cd4a1b699cc13987a88b5e5401f382e7fdaaa194ea5e605`.
