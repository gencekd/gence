import * as THREE from 'three';
import {handMotion} from '../../js/hand-motion.js';
export const SCALE=1/70, EYE_HEIGHT=1.60, HUMAN_HEIGHT=1.70;
const PALACE_START=new THREE.Vector3(-.7,0,2.6);
const UP=new THREE.Vector3(0,1,0);
export class Locomotion {
  constructor(rig){this.rig=rig;this.spawn=PALACE_START.clone();this.heading=-1.1;this.walkSpeed=.65;this.turnSpeed=30;this.forward=new THREE.Vector3(0,0,-1);this.before=new THREE.Vector3();this.after=new THREE.Vector3();this.direction=new THREE.Vector3();this.reset();}
  reset(){this.rig.position.copy(this.spawn);this.rig.rotation.set(0,this.heading,0);this.forward.set(0,0,-1);}
  // pose is local tracking-space position + orientation, NOT scaled.
  step(action,dt,pose){
    if(!pose||!Number.isFinite(dt)||dt<=0)return {speed:0,turn:0};
    dt=Math.min(dt,.05);
    const {position,quaternion}=pose;
    this.direction.set(0,0,-1).applyQuaternion(quaternion).applyQuaternion(this.rig.quaternion);this.direction.y=0;
    if(this.direction.lengthSq()>1e-5)this.forward.copy(this.direction.normalize());
    const motion=handMotion(action,this.walkSpeed,this.turnSpeed);
    if(motion.speed)this.rig.position.addScaledVector(this.forward,motion.speed*dt);
    if(motion.turn){
      // Keep the actual tracked head at its current horizontal world position.
      // Otherwise turning an offset room-scale head would cause an orbit.
      const angle=-THREE.MathUtils.degToRad(motion.turn)*dt;
      this.before.copy(position).applyQuaternion(this.rig.quaternion);
      this.rig.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(UP,angle));
      this.after.copy(position).applyQuaternion(this.rig.quaternion);
      this.rig.position.x+=this.before.x-this.after.x;this.rig.position.z+=this.before.z-this.after.z;
    }
    return motion;
  }
}
