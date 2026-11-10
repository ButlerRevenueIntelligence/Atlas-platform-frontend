import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {DataAccessReview} from '../src/components/dataAccess/DataAccessReview.jsx';
const snapshot={name:'Test CRM',provider:'hubspot',version:'1',legalEntity:'Test entity',purpose:'Revenue analysis',imports:'Deals and accounts',access:'Read and write scope',aiProcessing:'Selected evidence is sent to an AI provider.',otherProviders:'Disclosed processors',saleAndTraining:'Documented restrictions',storageAndAccess:'Documented controls',retentionAndDeletion:'Disconnect does not delete imports.',documents:{agreement:{title:'Data Processing Agreement',text:'Exact contract version 1'},terms:{title:'Terms',text:'Exact terms'}},checkboxes:{authority:'Confirm authority',processing:'Review processing',agreement:'Accept agreement'}};
function render(data){return renderToStaticMarkup(React.createElement(DataAccessReview,{data,onClose(){},onContinue(){}}));}
const draft=render({snapshot,mode:'preview',ready:false,canAccept:true});
assert.match(draft,/Draft disclosure/);assert.match(draft,/Exact contract version 1/);assert.doesNotMatch(draft,/type="checkbox"/);assert.match(draft,/Continue without acceptance/);
const active=render({snapshot,mode:'enforce',ready:true,canAccept:true,agreementAccepted:false});
assert.equal((active.match(/type="checkbox"/g)||[]).length,3);assert.doesNotMatch(active,/checked=""/);assert.match(active,/disabled=""[^>]*>Agree and continue/);
const signed=render({snapshot,mode:'enforce',ready:true,canAccept:true,agreementAccepted:true});
assert.equal((signed.match(/type="checkbox"/g)||[]).length,2);assert.match(signed,/already accepted/);
const viewer=render({snapshot,mode:'enforce',ready:true,canAccept:false});assert.match(viewer,/<fieldset disabled=""/);
const receipt=render({snapshot,mode:'enforce',ready:true,canAccept:true,receipt:{provider:'hubspot',email:'admin@example.test',acceptedAt:'2026-11-10T00:00:00Z',_id:'test'}});assert.match(receipt,/Download acceptance receipt/);
console.log('5 data-access rendering cases passed (server rendering; browser interaction remains unverified).');
