import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GestureEngine,pinchRatios} from '../js/gestures.js';
const p=(x,y=0,z=0)=>({x,y,z});
function hand(id='left',walk=.8,right=.8,left=.8,s=1){const joints={thumb:p(0),index:p(walk),pinky:p(right),ring:p(left),wrist:p(0,-1),middleBase:p(0),indexBase:p(-.5),pinkyBase:p(.5)};for(const k in joints)for(const a of ['x','y','z'])joints[k][a]*=s;return {id,joints};}
test('three gestures and release',()=>{for(const [a,h] of [['walk',hand('left',.1)],['right',hand('left',.8,.1)],['left',hand('left',.8,.8,.1)]]){const g=new GestureEngine();assert.equal(g.update([h]).action,a);assert.equal(g.update([hand()]).action,'none');}});
test('hysteresis prevents chatter',()=>{const g=new GestureEngine();assert.equal(g.update([hand('left',.30)]).action,'none');assert.equal(g.update([hand('left',.23)]).action,'walk');assert.equal(g.update([hand('left',.30)]).action,'walk');assert.equal(g.update([hand('left',.37)]).action,'none');});
test('scale normalization',()=>{const g=new GestureEngine();assert.equal(g.update([hand('left',.2,.8,.8,.05)]).action,'walk');assert.equal(g.update([hand('left',.2,.8,.8,10)]).action,'walk');});
test('tracking loss and reacquisition clear latch',()=>{const g=new GestureEngine();g.update([hand('left',.1)]);assert.equal(g.update([]).action,'none');assert.equal(g.update([hand('left',.30)]).action,'none');});
test('same hand conflicting pinches stop',()=>{assert.equal(new GestureEngine().update([hand('left',.1,.1)]).action,'conflict');});
test('different hand conflicting pinches stop',()=>{assert.equal(new GestureEngine().update([hand('left',.1),hand('right',.8,.1)]).action,'conflict');});
test('two hands same command do not amplify',()=>{const r=new GestureEngine().update([hand('left',.1),hand('right',.1)]);assert.equal(r.action,'walk');assert.equal(r.tracked,2);assert.equal(r.hand,'left + right');});
test('invalid joint data fail closed',()=>{const g=new GestureEngine();const h=hand('left',.1);g.update([h]);delete h.joints.thumb;assert.equal(pinchRatios(h.joints),null);assert.equal(g.update([h]).action,'none');});
test('invalid palm length fails closed',()=>{const h=hand('left',.1);h.joints.wrist=h.joints.middleBase;h.joints.indexBase=h.joints.pinkyBase;assert.equal(pinchRatios(h.joints),null);});
test('reset clears both hands',()=>{const g=new GestureEngine();g.update([hand('left',.1),hand('right',.1)]);g.reset();assert.equal(g.update([hand('right',.3)]).action,'none');});

test('a menu pinch cannot turn into a walk when settings close',()=>{
  const g=new GestureEngine(), pinch=hand('right',.1);
  assert.equal(g.update([pinch],true).action,'none');
  assert.equal(g.update([pinch],false).action,'none');
  assert.equal(g.update([hand('right')]).action,'none');
  assert.equal(g.update([pinch]).action,'walk');
});
test('pointing an idle hand at the menu leaves the other hand free to walk',()=>{
  const g=new GestureEngine();
  assert.equal(g.update([hand('left'),hand('right',.1)],false,new Set(['left'])).action,'walk');
  assert.equal(g.update([hand('right',.1)],false,new Set(['right'])).action,'none');
});
