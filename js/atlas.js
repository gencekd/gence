import { installHandNavigation } from './navigation.js';

'use strict';
const $=id=>document.getElementById(id), cv=$('glc'),ov=$('overlay'),ctx=ov.getContext('2d'),gl=cv.getContext('webgl2',{antialias:true,alpha:false,xrCompatible:!!navigator.xr}),G={}, palette={TERRAIN_TERRAIN_MESH:'#ebe6d6',WATERWAYS_HATCH:'#95bcb9',VEGETATION_GREEN_SPACES_HATCH:'#bdc9ab',ROADS_HATCH:'#faf7ed',BUILDINGS:'#d2c7b4',TREE0:'#7d7964',TREE1:'#a8b791',ROADS_CONTOURS:'#aaa89a',ROADS_AXES:'#d5cbb5',RAILWAYS_AXES:'#8d7d77',WATERWAYS_OUTLINE:'#6e9897',WATERWAYS:'#6e9897',VEGETATION_GREEN_SPACES:'#9caa8e',FRAME_PROJECT:'#82988f',PLAN_BUILDINGS:'#777c70',PLAN_CONTOUR_LINES_1M:'#bb895c'};
const terrain='TERRAIN_TERRAIN_MESH',water='WATERWAYS_HATCH',years=['Today','2030','2040','2060','2100','2150','2200','2300','2500'],rise=[0,.02,.08,.23,.65,1.15,1.65,2.65,4.65],modes=['Plan','Section','Elevation','Walk'];
let camera='third',speed=6,downAt=null,jumpTime=-1,jumpHeight=0;
let spill;
let floodLevel=NaN;
let yi=0,mode='Plan',cutY=1000,x=1450,y=1000,yaw=.4,pitch=0,W,H,px=1520,py=980,span=3250,waterZ=0,ready=false,drag=null,last=0,sect=[],keys=new Set(),dirty=true;
const clamp=(a,b,c)=>Math.min(c,Math.max(a,b)),rgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255);
function compile(kind,src){let s=gl.createShader(kind);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
const vs=`#version 300 es
layout(location=0) in vec3 pos; uniform mat4 xrProjection, xrView;
uniform vec3 xrOffset;
uniform float xrMode;
uniform vec3 eye,R,U,F,actor; uniform vec2 heading;uniform float avatar;uniform float ratio,wide,walk,waterPass,bias,stage;out vec3 xyz;
void main(){xyz=pos;vec3 q=pos;if(avatar>.5){q=actor+vec3(pos.x*heading.x+pos.y*heading.y,-pos.x*heading.y+pos.y*heading.x,pos.z);xyz=q;}if(waterPass>0.5)q.z=stage;vec3 d=q-eye;float z=dot(d,F);
if(xrMode>.5){
 vec3 track=vec3(dot(d.xy,vec2(heading.x,-heading.y)),d.z,-dot(d.xy,heading.yx))+xrOffset;
 gl_Position=xrProjection*xrView*vec4(track,1.);
}else if(walk>0.5){float n=.07,f=6000.;gl_Position=vec4(dot(d,R)*1.35/ratio,dot(d,U)*1.35,z*(f+n)/(f-n)-2.*f*n/(f-n),z);}
else gl_Position=vec4(dot(d,R)*2./wide,dot(d,U)*2.*ratio/wide,z/5000.,1.);
gl_Position.z-=bias*gl_Position.w;}`;
const fs=`#version 300 es
precision highp float;in vec3 xyz;uniform vec3 color;uniform float waterPass,stage,shade;out vec4 result;
void main(){if(waterPass>.5 && xyz.z>stage)discard;vec3 c=color;if(waterPass>.5)c=color;else if(shade>.5){vec3 n=normalize(cross(dFdx(xyz),dFdy(xyz)));c*=.77+.23*abs(dot(n,normalize(vec3(.4,-.3,.87))));}result=vec4(c,1.);}`;
let prog,un={};function initGL(){if(!gl)throw Error('WebGL 2 is required. Open the downloaded HTML in Chrome, Edge or Safari with graphics acceleration enabled.');prog=gl.createProgram();for(const [k,s] of [[gl.VERTEX_SHADER,vs],[gl.FRAGMENT_SHADER,fs]])gl.attachShader(prog,compile(k,s));gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(prog));gl.useProgram(prog);for(const k of ['xrMode','xrProjection','xrView','xrOffset','actor','heading','avatar','eye','R','U','F','ratio','wide','walk','waterPass','bias','stage','shade','color'])un[k]=gl.getUniformLocation(prog,k);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL)}
async function decode(s,T){let bytes=Uint8Array.from(atob(s),c=>c.charCodeAt(0));return new T(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())}
async function load(){initGL();const [geometry, threshold] = await Promise.all([fetch('./assets/lagoon.json'), fetch('./assets/spill.f32')]);
 if (!geometry.ok || !threshold.ok) throw Error('Atlas data could not load. Check the assets folder.');
 const data = await geometry.json();
 spill = new Float32Array(await threshold.arrayBuffer());for(const [key,[p,f,t]] of Object.entries(data)){const v=await decode(p,Float32Array),i=await decode(f,Uint32Array),vao=gl.createVertexArray();gl.bindVertexArray(vao);for(const [target,a] of [[gl.ARRAY_BUFFER,v],[gl.ELEMENT_ARRAY_BUFFER,i]]){gl.bindBuffer(target,gl.createBuffer());gl.bufferData(target,a,gl.STATIC_DRAW)}gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);G[key]={v,i,vao,tri:t==='tri'};}
 setupWalkMeshes();for(const k of [terrain,'BUILDINGS'])indexSurface(G[k]);let roads=G.ROADS_AXES.v,best=Infinity;for(let j=0;j<roads.length;j+=3){let a=roads[j],b=roads[j+1],dist=Math.hypot(a-1800,b-960);if(dist<best&&!blocked(a,b)){best=dist;x=a;y=b}}cutY=y;$('cut').value=cutY;ready=true;$('progress').hidden=true;fitView();setMode('Plan');navigation.ready();requestAnimationFrame(frame)}
function newMesh(k,vertices,indices,color){let vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,0,0);let eb=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,eb);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.DYNAMIC_DRAW);G[k]={v:vertices,i:indices,vao,eb,tri:true};palette[k]=color}
function setupWalkMeshes(){
 const t=G[terrain];newMesh('Flood',t.v,new Uint32Array(0),palette[water]);
 // Elliptical rings define a 1.70 m figure in local body coordinates.
 function part(k,rings,color){let v=[],idx=[],N=12;for(const [cx,cy,z,rx,ry] of rings)for(let j=0;j<N;j++){let a=j*2*Math.PI/N;v.push(cx+Math.cos(a)*rx,cy+Math.sin(a)*ry,z)}
 for(let j=0;j<rings.length-1;j++)for(let s=0;s<N;s++){let a=j*N+s,b=j*N+(s+1)%N;idx.push(a,b,a+N,b,b+N,a+N)}newMesh(k,new Float32Array(v),new Uint32Array(idx),color)}
 part('Torso',[[0,0,.81,.13,.10],[0,0,.95,.17,.12],[0,0,1.32,.215,.13],[0,0,1.43,.10,.09],[0,0,1.44,.04,.04]],'#b55b3c');
 part('Head',[[0,0,1.42,.06,.06],[0,.012,1.49,.091,.092],[0,0,1.61,.098,.098],[0,0,1.68,.07,.076],[0,0,1.70,.005,.005]],'#b88c69');
 for(const s of [-1,1]){part('Leg'+s,[[s*.095,.047,0,.065,.11],[s*.095,.005,.09,.056,.066],[s*.09,0,.43,.074,.079],[s*.083,0,.86,.089,.102]],'#38494c');part('Arm'+s,[[s*.218,.015,.88,.034,.042],[s*.228,.016,1.05,.049,.054],[s*.205,0,1.32,.060,.07],[s*.172,0,1.36,.035,.049]],'#aa553a')}
}
function updateFlood(){if(floodLevel===waterZ)return;floodLevel=waterZ;let t=G[terrain],f=G.Flood,list=[];for(let k=0;k<spill.length;k++)if(spill[k]<=waterZ)list.push(t.i[k*3],t.i[k*3+1],t.i[k*3+2]);f.i=new Uint32Array(list);gl.bindVertexArray(f.vao);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,f.eb);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,f.i,gl.DYNAMIC_DRAW)}
function chaseEye(f){let z=ground()+jumpHeight+1.13,dist=0;for(let d=.12;d<=3.8;d+=.12){let a=x-f[0]*d,b=y-f[1]*d,h=z-f[2]*d;if(h<ground(a,b)+.2||height(G.BUILDINGS,a,b)>h-.15)break;dist=d}return [x-f[0]*dist,y-f[1]*dist,z-f[2]*dist]}
function indexSurface(g){g.grid=new Map();for(let n=0;n<g.i.length;n+=3){let [a,b,c]=[g.i[n]*3,g.i[n+1]*3,g.i[n+2]*3],v=g.v,den=(v[b+1]-v[c+1])*(v[a]-v[c])+(v[c]-v[b])*(v[a+1]-v[c+1]);if(Math.abs(den)<1e-6)continue;let xs=[v[a],v[b],v[c]],ys=[v[a+1],v[b+1],v[c+1]];for(let u=Math.floor(Math.min(...xs)/25);u<=Math.floor(Math.max(...xs)/25);u++)for(let w=Math.floor(Math.min(...ys)/25);w<=Math.floor(Math.max(...ys)/25);w++){let key=u+','+w;if(!g.grid.has(key))g.grid.set(key,[]);g.grid.get(key).push(n)}}}
function height(g,a,b,wetOnly=false){let h=-Infinity,v=g.v;for(const n of g.grid.get(Math.floor(a/25)+','+Math.floor(b/25))||[]){if(wetOnly&&spill[n/3]>waterZ)continue;let i=g.i[n]*3,j=g.i[n+1]*3,k=g.i[n+2]*3,A=v[i]-v[k],B=v[j]-v[k],C=v[i+1]-v[k+1],D=v[j+1]-v[k+1],X=a-v[k],Y=b-v[k+1],det=A*D-B*C,u=(D*X-B*Y)/det,w=(A*Y-C*X)/det;if(u>=-.00001&&w>=-.00001&&u+w<=1.00001)h=Math.max(h,u*v[i+2]+w*v[j+2]+(1-u-w)*v[k+2])}return h}
function ground(a=x,b=y){let h=height(G[terrain],a,b);return Number.isFinite(h)?h:0}
function blocked(a,b){return height(G.BUILDINGS,a,b)>ground(a,b)+.35}
const exposure=[[[0.64, 0.056], [41.5, 8.276], [162.63, 35.856]], [[1.01, 0.065], [44.11, 8.817], [170.9, 37.757]], [[3.04, 0.297], [54.67, 10.618], [212.96, 43.835]], [[13.55, 2.327], [80.42, 17.207], [254.53, 55.813]], [[65.23, 12.924], [233.09, 49.892], [347.74, 82.993]], [[233.09, 49.892], [347.74, 82.993], [451.86, 106.271]], [[347.74, 82.993], [451.86, 106.271], [570.04, 128.543]], [[570.04, 128.543], [587.99, 131.664], [590.38, 131.872]], [[590.44, 131.88], [590.44, 131.88], [590.44, 131.88]]];
let metric=0;
const topicNotes=["A typical tidal range of roughly 0.6\u20131 m is the difference between low and high water. As the water rises, exposed edges narrow and the step between a quay and a boat changes. Follow a route from a ground-floor entrance to a vaporetto stop, checking both the street\u2019s lowest point and the boarding level.", "When an astronomical high tide coincides with wind-driven surge and low atmospheric pressure, water can reach streets that usually stay dry. At a submerged outlet, drainage can slow or reverse. Compare the reference and storm tests for one year to see how far exposure extends inland.", "A higher starting sea level leaves less clearance below the same doorway. More frequent wetting can carry salts into lower masonry and expose foundation edges. Use the section to identify entrances for detailed surveys of sill height, accessible approaches and service connections.", "When land sinks, the waterline rises relative to streets and buildings even if the sea stays at the same height. Subsidence and sea-level rise together reduce ground clearance over decades. Compare the same section and tidal condition between Today and 2100 to isolate the effect of the atlas\u2019s relative-rise scenario.", "Greater water depth reduces the light reaching submerged plants. Temperature and salinity also influence which species can survive. Tides alternately uncover and cover mudflats, changing when birds can reach food. Over longer periods, currents transport sediment and change the height and shape of these habitats.", "A boat stop may remain usable while its approach floods. Trace the whole journey in plan, then move A\u2013A\u2032 across the lowest approach. Record where a dry alternative, a raised landing or a protected drainage outlet would need closer investigation."];
const impacts=[
 ['Tidal cycle','Water rises and falls','Quay-to-boat step changes','Boarding access varies'],
 ['Acqua alta','High tide coincides with storm surge','Water reaches low drainage outlets','Street drainage can slow'],
 ['Sea-level rise','Higher starting sea level','Less clearance at door sills','Ground floors flood more often'],
 ['Subsidence','Land settles over decades','Street elevation falls relative to water','The same tide reaches farther inland'],
 ['Lagoon habitats','Tidal flats spend longer submerged','Light and exposed feeding area change','Plants and feeding birds respond'],
 ['Public transport','Water reaches a low street segment','Dry approach to the stop is interrupted','Passengers may need another route']
];
function chooseTopic(i){
 for(let k=0;k<impacts.length;k++)$('topics').children[k].setAttribute('aria-pressed',k===i);
 $('impact').innerHTML=impacts[i].slice(1).map((v,k)=>(k?'<span aria-hidden="true">→</span>':'')+'<div><small>'+['Driver','Local change','Effect'][k]+'</small><b>'+v+'</b></div>').join('');
 $('impactNote').textContent=topicNotes[i];
}
impacts.forEach((v,i)=>{let b=document.createElement('button');b.textContent=v[0];b.onclick=()=>chooseTopic(i);$('topics').append(b)});chooseTopic(0);
years.forEach((name,k)=>{let b=document.createElement('button');b.className='chartRow';b.onclick=()=>{yi=k;update()};$('bars').append(b)});
for(let m=0;m<2;m++)$('metric'+m).onclick=()=>{metric=m;showAnalysis()};
$('chartTide').onchange=e=>{$('tide').value=e.target.value==='0.5'?'.5':e.target.value;update()};
function bars(j){$('chartTide').value=String(j/2);
 for(let m=0;m<2;m++)$('metric'+m).setAttribute('aria-pressed',m===metric);
 exposure.forEach((row,k)=>{let b=$('bars').children[k],v=row[j][metric],unit=metric?'km':'ha';
 b.setAttribute('aria-pressed',yi===k);b.innerHTML='<span>'+years[k]+'</span><span class="track"><span class="ink" style="width:'+100*v/(metric?Math.ceil(exposure.at(-1)[2][1]/10)*10:Math.ceil(exposure.at(-1)[2][0]/50)*50)+'%"></span></span><strong>'+v.toFixed(2)+' '+unit+'</strong>'})
}
let profileCache='';
function drawProfile(){
 if(!ready)return;let z=ground(),level=rise[yi]+Number($('tide').value),connected=Number.isFinite(height(G[terrain],x,y,true)),diff=level-z;
 let key=[z.toFixed(3),level,connected].join('/');if(profileCache===key)return;profileCache=key;
 let lo=Math.min(z-.3,level-.2),hi=Math.max(z+1.95,level+.35),scale=145/(hi-lo),Y=v=>165-(v-lo)*scale,g=Y(z),w=Y(level),head=Y(z+1.7),r=.09*scale;
 $('profileArt').innerHTML='<rect x="0" y="'+g+'" width="400" height="'+(194-g)+'" fill="#c6baa1"/><path d="M0 '+g+'H400" stroke="#7d765d"/><g transform="translate(110 '+g+') scale('+scale+')"><g fill="none" stroke="#705244" stroke-linecap="round" stroke-width=".10"><path d="M-.14 -.05L0 -.81L.14 -.05 M0 -.81V-1.4 M-.18 -.93L0 -1.35L.18 -.93"/></g><circle cy="-1.59" r=".11" fill="#705244"/></g>'+(diff>0&&connected?'<rect y="'+w+'" width="400" height="'+(g-w)+'" fill="#71aaa6" opacity=".48"/>':'')+'<path d="M0 '+w+'H400" stroke="#267975" stroke-width="2" stroke-dasharray="6 4"/><text x="12" y="186">Local ground · Z '+z.toFixed(2)+' m</text><text x="222" y="'+(w-5)+'">Test water · Z '+level.toFixed(2)+' m</text><text x="128" y="'+(head+10)+'">1.70 m</text>';
 $('profileNote').textContent=(diff>0?(connected?'Connected water depth at this point: '+diff.toFixed(2)+' m.':'The ground is below the test level but isolated from connected water.'):'The observer stands '+(-diff).toFixed(2)+' m above the test level.')+' Choose a new point on the plan to compare.';
}
function showAnalysis(){const condition=Number($('tide').value),j=condition*2,fmt=n=>n.toFixed(2),current=exposure[yi][j];bars(j);
$('caseTitle').textContent=years[yi]+' · '+['Reference water','High tide','Storm test'][j];
$('wetArea').textContent=fmt(current[0])+' ha';$('wetRoute').textContent=fmt(current[1])+' km';
$('caseDiff').textContent=yi?'Compared with Today under the same tide, an additional '+fmt(current[0]-exposure[0][j][0])+' ha lies below the connected waterline.':'Today provides the baseline for comparing years under this tidal condition.';
$('caseRows').innerHTML=exposure.map((row,k)=>'<tr class="'+(k===yi?'selected':'')+'"><td>'+years[k]+'</td><td>'+fmt(row[j][0])+'</td><td>'+fmt(row[j][1])+'</td></tr>').join('');}
function update(){$('futureNote').hidden=yi<5;showAnalysis();waterZ=rise[yi]+Number($('tide').value);drawProfile();$('delta').textContent='+'+rise[yi].toFixed(2)+' m';$('levelText').textContent='Test waterline  Z +'+waterZ.toFixed(2)+' m (CAD)';$('cutVal').textContent=cutY.toFixed(1)+' m';for(let [i,b] of [...$('years').children].entries())b.setAttribute('aria-pressed',i===yi);dirty=true}
function fitView(){span=Math.max(3230,2220*($('stage').clientWidth/$('stage').clientHeight));px=1520;py=mode==='Plan'?980:15;dirty=true}
let south=false,miniLocal=false;
const sectionName=()=>south?'B–B′':'A–A′';
const orientation=()=>mode==='Section'&&south?-1:1;
const cutPositions={a:null,b:null};
$('direction').onchange=e=>{
 if(!ready)return;
 cutPositions[south?'b':'a']=cutY;south=e.target.value==='b';
 cutY=cutPositions[e.target.value]??cutY;$('cut').value=cutY;setMode('Section');
};
function updateMini(){
 const section=mode==='Section';if(!section&&mode!=='Walk')return;
 $('miniPin').setAttribute('display',section?'none':'inline');$('miniCut').setAttribute('display',section?'inline':'none');
 $('miniBearing').hidden=!section;$('miniZoom').hidden=section;$('miniTitle').textContent=section?'Section '+sectionName():'Location';
 $('miniMap').setAttribute('aria-label',section?'Section '+sectionName()+', looking '+(south?'south':'north')+', at northing '+cutY.toFixed(1)+' metres':'Live walking position and heading on the site plan');
 if(section){
 $('miniBearing').textContent=south?'↓ Looking south · −Y':'↑ Looking north · +Y';
 $('miniEnds').innerHTML='<text x="45">'+(south?'B′':'A')+'</text><text x="2640">'+(south?'B':'A′')+'</text>';
 $('miniArrows').setAttribute('transform',south?'scale(1 -1)':'scale(1 1)');
 const cy=2031.62-cutY;
 $('miniMap').setAttribute('viewBox','-50 -205 3006.23 2441.62');
 $('miniCut').setAttribute('transform','translate(0 '+cy+')');
 $('miniEnds').setAttribute('transform',cy<180?'translate(0 155)':'translate(0 -30)');
 return;
 }
 const width=miniLocal?560:2906.23,height=width*2031.62/2906.23;
 const left=clamp(x-width/2,0,2906.23-width),top=clamp(2031.62-y-height/2,0,Math.max(0,2031.62-height));
 $('miniMap').setAttribute('viewBox',[left,top,width,height].join(' '));
 $('miniPin').setAttribute('transform','translate('+x+' '+(2031.62-y)+') rotate('+(yaw*180/Math.PI)+') scale('+(width/2906.23)+')');
}
$('miniZoom').onclick=()=>{miniLocal=!miniLocal;$('miniZoom').textContent=miniLocal?'Full site':'Local view';updateMini()};
function setMode(next){jumpTime=-1;jumpHeight=0;if(next==='Walk')cv.focus?.({preventScroll:true});$('mini').hidden=next!=='Walk'&&next!=='Section';let prev=mode;mode=next;if(prev!==next&&next!=='Walk')fitView();$('pad').style.display=next==='Walk'?'block':'none';$('local').disabled=$('fit').disabled=next==='Walk';$('hint').textContent={Plan:'Drag to pan · Scroll to zoom · Click open ground to start walking',Section:sectionName()+(south?' looks south':' looks north')+' · Move the cut in the sidebar · Scroll for detail',Elevation:'South elevation · Looking north · Scroll for detail',Walk:'WASD to walk · Space to jump · Drag to look · ← → to turn · Adjust speed in Walk controls'}[next];for(let b of $('views').children){if(b.tagName==='BUTTON'&&b.id!=='enterVR')b.setAttribute('aria-pressed',b.textContent===next)};if(ready&&next==='Section')slice();update()}
for(const m of modes){let b=document.createElement('button');b.textContent=m;b.onclick=()=>ready&&setMode(m);$('views').append(b)}
years.forEach((s,i)=>{let b=document.createElement('button');b.textContent=s;b.onclick=()=>{yi=i;update()};$('years').append(b)});$('tide').onchange=update;$('cut').oninput=e=>{cutY=+e.target.value;if(mode==='Section'&&ready)slice();update()};$('contours').onchange=()=>dirty=true;$('fit').onclick=fitView;$('local').onclick=()=>{px=x;py=mode==='Plan'?y:ground()+8;span=160;dirty=true};
function draw(k,bias=0,waterPass=0, ranges=null){let g=G[k];gl.bindVertexArray(g.vao);gl.uniform3fv(un.color,rgb(palette[k]));gl.uniform1f(un.bias,bias);gl.uniform1f(un.waterPass,waterPass);gl.uniform1f(un.shade,g.tri&&mode!=='Plan'?1:0);if(ranges){
 let start=0,count=0;
 for(const tile of ranges){
   const visible=x>=tile.minX-390&&x<=tile.maxX+390&&y>=tile.minY-390&&y<=tile.maxY+390;
   if(visible){if(!count)start=tile.offset;count+=tile.count}
   else if(count){gl.drawElements(gl.TRIANGLES,count,gl.UNSIGNED_INT,start*4);count=0}
 }
 if(count)gl.drawElements(gl.TRIANGLES,count,gl.UNSIGNED_INT,start*4)
}else gl.drawElements(g.tri?gl.TRIANGLES:gl.LINES,g.i.length,gl.UNSIGNED_INT,0)}
function scene(){let walk=mode==='Walk',plan=mode==='Plan',co=Math.cos(yaw),si=Math.sin(yaw),tilt=walk&&camera==='third'?clamp(pitch-.23,-1.1,.12):pitch,cp=Math.cos(tilt),sp=Math.sin(tilt);let eye=walk?[x,y,ground()+jumpHeight+1.60]:plan?[px,py,150]:[px,-400,py],r=walk?[co,-si,0]:[1,0,0],u=walk?[-si*sp,-co*sp,cp]:plan?[0,1,0]:[0,0,1],f=walk?[si*cp,co*cp,sp]:plan?[0,0,-1]:[0,1,0];if(walk&&camera==='third')eye=chaseEye(f);gl.uniform1f(un.avatar,0);for(let [k,a] of Object.entries({eye,R:r,U:u,F:f}))gl.uniform3fv(un[k],a);for(let [k,a] of Object.entries({ratio:W/H,wide:span,walk:+walk,stage:waterZ}))gl.uniform1f(un[k],a);
 gl.clearColor(...rgb(plan?'#e5ebe5':'#dfeaec'),1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(mode==='Section')return;
 drawLandscape(walk);if(walk&&camera==='third'){gl.uniform1f(un.avatar,1);gl.uniform2f(un.heading,co,si);gl.uniform3fv(un.actor,[x,y,ground()+jumpHeight]);for(const k of ['Torso','Head','Leg-1','Leg1','Arm-1','Arm1'])draw(k);gl.uniform1f(un.avatar,0)}if(plan){gl.disable(gl.DEPTH_TEST);for(let k of ['WATERWAYS_OUTLINE','RAILWAYS_AXES','PLAN_BUILDINGS','FRAME_PROJECT'])draw(k);if($('contours').checked)draw('PLAN_CONTOUR_LINES_1M');gl.enable(gl.DEPTH_TEST)}}
function drawLandscape(walk,drawLayer=draw){ drawLayer(terrain);let bias=walk?.000001:.000015;for(const [j,k] of ['VEGETATION_GREEN_SPACES_HATCH','ROADS_HATCH',water].entries())drawLayer(k,bias*(j+1));updateFlood();drawLayer('Flood',bias*4,1);drawLayer('BUILDINGS');drawLayer('TREE0');drawLayer('TREE1');}
function slice(){sect=[];for(let k of [terrain,'BUILDINGS',water,'ROADS_HATCH','TREE0','TREE1']){let g=G[k],v=g.v,ls=[];for(let n=0;n<g.i.length;n+=3){let pts=[];for(let e=0;e<3;e++){let a=3*g.i[n+e],b=3*g.i[n+(e+1)%3],ay=v[a+1],by=v[b+1];if((ay<=cutY)===(by<=cutY))continue;let t=(cutY-ay)/(by-ay);pts.push([v[a]+t*(v[b]-v[a]),v[a+2]+t*(v[b+2]-v[a+2])])}if(pts.length===2)ls.push(pts)}sect.push([k,ls])}}
const sx=a=>W/2+(a-px)*orientation()*W/span,sy=b=>H/2-(b-py)*W/span;
function line(x1,y1,x2,y2,color,thick=1){ctx.strokeStyle=color;ctx.lineWidth=thick;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
function tag(t,a,b){ctx.font='12px ui-monospace, monospace';ctx.fillStyle='#f7f6efeb';ctx.fillRect(a-4,b-14,ctx.measureText(t).width+8,20);ctx.fillStyle='#25433e';ctx.fillText(t,a,b)}
function annotate(){drawProfile();updateMini();ctx.clearRect(0,0,W,H);let zm=W/span;
 if(mode==='Plan'){let cy=sy(cutY);ctx.setLineDash([7,6]);line(sx(0),cy,sx(2906),cy,'#ae5a40');ctx.setLineDash([]);if(cy>22&&cy<H-20){tag(south?'B′':'A',clamp(sx(0),14,W-65),cy-6);tag(south?'B':'A′',clamp(sx(2906)-15,60,W-24),cy-6)}
 let a=sx(x),b=sy(y);ctx.fillStyle='#bd593e';ctx.beginPath();ctx.arc(a,b,4.5,0,Math.PI*2);ctx.fill();line(a,b,a+12*Math.sin(yaw),b-12*Math.cos(yaw),'#a94932',2);
 }else if(mode==='Section'){for(const [k,ls] of sect){ctx.strokeStyle=({TERRAIN_TERRAIN_MESH:'#3e4c46',BUILDINGS:'#48453b',WATERWAYS_HATCH:'#619597',ROADS_HATCH:'#877864',TREE0:'#8b9674',TREE1:'#869c75'})[k];ctx.lineWidth=k==='BUILDINGS'?1.5:1;ctx.beginPath();for(const [[a,b],[c,d]] of ls){ctx.moveTo(sx(a),sy(b));ctx.lineTo(sx(c),sy(d))}ctx.stroke()}}
 if(mode==='Section'||mode==='Elevation'){let j=sy(waterZ);ctx.setLineDash([7,4]);line(sx(0),j,sx(2906),j,'#237d96',1.5);ctx.setLineDash([]);if(j>=0&&j<=H)tag('Water Z +'+waterZ.toFixed(2)+' m',15,j+19)}
 if(mode!=='Walk'){let choices=[1,2,5,10,20,50,100,200,500,1000],num=choices.filter(n=>n*zm<100).pop()||1;tag(num+' m',16,23);line(14,30,14+num*zm,30,'#365750',2);$('scale').textContent=mode==='Plan'?'Plan · XY':mode==='Section'?'Section '+sectionName()+' · XZ':'South elevation · XZ';}
 else{$('scale').textContent='Body 1.70 m · Eye 1.60 m';line(W/2-5,H/2,W/2+5,H/2,'#fff');line(W/2,H/2-5,W/2,H/2+5,'#fff')}
 const g=ground(),d=waterZ-g;$('coords').textContent='Observer  X '+x.toFixed(1)+'  /  Y '+y.toFixed(1)+' m';$('reading').textContent='At observer · ground Z '+g.toFixed(2)+' m. '+(d>0?(Number.isFinite(height(G[terrain],x,y,true))?'Connected test water depth '+d.toFixed(2)+' m.':'Low ground, isolated from the test waterline.'):'Ground is '+(-d).toFixed(2)+' m above the test waterline.')}
function resize(){let a=cv.clientWidth,b=cv.clientHeight;if(a===W&&b===H)return;W=a;H=b;let ratio=Math.min(devicePixelRatio||1,1.6);for(const c of [cv,ov]){c.width=Math.round(W*ratio);c.height=Math.round(H*ratio)}ctx.setTransform(ratio,0,0,ratio,0,0);gl.viewport(0,0,cv.width,cv.height);dirty=true}
function step(dt){
 if(jumpTime>=0){
   jumpTime+=dt;
   jumpHeight=Math.max(0,3.2*jumpTime-4.905*jumpTime*jumpTime);
   if(jumpTime>=6.4/9.81){jumpTime=-1;jumpHeight=0}
   dirty=true;
 }
let f=+keys.has('w')-+keys.has('s')+Number(keys.has('arrowup'))-Number(keys.has('arrowdown')),r=+keys.has('d')-+keys.has('a'),turn=+keys.has('arrowright')-+keys.has('arrowleft');if(turn){yaw+=turn*dt*1.3;dirty=true}if(!(f||r))return;let len=Math.hypot(f,r),t=speed*dt/len,dx=t*(f*Math.sin(yaw)+r*Math.cos(yaw)),dy=t*(f*Math.cos(yaw)-r*Math.sin(yaw));moveObserver(dx,dy)}
function moveObserver(dx,dy){let a=clamp(x+dx,.005,2906.22),b=clamp(y+dy,.005,2031.61);let count=Math.ceil(Math.max(Math.abs(a-x),Math.abs(b-y))/.2)||1,incX=(a-x)/count,incY=(b-y)/count;for(let i=0;i<count;i++){if(!blocked(x+incX,y))x+=incX;if(!blocked(x,y+incY))y+=incY;}dirty=true}
function frame(now){if(navigation.immersive){requestAnimationFrame(frame);return}resize();if(mode==='Walk'){const dt=Math.min(.05,(now-last)/1000);step(dt);navigation.desktopFrame(now,dt);}last=now;if(dirty){scene();annotate();dirty=false}requestAnimationFrame(frame)}
function setCamera(c){camera=c;if(mode==='Walk')cv.focus?.({preventScroll:true});for(const k of ['first','third'])$(k).setAttribute('aria-pressed',k===c);dirty=true}
for(const k of ['first','third'])$(k).onclick=()=>setCamera(k);
$('speed').oninput=e=>{speed=Number(e.target.value);$('speedVal').textContent=speed+' m/s'};$('speed').onchange=e=>e.target.blur();
$('pick').onclick=()=>{if(ready){setMode('Plan');$('hint').textContent='Click open ground on the plan to enter '+camera+' person view.'}};
cv.onpointerdown=e=>{if(!ready)return;document.activeElement?.blur?.();downAt=[e.clientX,e.clientY];cv.setPointerCapture(e.pointerId);drag=[e.clientX,e.clientY]};cv.onpointermove=e=>{if(!drag)return;let dx=e.clientX-drag[0],dy=e.clientY-drag[1];drag=[e.clientX,e.clientY];if(mode==='Walk'){yaw+=dx*.005;pitch=clamp(pitch-dy*.004,-1.25,1.25)}else{px-=dx*orientation()*span/W;py+=dy*span/W}dirty=true};cv.onpointerup=e=>{let tap=downAt&&Math.hypot(e.clientX-downAt[0],e.clientY-downAt[1])<4;drag=null;downAt=null;if(tap)pickPoint(e)};cv.onpointercancel=()=>{drag=null;downAt=null};
cv.onwheel=e=>{if(mode==='Walk')return;e.preventDefault();let box=cv.getBoundingClientRect(),u=(e.clientX-box.left-W*.5)/W,v=(H*.5-e.clientY+box.top)/W,old=span;span=clamp(span*Math.exp(clamp(e.deltaY,-250,250)*.002),8,14000);px+=u*orientation()*(old-span);py+=v*(old-span);dirty=true};
function pickPoint(e){if(mode!=='Plan'||!ready)return;let box=cv.getBoundingClientRect(),a=px+(e.clientX-box.left-W/2)*span/W,b=py-(e.clientY-box.top-H/2)*span/W;if(a<0||b<0||a>2906.23||b>2031.62||blocked(a,b)){$('hint').textContent='Choose open ground inside the terrain frame to start walking.';return}x=a;y=b;keys.clear();setMode('Walk')};
window.onkeydown=e=>{
 if(mode==='Walk'&&(e.code==='Space'||e.key===' ')&&!['INPUT','SELECT','BUTTON','TEXTAREA','A','SUMMARY'].includes(e.target.tagName)){
   e.preventDefault();if(!e.repeat&&jumpTime<0)jumpTime=0;return;
 }
if(mode==='Walk'&&!['SELECT','INPUT'].includes(e.target.tagName)&&['w','a','s','d','shift','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())){e.preventDefault();keys.add(e.key.toLowerCase())}};window.onkeyup=e=>keys.delete(e.key.toLowerCase());window.onblur=()=>keys.clear();for(const b of $('pad').children){b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);keys.add(b.dataset.key)};b.onpointerup=b.onpointercancel=()=>keys.delete(b.dataset.key)}
const enter=document.createElement('button');
enter.id='enterVR';enter.textContent='Enter VR';enter.disabled=true;
$('views').append(enter);
const navigation=installHandNavigation({
 gl, enter, getMode:()=>mode, beginWalk:()=>{keys.clear();setMode('Walk');setCamera('first')},
 getYaw:()=>yaw, setYaw:value=>{yaw=value;dirty=true}, move:moveObserver,
 beginStereo(){
   for(const k of [terrain,'BUILDINGS','TREE0','TREE1','ROADS_HATCH',water,'VEGETATION_GREEN_SPACES_HATCH']){
     const g=G[k];if(g.tiles)continue;
     // Contiguous index ranges let both eyes skip distant parts of the city.
     const buckets=new Map(),wide=128;
     for(let n=0;n<g.i.length;n+=3){
       const a=g.i[n]*3,b=g.i[n+1]*3,c=g.i[n+2]*3;
       const tx=Math.floor((g.v[a]+g.v[b]+g.v[c])/(3*wide));
       const ty=Math.floor((g.v[a+1]+g.v[b+1]+g.v[c+1])/(3*wide));
       const key=tx+','+ty;
       if(!buckets.has(key))buckets.set(key,{tx,ty,minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity,indices:[]});
       const bucket=buckets.get(key);
       bucket.minX=Math.min(bucket.minX,g.v[a],g.v[b],g.v[c]);bucket.maxX=Math.max(bucket.maxX,g.v[a],g.v[b],g.v[c]);
       bucket.minY=Math.min(bucket.minY,g.v[a+1],g.v[b+1],g.v[c+1]);bucket.maxY=Math.max(bucket.maxY,g.v[a+1],g.v[b+1],g.v[c+1]);
       bucket.indices.push(g.i[n],g.i[n+1],g.i[n+2]);
     }
     const sorted=new Uint32Array(g.i.length);let offset=0;g.tiles=[];
     for(const {minX,minY,maxX,maxY,indices} of [...buckets.values()].sort((a,b)=>a.ty-b.ty||a.tx-b.tx)){
       sorted.set(indices,offset);g.tiles.push({minX,minY,maxX,maxY,offset,count:indices.length});offset+=indices.length;
     }
     gl.bindVertexArray(g.vao);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,sorted,gl.STATIC_DRAW);
   }
 },
 renderEyes(layer,pose,angle,verticalOffset,drawMenu){
   gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);
   gl.clearColor(...rgb('#dfeaec'),1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
   if(!pose)return;
   const p=pose.transform.position;
   gl.uniform1f(un.xrMode,1);gl.uniform1f(un.avatar,0);gl.uniform1f(un.stage,waterZ);
   gl.uniform2f(un.heading,Math.cos(angle),Math.sin(angle));
   gl.uniform3f(un.eye,x,y,ground());gl.uniform3f(un.xrOffset,p.x,verticalOffset,p.z);
   for(const view of pose.views){
     const v=layer.getViewport(view);gl.viewport(v.x,v.y,v.width,v.height);
     gl.uniformMatrix4fv(un.xrProjection,false,view.projectionMatrix);
     gl.uniformMatrix4fv(un.xrView,false,view.transform.inverse.matrix);
     drawLandscape(true,(k,bias,pass)=>draw(k,bias,pass,G[k].tiles));
     drawMenu(view,prog);
   }
 },
 endStereo(){
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,cv.width,cv.height);
   gl.uniform1f(un.xrMode,0);last=performance.now();keys.clear();dirty=true;
 }
});
load().catch(e=>{$('progress').textContent=e.message;console.error(e)});
