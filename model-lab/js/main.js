import {bindHandSetting} from '../../js/hand-motion.js';
import {XRSettings} from '../../js/xr-settings.js';
import * as THREE from 'three';
import {XRManager} from './xr-manager.js';
import {readXRHands} from '../../js/hand-tracking.js';
import {GestureEngine,ACTIONS} from '../../js/gestures.js';
import {Locomotion,EYE_HEIGHT} from './locomotion.js';
import {DesktopHands} from '../../js/desktop-hands.js';
import {Architecture,createHUD} from './scene.js';
const $=id=>document.getElementById(id);
const message=t=>{$('notice').textContent=t;};
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});}catch(e){message(`WebGL unavailable: ${e.message}`);throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
$('viewport').appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0xdce6e4);scene.fog=new THREE.Fog(0xdce6e4,65,145);
scene.add(new THREE.HemisphereLight(0xf5fafc,0x85847a,2.1));const light=new THREE.DirectionalLight(0xfff0dc,2.0);light.position.set(-5,9,4);scene.add(light);
const rig=new THREE.Group();rig.name='Unscaled locomotion rig';scene.add(rig);
const camera=new THREE.PerspectiveCamera(70,1,.04,100);rig.add(camera);
const locomotion=new Locomotion(rig),gestures=new GestureEngine(),architecture=new Architecture(scene),hud=createHUD(scene);
architecture.example.visible=false;
const localPosition=new THREE.Vector3(),localQuaternion=new THREE.Quaternion();const pose={position:localPosition,quaternion:localQuaternion};
const settings=new XRSettings([['speed','Yürüme hızı',' m/s'],['turn','Dönüş hızı',' °/s'],['threshold','Parmak temas eşiği','']]);
const texture=new THREE.CanvasTexture(settings.canvas);texture.colorSpace=THREE.SRGBColorSpace;
texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;
const panel=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));
panel.matrixAutoUpdate=false;panel.frustumCulled=false;panel.renderOrder=1100;panel.visible=false;rig.add(panel);
let panelVersion=-1,buildingReady=false;
let yaw=0,pitch=0,localCalibrated=false,sessionStarted=0,hadHands=false,lastTime=null,fps=0,lastDebug=0,disposed=false;
let cameraStatus='off';
function setDesktopPose(){camera.position.set(0,EYE_HEIGHT,0);camera.rotation.set(pitch,yaw,0,'YXZ');camera.updateMatrixWorld(true);}
function resetDesktopLook(){yaw=0;pitch=0;setDesktopPose();}
resetDesktopLook();
function updateButtons(){const vr=!!xr.session;$('vr').disabled=xr.busy||(!vr&&(!xr.supported||!buildingReady));$('vr').textContent=vr?'Exit VR':'Enter VR';$('start').disabled=vr||cameraStatus==='loading'||cameraStatus==='on';$('stop').disabled=vr||!['loading','on'].includes(cameraStatus);$('reset').disabled=vr;$('load-model').disabled=vr;$('restore-model').disabled=vr;$('model-file').disabled=vr;$('units').disabled=vr;$('view-mode').textContent=vr?'IMMERSIVE VR':'DESKTOP';}
const desktop=new DesktopHands($('video'),$('landmarks'),(status,text)=>{cameraStatus=status;$('camera-state').textContent=status.toUpperCase();$('preview-placeholder').hidden=status==='on'||status==='loading';if(status!=='on')gestures.reset();message(text);updateButtons();});
const xr=new XRManager(renderer,{
 beforeStart(){++architecture.serial;desktop.stop();gestures.reset();lastTime=null;updateButtons();},
 onStart(type){settings.start(xr.session);locomotion.reset();camera.position.set(0,0,0);camera.rotation.set(0,0,0);localCalibrated=type==='local-floor';sessionStarted=performance.now();hadHands=false;lastTime=null;updateButtons();},
 onEnd(){settings.reset();panel.visible=false;gestures.reset();locomotion.reset();resetDesktopLook();lastTime=null;hud.update(false,rig,null,'');queueMicrotask(resize);message('VR ended. Desktop ready; Start Camera to resume webcam.');updateButtons();},
 onMessage:message
});
function resize(){if(renderer.xr.isPresenting||disposed)return;const w=$('viewport').clientWidth,h=$('viewport').clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
const observer=new ResizeObserver(resize);observer.observe($('viewport'));resize();
$('vr').onclick=async()=>{const pending=xr.toggle();updateButtons();await pending;updateButtons();};
$('start').onclick=()=>{if(!xr.session)desktop.start();};$('stop').onclick=()=>desktop.stop();$('reset').onclick=()=>{locomotion.reset();resetDesktopLook();gestures.reset();message('Position reset.');};
bindHandSetting($('speed'),$('speed-val'),'walk',' m/s',v=>locomotion.walkSpeed=v);
bindHandSetting($('turn'),$('turn-val'),'turn',' °/s',v=>locomotion.turnSpeed=v);
bindHandSetting($('threshold'),$('threshold-val'),'pinch','',v=>{gestures.press=v;gestures.reset();});
async function loadModel(url){if(xr.session||!url)return;message('Loading architectural model…');try{const loaded=await architecture.load(url,$('units').value);if(loaded){locomotion.spawn.set(0,0,5.5);locomotion.heading=0;buildingReady=true;updateButtons();locomotion.reset();resetDesktopLook();message('Model loaded. Verify floor Y=0 and selected source units.');}}catch(e){message(`Model could not load: ${e.message||e}`);}}
$('load-model').onclick=()=>loadModel($('model-url').value.trim());$('model-file').onchange=async()=>{const file=$('model-file').files[0];if(!file)return;const url=URL.createObjectURL(file);try{await loadModel(url);}finally{URL.revokeObjectURL(url);$('model-file').value='';}};
async function openPalace(){
 buildingReady=false;updateButtons();message('Topkapı modeli yükleniyor…');
 try {
   if(await architecture.load(new URL('../assets/models/topkapi.glb',import.meta.url).href,'full')){
     locomotion.spawn.set(-.7,0,2.6);locomotion.heading=-1.1;buildingReady=true;locomotion.reset();resetDesktopLook();message(xr.supported?'Topkapı hazır. Enter VR ile içeri gir.':'Topkapı hazır. Sürükleyerek etrafına bakabilir veya Quest Browser ile VR’a girebilirsin.');
   }
 } catch(e){message('Model yüklenemedi. Tekrar açmayı dene. '+e.message);}
 updateButtons();
}
$('restore-model').onclick=openPalace;
let drag=null;const canvas=renderer.domElement;
canvas.addEventListener('pointerdown',e=>{if(xr.session)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId||xr.session)return;yaw-=(e.clientX-drag.x)*.004;pitch=THREE.MathUtils.clamp(pitch-(e.clientY-drag.y)*.004,-1.4,1.4);drag.x=e.clientX;drag.y=e.clientY;setDesktopPose();});
for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,()=>drag=null);
function updateDebug(now,command,motion,tracked,eye,ref){if(now-lastDebug<125)return;lastDebug=now;$('d-xr').textContent=xr.session?(renderer.xr.isPresenting?'Immersive VR':'Starting'):'Desktop';$('d-ref').textContent=ref;$('d-track').textContent=tracked;$('d-hand').textContent=command.hand;$('d-pinch').textContent=command.action;$('d-speed').textContent=`${motion.speed.toFixed(2)} m/s`;$('d-turn').textContent=`${Math.abs(motion.turn)} °/s${motion.turn>0?' R':motion.turn<0?' L':''}`;$('d-eye').textContent=Number.isFinite(eye)?`${eye.toFixed(2)} m`:'—';$('d-fps').textContent=fps?fps.toFixed(0):'—';}
renderer.setAnimationLoop((time,frame)=>{
 if(disposed)return;const now=performance.now();const raw=lastTime===null?0:(time-lastTime)/1000;lastTime=time;const dt=raw>0?Math.min(raw,.05):0;if(raw>0&&raw<1)fps=fps?fps*.9+.1/raw:1/raw;
 const immersive=renderer.xr.isPresenting;let interacting=false;panel.visible=false;let hands=[],head=null,ref='Desktop',tracking='Camera off',eye=EYE_HEIGHT;
 if(immersive&&frame){
   const space=renderer.xr.getReferenceSpace(),session=xr.session;ref=xr.type;
   const viewer=space?frame.getViewerPose(space):null;
   interacting=settings.update(frame,viewer,space);
   panel.visible=settings.visible;
   if(panel.visible){
     panel.matrix.copy(settings.matrix);panel.matrixWorldNeedsUpdate=true;
     if(panelVersion!==settings.version){texture.needsUpdate=true;panelVersion=settings.version;}
   }
   if(viewer){const t=viewer.transform;localPosition.set(t.position.x,t.position.y,t.position.z);localQuaternion.set(t.orientation.x,t.orientation.y,t.orientation.z,t.orientation.w);head=pose;
     // Local has no known floor; establish a single offset, never clamp future head height.
     if(!localCalibrated){rig.position.y=EYE_HEIGHT-localPosition.y;localCalibrated=true;}
     eye=rig.position.y+localPosition.y;
     if(session?.visibilityState==='visible'&&!viewer.emulatedPosition)hands=readXRHands(frame,space,session);
   }else eye=NaN;
   if(hands.length){if(!hadHands)message('Native XR hand tracking active.');hadHands=true;}else if(hadHands){message('Hands lost. Movement stopped.');hadHands=false;sessionStarted=now;}else if(now-sessionStarted>3500){tracking='No hands / unavailable';}
   tracking=hands.length?`Native XR · ${hands.length}`:tracking==='No hands / unavailable'?tracking:'Waiting for hands';
 }else if(!xr.session){setDesktopPose();localPosition.copy(camera.position);localQuaternion.copy(camera.quaternion);head=pose;hands=desktop.read(now);tracking=desktop.active?`MediaPipe · ${hands.length}`:cameraStatus;}
 const visible=immersive?xr.session?.visibilityState==='visible':!document.hidden;
 if(!visible||!head){hands=[];gestures.reset();}
 const command=gestures.update(hands,interacting,immersive?settings.pointingHands:null);const motion=locomotion.step(command.action,dt,head);
 rig.updateMatrixWorld(true);
 const hudLabel=command.action===ACTIONS.CONFLICT?'CONFLICT / STOP':command.action===ACTIONS.WALK?'WALK':command.action===ACTIONS.RIGHT?'TURN RIGHT':command.action===ACTIONS.LEFT?'TURN LEFT':hands.length?'READY / STOP':tracking==='No hands / unavailable'?'ENABLE HAND TRACKING':'NO HANDS / STOP';
 hud.update(immersive&&!settings.open,rig,head,hudLabel);updateDebug(now,command,motion,tracking,eye,ref);
 renderer.render(scene,camera);
});
document.addEventListener('visibilitychange',()=>{gestures.reset();lastTime=null;});
window.addEventListener('pagehide',e=>{desktop.stop();gestures.reset();if(xr.session)xr.session.end().catch(()=>{});if(!e.persisted){disposed=true;renderer.setAnimationLoop(null);observer.disconnect();architecture.dispose();hud.dispose();renderer.dispose();}});
window.addEventListener('pageshow',e=>{if(e.persisted){lastTime=null;resize();updateButtons();}});
xr.check().then(updateButtons);
openPalace();
