import test from 'node:test';
import assert from 'node:assert/strict';
import {guideJourneyHref} from '../src/lib/guide-journey.js';
const origin='https://example.test';

test('comparison handoff retains source and existing product fields',()=>{
 const url=new URL(guideJourneyHref('/start/?from=antelcom_plan&plan=demo&net=lg#choices','exp_a_comparison',origin));
 assert.equal(url.searchParams.get('from'),'exp_a_comparison');
 assert.equal(url.searchParams.get('plan'),'demo');assert.equal(url.searchParams.get('net'),'lg');assert.equal(url.hash,'#choices');
});
test('benefit and card detail routes retain their query strings',()=>{
 for(const path of ['/benefits/naverpay/?sort=data','/card/kt-my-alttle-bc-baro/?sort=data']){
  const url=new URL(guideJourneyHref(path,'exp_a_benefits',origin));
  assert.equal(url.searchParams.get('sort'),'data');assert.equal(url.searchParams.get('from'),'exp_a_benefits');
 }
});
test('external checkout, anchors and other guides are unchanged',()=>{
 for(const href of ['https://provider.test/open','#choose','/guides/','/앤텔레콤-알뜰폰-신규가입-방법/','mailto:hello@example.test'])
  assert.equal(guideJourneyHref(href,'exp_a_signup',origin),href);
});
test('only valid A source identifiers propagate',()=>{
 for(const source of ['direct','exp_a_','exp_b_demo','exp_a_demo<script>','exp_a_'+ 'x'.repeat(61),null])
  assert.equal(guideJourneyHref('/plans/',source,origin),'/plans/');
});
test('subpath deployments preserve the prefix and exclude routes outside it',()=>{
 const u=new URL(guideJourneyHref('/preview/plans/k/?order=low','exp_a_network_k',origin,'/preview'));
 assert.equal(u.pathname,'/preview/plans/k/');assert.equal(u.searchParams.get('from'),'exp_a_network_k');
 assert.equal(guideJourneyHref('/plans/','exp_a_signup',origin,'/preview'),'/plans/');
});
