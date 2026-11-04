# /start/ conversion funnel (postpaid-first)

Business goal: **postpaid MVNO activations first**. Prepaid is a secondary fallback for visitors unable to join postpaid.

## User journey

1. SEO/catalog page -> same-domain \`/start/?from=...&net=...&plan=...\`.
2. \`/start/\` shows two **postpaid** options: KT or LG U+.
3. Clicking a network option opens the actual activation website. The deployed \`ACTIVATION_URL\` is the fallback destination; if verified direct KT and LG URLs are available, configure \`START_KT_URL\` and \`START_LG_URL\` separately. Without those variables, the visitor must choose the same network again on the provider homepage.
4. Below the primary offer, a collapsed panel explains prepaid as a fallback, with separate KT/LG links. Neither the page nor the tracking should imply equal priority between postpaid and prepaid.
5. No proxy form, personally identifiable input, approval or activation back end lives here.

## GA4 configuration (not active until configured)

Provide \`PUBLIC_GA4_MEASUREMENT_ID=G-...\` at **build time** for the website's GA4 web data stream and rebuild/deploy. This adds GA4 collection to the \`/start/\` page. Without an ID, JavaScript event calls are no-ops and no real click data is recorded.

- \`start_view\`: arrival on \`/start/\` (params: \`traffic_source\`, \`plan_id\`, \`network_hint\`).
- \`activation_outbound\`: user clicked a KT or LG action (params: \`traffic_source\`, \`plan_id\`, \`network\`, \`billing_type=postpaid|prepaid\`).
- \`prepaid_alternative_open\`: expanded the prepaid section (param: \`traffic_source\`).

GA4 can also record normal \`page_view\`; do not conflate page views with \`start_view\` events. Register the custom parameters as event-scoped custom dimensions if needed in reports.

The outbound URL receives \`from=start_<billing>_<network>_<original-source>\`. This is only an attribution hint: the receiving system must **actually record** \`from\` to support finished-activation reporting. Clicking the outbound CTA is **not** an actual successful activation.

For confirmed **successful activation conversions**, implement a permitted first-party completion event or a verified cross-domain tracking mechanism on the actual activation system. Do not claim those counts from the static site alone.

## SEO and release

- \`/start/\` is a conversion endpoint, not a ranking-target landing page: \`noindex,follow\`, self-canonical, exclude from sitemap.
- Original 500 postpaid pages keep their URLs and product content. Their CTA destinations intentionally change from direct \`preplan.site\` to same-domain \`/start/\`; therefore rendered HTML SHA checks that require zero changes must be reviewed as planned functional changes before combining this PR with PR #3.
- This branch is independent of PR #3 and **does not deploy automatically**.
- Verify build with \`pnpm run build && node scripts/test-start-funnel.mjs\` and the GitHub Actions check, then configure analytics and direct destinations before production rollout.
