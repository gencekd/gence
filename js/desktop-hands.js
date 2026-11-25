const BASE='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';
const MODEL='https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const INDICES={thumb:4,index:8,ring:16,pinky:20,wrist:0,middleBase:9,indexBase:5,pinkyBase:17};
export class DesktopHands {
  constructor(video,canvas,onStatus){Object.assign(this,{video,canvas,onStatus});this.ctx=canvas.getContext('2d');this.stream=null;this.detector=null;this.active=false;this.pending=false;this.token=0;this.lastVideo=-1;this.lastFrame=-Infinity;this.hands=[];}
  async start(){
    if(this.active||this.pending)return;const token=++this.token;this.pending=true;this.onStatus('loading','Requesting camera permission…');
    let stream,detector;
    try{
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera requires HTTPS or localhost and a supported browser.');
      stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});
      if(token!==this.token){stream.getTracks().forEach(t=>t.stop());return;}
      this.stream=stream;this.video.srcObject=stream;await this.video.play();
      if(token!==this.token)return;
      this.onStatus('loading','Loading MediaPipe model and WASM…');
      const {FilesetResolver,HandLandmarker,DrawingUtils}=await import(`${BASE}/vision_bundle.mjs`);
      if(token!==this.token)return;
      const vision=await FilesetResolver.forVisionTasks(`${BASE}/wasm`);
      const options={baseOptions:{modelAssetPath:MODEL,delegate:'GPU'},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.55,minHandPresenceConfidence:.55,minTrackingConfidence:.55};
      try{detector=await HandLandmarker.createFromOptions(vision,options);}catch{options.baseOptions.delegate='CPU';detector=await HandLandmarker.createFromOptions(vision,options);}
      if(token!==this.token){detector.close();return;}
      this.detector=detector;this.DrawingUtils=DrawingUtils;this.connections=HandLandmarker.HAND_CONNECTIONS;
      this.active=true;this.lastVideo=-1;this.lastFrame=-Infinity;
      for(const track of stream.getVideoTracks())track.addEventListener('ended',()=>{if(token===this.token){this.stop();this.onStatus('error','Camera disconnected. Start Camera to reconnect.');}},{once:true});
      this.onStatus('on','Camera ready. Show either hand.');
    }catch(e){if(token===this.token){this.stop();this.onStatus('error',`Camera/MediaPipe: ${e.name==='NotAllowedError'?'permission denied. Allow camera access in browser settings.':e.message}`);}else{stream?.getTracks().forEach(t=>t.stop());detector?.close();}}
    finally{if(token===this.token)this.pending=false;}
  }
  stop(){++this.token;this.active=false;this.pending=false;this.hands=[];this.lastFrame=-Infinity;this.lastVideo=-1;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;this.video.pause();this.video.srcObject=null;this.detector?.close();this.detector=null;this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);this.onStatus('off','Camera stopped.');}
  read(now){
    if(!this.active||document.hidden||this.video.readyState<2)return [];
    // Use only new video frames; invalidate cached poses if the stream freezes.
    if(this.video.currentTime!==this.lastVideo&&now-this.lastFrame>=1000/30){
      this.lastVideo=this.video.currentTime;
      try{
        const result=this.detector.detectForVideo(this.video,now);this.lastFrame=performance.now();
        const seen=new Set();this.hands=(result.worldLandmarks||[]).map((landmarks,i)=>{
          let id=(result.handedness?.[i]?.[0]?.categoryName||result.handednesses?.[i]?.[0]?.categoryName||`hand-${i+1}`).toLowerCase();if(seen.has(id))id=`${id}-${i+1}`;seen.add(id);
          return {id,joints:Object.fromEntries(Object.entries(INDICES).map(([k,n])=>[k,landmarks[n]]))};
        });
        if(this.canvas.width!==this.video.videoWidth||this.canvas.height!==this.video.videoHeight){this.canvas.width=this.video.videoWidth;this.canvas.height=this.video.videoHeight;}
        this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);const draw=new this.DrawingUtils(this.ctx);
        for(const landmarks of result.landmarks||[]){draw.drawConnectors(landmarks,this.connections,{color:'#80efb1',lineWidth:2});draw.drawLandmarks(landmarks,{color:'#fff2bd',radius:3,lineWidth:1});}
      }catch(e){this.stop();this.onStatus('error',`Hand tracking stopped: ${e.message}`);return [];}
    }
    return performance.now()-this.lastFrame>180?[]:this.hands;
  }
}
