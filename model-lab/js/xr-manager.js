export class XRManager {
  constructor(renderer,{beforeStart,onStart,onEnd,onMessage}){Object.assign(this,{renderer,beforeStart,onStart,onEnd,onMessage});this.session=null;this.type='—';this.busy=false;this.supported=false;renderer.xr.enabled=true;renderer.xr.setFramebufferScaleFactor(1);}
  async check(){try{this.supported=!!(navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr'));}catch{this.supported=false;}return this.supported;}
  async toggle(){
    if(this.busy)return;
    if(this.session){try{await this.session.end();}catch(e){this.onMessage(`Could not end VR: ${e.message}`);}return;}
    if(!this.supported){this.onMessage('Immersive VR is unavailable. Use Quest Browser on HTTPS.');return;}
    this.busy=true;let session;
    try{
      // Request immediately from the user's click (transient activation).
      session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['hand-tracking','local-floor']});
      this.session=session;this.beforeStart();
      session.addEventListener('end',()=>{if(this.session!==session)return;this.session=null;this.type='—';this.onEnd();},{once:true});
      try{await session.requestReferenceSpace('local-floor');this.type='local-floor';}
      catch{await session.requestReferenceSpace('local');this.type='local';}
      if(this.session!==session)return;
      this.renderer.xr.setReferenceSpaceType(this.type);
      await this.renderer.xr.setSession(session);
      if(this.session!==session)return;
      this.onStart(this.type);
      const enabled=session.enabledFeatures;
      if(enabled&&!Array.from(enabled).includes('hand-tracking'))this.onMessage('VR active, but hand-tracking was not granted. Enable hand tracking in Quest settings and re-enter VR.');
      else this.onMessage('VR active. Show your hands; put controllers down.');
    }catch(e){if(session){try{await session.end();}catch{if(this.session===session){this.session=null;this.type='—';this.onEnd();}}}this.onMessage(`VR could not start: ${e.message||e.name}`);}
    finally{this.busy=false;}
  }
}
