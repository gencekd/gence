import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SCALE,HUMAN_HEIGHT,EYE_HEIGHT} from './locomotion.js';
const materials={floor:0xc9c8bd,wall:0xe5dfd2,trim:0x465a5b,wood:0xae8260,green:0x648d7a,blue:0x598296,orange:0xc48955};
const mat=new Map();
function material(name){if(!mat.has(name))mat.set(name,new THREE.MeshStandardMaterial({color:materials[name],roughness:.85}));return mat.get(name);}
function box(group,name,x,y,z,w,h,d,m){const mesh=new THREE.Mesh(new THREE.BoxGeometry(w*SCALE,h*SCALE,d*SCALE),material(m));mesh.name=name;mesh.position.set(x*SCALE,y*SCALE,z*SCALE);group.add(mesh);return mesh;}
function sign(group,text,x,y,z,rotation=0,w=1.6,h=.42){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#20353d';ctx.fillRect(0,0,512,128);ctx.fillStyle='#edf1df';ctx.font='bold 42px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,64);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w*SCALE,h*SCALE),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));mesh.position.set(x*SCALE,y*SCALE,z*SCALE);mesh.rotation.y=rotation;group.add(mesh);}
export function createTestScene(){
  const g=new THREE.Group();g.name='1:70 authored architecture';
  box(g,'Floor',0,-.10,0,18,.2,18,'floor');
  const grid=new THREE.GridHelper(18*SCALE,18,0x71847f,0xa5b1aa);grid.position.y=.006*SCALE;g.add(grid);
  // Perimeter walls with an open portal on the back and a central opening.
  for(const x of [-6,6])box(g,'Side wall',x,1.55,-.5,.2,3.1,13,'wall');
  for(const x of [-3.6,3.6])box(g,'Back wall',x,1.55,-7,4.8,3.1,.24,'wall');
  box(g,'Back door lintel',0,2.7,-7,2.4,.8,.24,'trim');
  for(const x of [-3.5,3.5])box(g,'Interior partition',x,1.45,-2,5,2.9,.18,'wall');
  box(g,'Interior door lintel',0,2.55,-2,2,.7,.18,'trim');
  for(const x of [-1.03,1.03])box(g,'Door jamb',x,1.1,-2,.10,2.2,.26,'trim');
  // Open door leaf (a physical panel parked alongside partition).
  box(g,'Open door leaf',1.10,1.07,-1.48,.06,2.14,1,'wood');
  for(const [i,x,z,h,m] of [[1,-3.5,2,.45,'wood'],[2,-3.5,.5,.9,'green'],[3,3.5,2,1.25,'blue'],[4,3.5,.25,1.7,'orange'],[5,-3.2,-4.5,2.2,'wood'],[6,3.2,-4.5,.8,'green']])box(g,`Height reference ${i}: ${h} m`,x,h/2,z,1, h,1,m);
  box(g,'Human height 1.70m',-2.2,HUMAN_HEIGHT/2,3,.13,HUMAN_HEIGHT,.13,'trim');
  box(g,'Eye height marker',-2.2,EYE_HEIGHT,3,.38,.035,.12,'orange');
  sign(g,'1.70 m',-2.2,1.98,3.02,0,1.1,.28);
  sign(g,'NORTH / ENTRY',0,2.72,-1.88,0,1.8,.30);
  sign(g,'WEST ←',-5.87,1.8,1.5,Math.PI/2);sign(g,'→ EAST',5.87,1.8,1.5,-Math.PI/2);
  sign(g,'COURTYARD',0,2.8,-6.86,0,1.9,.33);
  // Ground direction arrow, outside the walkway centreline.
  const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,-1),new THREE.Vector3(0,.035*SCALE,4.4*SCALE),1.25*SCALE,0x426f66,.3*SCALE,.28*SCALE);g.add(arrow);
  return g;
}
export function disposeTree(root){const geometries=new Set(),materials=new Set(),textures=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{t.image?.close?.();t.dispose();});}
export class Architecture {
  constructor(scene){this.root=new THREE.Group();this.root.name='Model-to-tracking transform ×70';this.root.scale.setScalar(1/SCALE);scene.add(this.root);this.example=createTestScene();this.root.add(this.example);this.loaded=null;this.serial=0;this.loader=new GLTFLoader();}
  restore(){++this.serial;if(this.loaded){this.root.remove(this.loaded);disposeTree(this.loaded);this.loaded=null;}this.example.visible=true;}
  async load(url,units){const serial=++this.serial;const gltf=await this.loader.loadAsync(url);const object=gltf.scene;if(serial!==this.serial){disposeTree(object);return false;}const factors={mini:1,full:SCALE,'mini-mm':.001,'full-mm':.001*SCALE};object.scale.multiplyScalar(factors[units]??1);if(this.loaded){this.root.remove(this.loaded);disposeTree(this.loaded);}this.loaded=object;this.example.visible=false;this.root.add(object);return true;}
  dispose(){this.restore();disposeTree(this.example);this.root.removeFromParent();mat.clear();}
}
// Small gaze-relative status marker. Independent of the camera parenting in XR.
export function createHUD(scene){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d');const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.29,.0544),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));mesh.renderOrder=1000;mesh.frustumCulled=false;mesh.visible=false;scene.add(mesh);let last='';const q=new THREE.Quaternion(),p=new THREE.Vector3();return {update(visible,rig,pose,label){mesh.visible=visible&&!!pose;if(!mesh.visible)return;q.copy(rig.quaternion).multiply(pose.quaternion);p.set(.0,-.325,-1.0).applyQuaternion(q);mesh.position.copy(pose.position).applyQuaternion(rig.quaternion).add(rig.position).add(p);mesh.quaternion.copy(q);if(last!==label){last=label;ctx.clearRect(0,0,512,96);ctx.fillStyle='#13282be8';ctx.fillRect(0,0,512,96);ctx.fillStyle='#ccefbf';ctx.font='bold 29px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,256,48);texture.needsUpdate=true;}},dispose(){disposeTree(mesh);mesh.removeFromParent();}};}
