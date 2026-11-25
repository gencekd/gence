// Shared pure gesture engine. Coordinates may be metres or any isotropic unit.
export const ACTIONS = Object.freeze({ NONE:'none', WALK:'walk', RIGHT:'right', LEFT:'left', CONFLICT:'conflict' });
const TIPS = {walk:'index', right:'pinky', left:'ring'};
const valid = p => p && [p.x,p.y,p.z].every(Number.isFinite);
export const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function pinchRatios(joints) {
  if (!joints || !['thumb','index','ring','pinky','wrist','middleBase','indexBase','pinkyBase'].every(k=>valid(joints[k]))) return null;
  const scale = (distance(joints.wrist,joints.middleBase)+distance(joints.indexBase,joints.pinkyBase))/2;
  if (scale < 1e-6) return null;
  return Object.fromEntries(Object.entries(TIPS).map(([action,tip])=>[action,distance(joints.thumb,joints[tip])/scale]));
}
export class GestureEngine {
  constructor(press=0.24, gap=0.12){this.press=press;this.gap=gap;this.latched=new Map();this.waitForRelease=false;}
  reset(){this.latched.clear();this.waitForRelease=false;}
  update(hands=[],menuActive=false,menuHands=null){
    const live=new Set(), active=[]; let tracked=0;
    for(const {id,joints} of hands){
      const ratios=pinchRatios(joints);if(!ratios || live.has(id))continue;
      tracked++;live.add(id);
      const old=this.latched.get(id)||{};
      const next=Object.fromEntries(Object.entries(ratios).map(([k,r])=>[k,r<=(old[k]?this.press+this.gap:this.press)]));
      this.latched.set(id,next);
      for(const [action,on] of Object.entries(next))if(on)active.push({id,action});
    }
    for(const id of this.latched.keys())if(!live.has(id))this.latched.delete(id);
    const commands=new Set(active.map(a=>a.action));
    // Priority: safety stop (conflict) > one unambiguous command > idle.
    // Two hands requesting the same command count once; no double speed.
    let action=commands.size>1?ACTIONS.CONFLICT:commands.values().next().value||ACTIONS.NONE;
    // A pinch used to select or dismiss settings must end before it can drive walking.
    if(menuActive || (action===ACTIONS.WALK && active.some(item=>menuHands?.has(item.id)))){
      if(active.length)this.waitForRelease=true;
      action=ACTIONS.NONE;
    }
    if(this.waitForRelease){
      if(tracked && !active.length)this.waitForRelease=false;
      action=ACTIONS.NONE;
    }
    return {action,hand:[...new Set(active.map(a=>a.id))].join(' + ')||'—',tracked};
  }
}
