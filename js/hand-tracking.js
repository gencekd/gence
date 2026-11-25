// WebXR joint-space names (not controller select events).
const NAMES={thumb:'thumb-tip',index:'index-finger-tip',ring:'ring-finger-tip',pinky:'pinky-finger-tip',wrist:'wrist',middleBase:'middle-finger-phalanx-proximal',indexBase:'index-finger-phalanx-proximal',pinkyBase:'pinky-finger-phalanx-proximal'};
// The proximal joint is the MCP landmark; use the same joint for all three bases.
export function readXRHands(frame,space,session){
  const hands=[];if(!frame||!space||!session||typeof frame.getJointPose!=='function')return hands;
  for(const source of session.inputSources){
    if(!source.hand)continue;
    const joints={};let complete=true;
    for(const [key,name] of Object.entries(NAMES)){
      const joint=source.hand.get(name);const pose=joint?frame.getJointPose(joint,space):null;
      if(!pose||pose.emulatedPosition){complete=false;break;}joints[key]=pose.transform.position;
    }
    if(complete)hands.push({id:source.handedness==='none'?`hand-${hands.length+1}`:source.handedness,joints});
  }
  return hands;
}
