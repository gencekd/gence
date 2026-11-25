import {Matrix4,Vector3,Quaternion} from '../vendor/three.module.min.js';

const width=800, height=540;
const dimensions={button:[.17,.09],panel:[.85,.574]};
const point=new Vector3(), rotation=new Quaternion(), offset=new Vector3(), scale=new Vector3();
const localRay=new Matrix4();

// Coordinates stay in XR reference space. Both renderers draw the same panel in stereo.
export class XRSettings {
  constructor(fields) {
    this.fields=fields.map(([id,label,unit])=>({input:document.getElementById(id),label,unit}));
    this.canvas=document.createElement('canvas');
    this.canvas.width=width;this.canvas.height=height;
    this.ctx=this.canvas.getContext('2d');this.version=0;
    this.matrix=new Matrix4();this.inverse=new Matrix4();this.anchor=new Quaternion();this.pointingHands=new Set();
    this.select=e=>{
      if(!this.visible||!this.space||e.frame.session.visibilityState!=='visible')return;
      const pose=e.frame.getPose(e.inputSource.targetRaySpace,this.space);
      const id=pose&&this.hit(pose.transform.matrix);
      if(id)this.activate(id);
    };
    this.reset();
  }
  reset(){
    this.session?.removeEventListener('selectstart',this.select);
    this.pointingHands.clear();this.session=null;this.space=null;this.open=false;this.visible=false;
    this.anchored=false;this.hover=null;this.buttons=[];this.cooldown=0;this.gazeId=null;this.gazeFired=false;this.paint();
  }
  start(session){this.reset();this.session=session;session.addEventListener('selectstart',this.select);}
  activate(id){
    if(id==='menu'||id==='close'){this.open=id==='menu';this.anchored=false;}
    else {
      const [row,sign]=id.split('/');const input=this.fields[Number(row)].input;
      if(sign==='+')input.stepUp();else input.stepDown();
      input.dispatchEvent(new Event('input',{bubbles:true}));
    }
    this.cooldown=performance.now()+450;this.hover=null;this.paint();
  }
  paint(){
    const ctx=this.ctx;this.buttons=[];
    ctx.clearRect(0,0,width,height);ctx.textAlign='center';ctx.textBaseline='middle';
    const rect=(x,y,w,h,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();};
    const label=(s,x,y,size,color='#f9f7ec')=>{ctx.fillStyle=color;ctx.font='600 '+size+'px sans-serif';ctx.fillText(s,x,y);};
    const button=(id,x,y,w,h,caption,size)=>{
      this.buttons.push({id,x,y,w,h});
      rect(x,y,w,h,24,this.hover===id?'#d6ab74':'#37534d');
      label(caption,x+w/2,y+h/2,size,this.hover===id?'#162822':'#ffffff');
    };
    if(!this.open){
      button('menu',0,0,width,height,'',1);
      ctx.fillStyle='#fff';
      for(const x of [225,400,575]){ctx.beginPath();ctx.ellipse(x,270,40,50,0,0,Math.PI*2);ctx.fill();}
    }else{
      rect(0,0,width,height,27,'#132722');
      ctx.textAlign='left';label('VR ayarları',38,53,43);ctx.textAlign='center';
      button('close',620,20,146,68,'Kapat',27);
      this.fields.forEach(({input,label:name,unit},i)=>{
        const y=112+134*i;
        ctx.textAlign='left';label(name,38,y+32,29);label(input.value+unit,38,y+79,30,'#dfc097');ctx.textAlign='center';
        button(i+'/-',500,y,110,100,'−',48);button(i+'/+',641,y,110,100,'+',48);
      });
    }
    this.version++;
  }
  hit(rayMatrix){
    localRay.fromArray(rayMatrix).premultiply(this.inverse);const a=localRay.elements;
    if(a[10]<=.0001)return null;
    const t=a[14]/a[10];if(t<0)return null;
    const x=(a[12]-a[8]*t+.5)*width,y=(.5-a[13]+a[9]*t)*height;
    return this.buttons.find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h)?.id||null;
  }
  update(frame,viewer,space){
    this.pointingHands.clear();
    this.visible=!!viewer&&frame?.session.visibilityState==='visible';
    if(!this.visible){this.gazeId=null;this.gazeFired=false;return false;}
    this.space=space;
    const t=viewer.transform;rotation.copy(t.orientation);
    // Keep targets stable for gaze selection, and bring them back after a large head turn.
    if(!this.anchored||rotation.angleTo(this.anchor)>.68){this.anchor.copy(rotation);this.anchored=true;}
    const [w,h]=this.open?dimensions.panel:dimensions.button;
    offset.set(0,this.open?-.04:-.22,this.open?-1.25:-.95).applyQuaternion(this.anchor);
    point.copy(t.position).add(offset);scale.set(w,h,1);
    this.matrix.compose(point,this.anchor,scale);this.inverse.copy(this.matrix).invert();
    let hover=null;
    for(const source of frame.session.inputSources){
      const ray=frame.getPose(source.targetRaySpace,space);
      const target=ray&&this.hit(ray.transform.matrix);
      if(target){
        hover=target;
        if(source.hand && target==='menu')this.pointingHands.add(source.handedness);
      }
    }
    const gaze=this.hit(t.matrix),now=performance.now();
    if(hover||gaze!==this.gazeId){this.gazeId=hover?null:gaze;this.gazeStart=now;this.gazeFired=false;}
    if(!hover&&gaze&&!this.gazeFired&&now-this.gazeStart>=1200&&now>this.cooldown){
      this.activate(gaze);this.gazeFired=true;
    }
    const target=hover||gaze;
    if(this.hover!==target){this.hover=target;this.paint();}
    return this.open||now<this.cooldown;
  }
}
