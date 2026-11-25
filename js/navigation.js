import {XRSettings} from './xr-settings.js';
import {createMenuRenderer} from './atlas-menu-renderer.js';
import {handMotion,bindHandSetting} from './hand-motion.js';
import { GestureEngine } from './gestures.js';
import { readXRHands } from './hand-tracking.js';
import { DesktopHands } from './desktop-hands.js';

export function installHandNavigation(atlas) {
  const byId = id => document.getElementById(id);
  const status = message => { byId('handStatus').textContent = message; };
  const gestures = new GestureEngine();
  const { enter, gl } = atlas;
  const menu=new XRSettings([['handSpeed','Yürüme hızı',' m/s'],['handTurn','Dönüş hızı',' °/s'],['handThreshold','Parmak temas eşiği','']]);
  let drawMenu;
  let loaded = false, supported = false, busy = false, session = null;
  let cameraState = 'off', lastAction = '', walkSpeed = .65, turnSpeed = 30;
  let reference, floorSpace, layer, previousHead, rigYaw, verticalOffset, lastTime;
  let initialHeading, headAngle = 0;

  function buttons() {
    enter.disabled = !loaded || busy;
    enter.textContent = session ? 'Exit VR' : 'Enter VR';
    byId('cameraStart').disabled = !loaded || !!session || ['loading','on'].includes(cameraState);
    byId('cameraStop').disabled = !['loading','on'].includes(cameraState);
  }
  const webcam = new DesktopHands(byId('video'), byId('landmarks'), (state, message) => {
    cameraState = state;
    byId('camBox').hidden = state !== 'on';
    gestures.reset();
    lastAction = '';
    status(message);
    buttons();
  });
  bindHandSetting(byId('handSpeed'),byId('handSpeedVal'),'walk',' m/s',v=>walkSpeed=v);
  bindHandSetting(byId('handTurn'),byId('handTurnVal'),'turn',' °/s',v=>turnSpeed=v);
  bindHandSetting(byId('handThreshold'),byId('handThresholdVal'),'pinch','',v=>{gestures.press=v;gestures.reset();});
  byId('cameraStart').onclick = () => { atlas.beginWalk(); webcam.start(); };
  byId('cameraStop').onclick = () => webcam.stop();

  function walk(speed, dt, angle) {
    if (speed) atlas.move(speed*dt*Math.sin(angle), speed*dt*Math.cos(angle));
  }
  function desktopFrame(time, dt) {
    if (!webcam.active) return;
    const { action, tracked } = gestures.update(webcam.read(time));
    const angle = atlas.getYaw();
    const motion = handMotion(action,walkSpeed,turnSpeed);
    const delta = motion.turn * dt * Math.PI / 180;
    if (delta) atlas.setYaw(angle + delta);
    walk(motion.speed, dt, angle);
    const label = tracked ? ('Hand command · ' + action) : 'Waiting for a hand';
    if (label !== lastAction) { lastAction = label; status(label); }
  }
  function clearTracking() {
    previousHead = null;
    lastTime = null;
    gestures.reset();
  }
  function xrFrame(time, frame) {
    if (frame.session !== session) return;
    session.requestAnimationFrame(xrFrame);
    const pose = frame.getViewerPose(reference);
    const interacting=menu.update(frame,pose,reference);
    if (!pose || session.visibilityState !== 'visible') {
      clearTracking();
      atlas.renderEyes(layer, null, 0, 0);
      return;
    }
    const p = pose.transform.position, q = pose.transform.orientation;
    const fx = -2*(q.x*q.z+q.w*q.y), fz = 2*(q.x*q.x+q.y*q.y)-1;
    if (Math.hypot(fx,fz) > .001) headAngle = Math.atan2(fx,-fz);
    if (rigYaw === null) rigYaw = initialHeading-headAngle;
    if (verticalOffset === null) verticalOffset = floorSpace ? 0 : p.y-1.60;
    const dt = lastTime === null ? 0 : Math.min(.05,Math.max(0,(time-lastTime)/1000));
    lastTime = time;
    if (previousHead && !pose.emulatedPosition) {
      const dx = p.x-previousHead.x, dz = p.z-previousHead.z;
      // Convert physical floor displacement into the original east/north CAD axes.
      if (dx || dz) atlas.move(Math.cos(rigYaw)*dx-Math.sin(rigYaw)*dz,
                                -Math.sin(rigYaw)*dx-Math.cos(rigYaw)*dz);
    }
    previousHead = pose.emulatedPosition ? null : {x:p.x,z:p.z};
    const hands = pose.emulatedPosition ? [] : readXRHands(frame, reference, session);
    const { action } = gestures.update(hands,interacting,menu.pointingHands);
    const motion = handMotion(action,walkSpeed,turnSpeed);
    rigYaw += motion.turn * dt * Math.PI / 180;
    const bearing = rigYaw + headAngle;
    walk(motion.speed,dt,bearing);
    atlas.setYaw(bearing);
    atlas.renderEyes(layer,pose,rigYaw,verticalOffset,drawMenu);
  }
  function finished(ended) {
    if (ended !== session) return;
    session = null;
    menu.reset();
    reference = null;
    layer = null;
    clearTracking();
    atlas.endStereo();
    status('VR ended. The atlas shows your last position.');
    buttons();
  }
  enter.onclick = async () => {
    if (busy) return;
    if (session) { await session.end(); return; }
    if (!supported) {
      byId('handSettings').open = true;
      status('Open the HTTPS page in Meta Quest Browser for immersive VR, or use Start camera here.');
      byId('handStatus').scrollIntoView({block:'nearest'});
      return;
    }
    busy = true;
    buttons();
    let started;
    try {
      started = await navigator.xr.requestSession('immersive-vr',{
        optionalFeatures:['local-floor','hand-tracking']
      });
      session = started;
      started.addEventListener('end', () => finished(started), {once:true});
      started.addEventListener('visibilitychange', clearTracking);
      webcam.stop();
      await gl.makeXRCompatible();
      if (session !== started) return;
      try { reference = await started.requestReferenceSpace('local-floor'); floorSpace = true; }
      catch { reference = await started.requestReferenceSpace('local'); floorSpace = false; }
      if (session !== started) return;
      reference.addEventListener('reset', () => { clearTracking();rigYaw=null;initialHeading=atlas.getYaw();verticalOffset=null; });
      layer = new XRWebGLLayer(started, gl, {alpha:false, antialias:true});
      started.updateRenderState({baseLayer:layer,depthNear:.08,depthFar:390});
      atlas.beginWalk();
      atlas.beginStereo();
      drawMenu??=createMenuRenderer(gl,menu);menu.start(started);
      rigYaw = null; headAngle = 0; verticalOffset = null;initialHeading = atlas.getYaw();
      clearTracking();
      started.requestAnimationFrame(xrFrame);
      status('VR active. Touch thumb and index finger to walk.');
    } catch (error) {
      if (started && session === started) {
        try { await started.end(); } finally { finished(started); }
      }
      byId('handSettings').open = true;
      status('VR could not start · ' + (error.message || error.name));
    } finally { busy = false; buttons(); }
  };
  document.addEventListener('visibilitychange', () => { gestures.reset();lastAction=''; });
  window.addEventListener('pagehide', () => { webcam.stop(); session?.end().catch(()=>{}); });
  return {
    get immersive() { return session !== null; },
    desktopFrame,
    async ready() {
      loaded = true;
      try { supported = !!(await navigator.xr?.isSessionSupported('immersive-vr')); }
      catch { supported = false; }
      status(supported ? 'Quest ready. Choose a scenario and enter VR.' : 'Desktop ready. Start the camera for gesture navigation.');
      buttons();
    }
  };
}
