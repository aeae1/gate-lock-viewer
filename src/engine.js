// Browser-local triangle path tracer. No network or server rendering.
const V={add:(a,b)=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]],sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],mul:(a,s)=>[a[0]*s,a[1]*s,a[2]*s],dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]};
const norm=a=>V.mul(a,1/(Math.hypot(...a)||1)),PI=Math.PI,EPS=.025;
const rz=(v,a)=>[v[0]*Math.cos(a)-v[1]*Math.sin(a),v[0]*Math.sin(a)+v[1]*Math.cos(a),v[2]];
const ry=(v,a)=>[v[0]*Math.cos(a)+v[2]*Math.sin(a),v[1],-v[0]*Math.sin(a)+v[2]*Math.cos(a)];
const materials=[
 [.25,.037,.024,0,.23], [.31,.049,.03,0,.23], [.115,.17,.205,.42,.34],
 [.68,.72,.76,1,.20], [.82,.86,.90,1,.18], [.57,.49,.36,.8,.37],
 [.11,.14,.145,.35,.39], [.74,.68,.53,1,.19], [.48,.54,.61,1,.20],
 [.84,.86,.88,1,.16], [.007,.009,.012,0,.48], [.62,.67,.72,1,.29],
 [.028,.037,.045,0,.50], [.22,.24,.27,0,.78],
 [.955,.50,.32,1,.16], [.285,.038,.022,0,.72], [.235,.030,.018,0,.65]
];
// Separate finishes for parts that used to share a material.
materials.push(...[2,6,3,7].map(id=>materials[id].slice()));
function unpack(c){
 const decode=(s,kind)=>{const b=atob(s),a=new Uint8Array(b.length);for(let i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return new kind(a.buffer)};
 return c.parts.map(p=>{const v=decode(p[5],Int16Array),n=decode(p[6],Int8Array),t=decode(p[7],Uint16Array);return {name:p[0],group:p[1],moving:!!p[2],turn:!!p[3],inferred:!!p[4],v:Float32Array.from(v,x=>x/100),n:Float32Array.from(n,x=>x/127),t}});
}
function matId(p){
 if(p.material!==undefined)return p.material;
 const g=p.group;
 if(g==='frame')return p.moving?1:0;
 if(g==='mount')return p.name.includes('outside')?2:17;
 if(g==='actuator')return 7;if(g==='lock')return p.inferred?(p.turn?20:19):3;
 if(g==='stop')return p.moving?18:6;
 return ({bolt:4,keeper:5,keypad:8,key:9,gasket:10,letter:10,section:11,tube_inner:12})[g]??3;
}
function posePoint(v,p,pose,normal=false){
 let q=v;
 if(p.group==='bolt'&&!normal)q=V.add(q,[pose.stroke,0,0]);
 if(p.turn){const c=p.inferred?packed.params.outside_knob_center:packed.params.inside_knob_center;if(!normal)q=V.sub(q,c);q=ry(q,pose.turn*PI/180);if(!normal)q=V.add(q,c);}
 if(p.moving){const c=packed.params.hinge_origin;if(!normal)q=V.sub(q,c);q=rz(q,-pose.angle*PI/180);if(!normal)q=V.add(q,c);}
 return q;
}
function partKey(p){
 if(p.partKey)return p.partKey;
 if(['frame','section','tube_inner'].includes(p.group))return p.moving?'gateTube':'postTube';
 if(p.inferred)return 'keypad';
 if(p.group==='mount')return p.name.includes('outside')?'outsidePlate':'insidePlate';
 if(p.group==='stop')return p.moving?'gateStop':'postStop';
 return p.group==='lock'?'lockCase':p.group;
}
function buildScene(parts,pose,visibility){
 const tris=[],bounds=[];
 for(const p of parts){
  if(p.context&&!visibility[p.context])continue;
  if(!p.context&&['frame','section','tube_inner'].includes(p.group)&&visibility[p.moving?'fullGate':'fullPost'])continue;
  if(p.group==='ghost'||visibility[partKey(p)]===false)continue;
  const vs=[],ns=[];for(let i=0;i<p.v.length;i+=3){vs.push(posePoint(Array.from(p.v.slice(i,i+3)),p,pose));ns.push(posePoint(Array.from(p.n.slice(i,i+3)),p,pose,true));}
  const mat=matId(p);
  for(let i=0;i<p.t.length;i+=3){const ids=[p.t[i],p.t[i+1],p.t[i+2]],a=vs[ids[0]],b=vs[ids[1]],c=vs[ids[2]],e1=V.sub(b,a),e2=V.sub(c,a);
   if(Math.hypot(...V.cross(e1,e2))<1e-6)continue;
   tris.push([...a,mat,...e1,p.moving?1:0,...e2,p.turn?(p.inferred?2:1):0,...ns[ids[0]],p.group==='bolt'?1:0,...ns[ids[1]],0,...ns[ids[2]],0]);
   bounds.push([Math.min(a[0],b[0],c[0]),Math.min(a[1],b[1],c[1]),Math.min(a[2],b[2],c[2]),Math.max(a[0],b[0],c[0]),Math.max(a[1],b[1],c[1]),Math.max(a[2],b[2],c[2])]);
  }
 }
 const nodes=[],ordered=[];
 function build(ids){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const id of ids)for(let j=0;j<3;j++){min[j]=Math.min(min[j],bounds[id][j]);max[j]=Math.max(max[j],bounds[id][j+3]);}
  const ni=nodes.length;nodes.push([...min,0,...max,0]);
  if(ids.length<=4){nodes[ni][7]=ordered.length*8+ids.length;for(const id of ids)ordered.push(tris[id]);}
  else{const e=V.sub(max,min);const axis=e.indexOf(Math.max(...e));ids.sort((a,b)=>(bounds[a][axis]+bounds[a][axis+3])-(bounds[b][axis]+bounds[b][axis+3]));const mid=ids.length>>1;build(ids.slice(0,mid));build(ids.slice(mid));}
  nodes[ni][3]=nodes.length;return ni;
 }
 if(!tris.length)return {base:new Float32Array(0),t:new Float32Array(0),b:Float32Array.from([-100,-100,-144,1,200,100,144,0]),count:0,lo:[-100,-100,-144],hi:[200,100,144]};
 build(tris.map((_,i)=>i));
 const base=Float32Array.from(ordered.flat());return {base,t:base.slice(),b:Float32Array.from(nodes.flat()),count:nodes.length,lo:nodes[0].slice(0,3),hi:nodes[0].slice(4,7)};
}
function intersect(sc,o,d,maxT=1e8,shadow=false){
 const B=sc.b,T=sc.t,ix=1/(Math.abs(d[0])<1e-12?1e-12:d[0]),iy=1/(Math.abs(d[1])<1e-12?1e-12:d[1]),iz=1/(Math.abs(d[2])<1e-12?1e-12:d[2]);
 let dist=maxT,hit=-1,hu=0,hv=0,i=0,ground=false;
 if(d[2]<-1e-10){const tt=(sc.groundZ-o[2])/d[2];if(tt>EPS&&tt<dist){if(shadow)return true;dist=tt;ground=true;}}
 while(i<sc.count){const k=i*8;let a=(B[k]-o[0])*ix,b=(B[k+4]-o[0])*ix,mn=Math.min(a,b),mx=Math.max(a,b);
  a=(B[k+1]-o[1])*iy;b=(B[k+5]-o[1])*iy;mn=Math.max(mn,Math.min(a,b));mx=Math.min(mx,Math.max(a,b));
  a=(B[k+2]-o[2])*iz;b=(B[k+6]-o[2])*iz;mn=Math.max(mn,Math.min(a,b),0);mx=Math.min(mx,Math.max(a,b),dist);
  if(mx<mn){i=B[k+3];continue;}
  const code=B[k+7],cnt=code%8,first=(code-cnt)/8;
  for(let q=0;q<cnt;q++){const j=(first+q)*24;
   const px=d[1]*T[j+10]-d[2]*T[j+9],py=d[2]*T[j+8]-d[0]*T[j+10],pz=d[0]*T[j+9]-d[1]*T[j+8];
   const det=T[j+4]*px+T[j+5]*py+T[j+6]*pz;if(Math.abs(det)<1e-9)continue;const inv=1/det;
   const x=o[0]-T[j],y=o[1]-T[j+1],z=o[2]-T[j+2],u=(x*px+y*py+z*pz)*inv;if(u<0||u>1)continue;
   const qx=y*T[j+6]-z*T[j+5],qy=z*T[j+4]-x*T[j+6],qz=x*T[j+5]-y*T[j+4],v=(d[0]*qx+d[1]*qy+d[2]*qz)*inv;if(v<0||u+v>1)continue;
   const tt=(T[j+8]*qx+T[j+9]*qy+T[j+10]*qz)*inv;if(tt>EPS&&tt<dist){if(shadow)return true;dist=tt;hit=j;hu=u;hv=v;ground=false;}
  }i++;
 }
 if(shadow)return false;if(hit<0&&!ground)return null;
 if(ground)return {t:dist,n:[0,0,1],ng:[0,0,1],mat:13};
 let n=norm([0,1,2].map(k=>T[hit+12+k]*(1-hu-hv)+T[hit+16+k]*hu+T[hit+20+k]*hv));
 let ng=norm(V.cross(Array.from(T.slice(hit+4,hit+7)),Array.from(T.slice(hit+8,hit+11))));
 if(V.dot(ng,d)>0)ng=V.mul(ng,-1);if(V.dot(n,ng)<0)n=V.mul(n,-1);if(V.dot(n,d)>-.001)n=ng;
 return {t:dist,n,ng,mat:T[hit+3]};
}
function cameraFor(sc,w,h,az,el,zoom){
 const right=[Math.cos(az),Math.sin(az),0],up=[-Math.sin(el)*Math.sin(az),Math.sin(el)*Math.cos(az),Math.cos(el)],normal=[Math.cos(el)*Math.sin(az),-Math.cos(el)*Math.cos(az),Math.sin(el)];
 let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
 for(let i=0;i<sc.t.length;i+=24){const a=Array.from(sc.t.slice(i,i+3));for(const p of [a,V.add(a,Array.from(sc.t.slice(i+4,i+7))),V.add(a,Array.from(sc.t.slice(i+8,i+11)))]){const x=V.dot(p,right),y=V.dot(p,up);xmin=Math.min(xmin,x);xmax=Math.max(xmax,x);ymin=Math.min(ymin,y);ymax=Math.max(ymax,y);}}
 if(!sc.t.length){xmin=-100;xmax=200;ymin=-144;ymax=144;}
 const mid=[0,1,2].map(k=>(sc.b[k]+sc.b[k+4])/2),center=V.add(V.add(V.mul(right,(xmin+xmax)/2),V.mul(up,(ymin+ymax)/2)),V.mul(normal,V.dot(mid,normal)));
 const tanY=Math.tan(PI/8),tanX=tanY*w/h;let distance=1;
 for(const x of [sc.b[0],sc.b[4]])for(const y of [sc.b[1],sc.b[5]])for(const z of [sc.b[2],sc.b[6]]){const q=V.sub([x,y,z],center),dep=V.dot(q,normal);distance=Math.max(distance,dep+Math.abs(V.dot(q,right))/tanX,dep+Math.abs(V.dot(q,up))/tanY);}
 distance=distance*1.08/zoom;
 return {right,up,normal,center,distance,film:[2*distance*tanX,2*distance*tanY]};
}
// Generated equirectangular panorama, plus a procedural sun for bright highlights.
const skyBytes=Uint8Array.from(atob(skyAsset.pixels),c=>c.charCodeAt(0));
const skyWords=new Uint16Array(skyBytes.buffer),skyRGBA=new Uint8Array(skyWords.length*4),skyLinear=new Float32Array(skyWords.length*3);
const linear=x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
for(let i=0;i<skyWords.length;i++){const p=skyWords[i],rgb=[((p>>11)&31)/31,((p>>5)&63)/63,(p&31)/31];for(let k=0;k<3;k++){skyRGBA[i*4+k]=Math.round(rgb[k]*255);skyLinear[i*3+k]=linear(rgb[k]);}skyRGBA[i*4+3]=255;}
const sunCos=.9994;
let skyYaw=0,lights=[];
function setLights(deg){skyYaw=deg*PI/180;lights=[rz(norm([-.60,.50,.78]),skyYaw)];}
setLights(0);
function skySample(d){
 const angle=Math.atan2(d[1],d[0])-skyYaw,u=((.5+angle/(2*PI))%1+1)%1,v=Math.acos(Math.max(-1,Math.min(1,d[2])))/PI;
 const w=skyAsset.width,h=skyAsset.height,x=u*w-.5,y=Math.max(0,Math.min(h-1,v*h-.5)),x0=((Math.floor(x)%w)+w)%w,x1=(x0+1)%w,y0=Math.floor(y),y1=Math.min(h-1,y0+1),a=x-Math.floor(x),b=y-y0;
 const i=(y0*w+x0)*3,j=(y0*w+x1)*3,k=(y1*w+x0)*3,l=(y1*w+x1)*3;
 return [0,1,2].map(q=>((skyLinear[i+q]*(1-a)+skyLinear[j+q]*a)*(1-b)+(skyLinear[k+q]*(1-a)+skyLinear[l+q]*a)*b)*2.0);
}
function environment(d){const c=skySample(d),sun=V.dot(d,lights[0]),g=1.5*Math.exp((sun-1)*230),p=sun>sunCos?180:0;for(let k=0;k<3;k++)c[k]+=(g+p)*[1,.95,.85][k];return c;}
function envPdf(d){return .55/(4*PI)+(V.dot(d,lights[0])>sunCos?.45/(2*PI*(1-sunCos)):0);}
function basis(n,x,y,z){const t=norm(V.cross(Math.abs(n[2])<.999?[0,0,1]:[0,1,0],n)),b=V.cross(n,t);return norm(V.add(V.add(V.mul(t,x),V.mul(b,y)),V.mul(n,z)));}
function sampleSun(rnd){const z=1-rnd()*(1-sunCos),r=Math.sqrt(Math.max(0,1-z*z)),a=2*PI*rnd();return basis(lights[0],r*Math.cos(a),r*Math.sin(a),z);}
function sampleEnvironment(rnd){if(rnd()<.45)return sampleSun(rnd);const z=2*rnd()-1,r=Math.sqrt(Math.max(0,1-z*z)),a=2*PI*rnd();return [r*Math.cos(a),r*Math.sin(a),z];}
function groundBackdrop(sc,o,d,hit,rnd){
 const p=V.add(V.add(o,V.mul(d,hit.t)),[0,0,EPS*2]);let l;
 if(rnd()<.65)l=sampleSun(rnd);else{const u=rnd(),r=Math.sqrt(u),a=2*PI*rnd();l=[r*Math.cos(a),r*Math.sin(a),Math.sqrt(1-u)];}
 const visibility=intersect(sc,p,l,1e8,true)?0:1;
 return environment(d).map(x=>x*(.3+.7*visibility));
}
function cameraRay(cam,x,y){
 const o=V.add(cam.center,V.mul(cam.normal,cam.distance));
 const d=norm(V.add(V.add(V.mul(cam.normal,-cam.distance),V.mul(cam.right,x)),V.mul(cam.up,y)));
 return {o,d};
}

function bsdf(n,v,l,mat){
 const m=materials[mat],nv=Math.max(0,V.dot(n,v)),nl=Math.max(0,V.dot(n,l));if(nv<=0||nl<=0)return {f:[0,0,0],pdf:0};
 const h=norm(V.add(v,l)),nh=Math.max(0,V.dot(n,h)),vh=Math.max(0,V.dot(v,h)),a=m[4]*m[4],a2=a*a,den=nh*nh*(a2-1)+1,D=a2/(PI*den*den),g=x=>2*x/(x+Math.sqrt(a2+(1-a2)*x*x)),G=g(nv)*g(nl),sp=.25+.75*m[3];
 const F=m.slice(0,3).map(x=>{const f=.04*(1-m[3])+x*m[3];return f+(1-f)*(1-vh)**5});
 return {f:F.map((f,k)=>(1-f)*(1-m[3])*m[k]/PI+D*G*f/Math.max(4*nv*nl,1e-8)),pdf:(1-sp)*nl/PI+sp*D*nh/Math.max(4*vh,1e-8)};
}
function sampleBsdf(n,v,mat,rnd){
 const m=materials[mat],a=m[4]*m[4];
 if(rnd()<.25+.75*m[3]){const u=rnd(),ct=Math.sqrt((1-u)/(1+(a*a-1)*u)),st=Math.sqrt(Math.max(0,1-ct*ct)),phi=2*PI*rnd(),h=basis(n,st*Math.cos(phi),st*Math.sin(phi),ct);return norm(V.sub(V.mul(h,2*V.dot(v,h)),v));}
 const u=rnd(),r=Math.sqrt(u),p=2*PI*rnd();return basis(n,r*Math.cos(p),r*Math.sin(p),Math.sqrt(1-u));
}
function path(sc,origin,direction,rnd){
 let o=origin,d=direction,weight=[1,1,1],sum=[0,0,0],prevPdf=0;
 for(let bounce=0;bounce<4;bounce++){
  const hit=intersect(sc,o,d);
  if(!hit){const e=environment(d),ep=envPdf(d),mis=bounce?prevPdf*prevPdf/(prevPdf*prevPdf+ep*ep):1;for(let k=0;k<3;k++)sum[k]+=weight[k]*e[k]*mis;break;}
  if(bounce===0&&hit.mat===13)return groundBackdrop(sc,o,d,hit,rnd);
  const p=V.add(o,V.mul(d,hit.t)),n=hit.n,v=V.mul(d,-1),offset=V.add(p,V.mul(hit.ng,EPS*2));
  const l=sampleEnvironment(rnd),nl=V.dot(n,l);
  if(nl>0&&V.dot(hit.ng,l)>0&&!intersect(sc,offset,l,1e8,true)){
   const b=bsdf(n,v,l,hit.mat),lp=envPdf(l),mis=lp*lp/(lp*lp+b.pdf*b.pdf),e=environment(l);
   for(let k=0;k<3;k++)sum[k]+=weight[k]*e[k]*b.f[k]*nl*mis/lp;
  }
  d=sampleBsdf(n,v,hit.mat,rnd);if(V.dot(hit.ng,d)<=0)break;
  const b=bsdf(n,v,d,hit.mat);if(b.pdf<1e-9)break;for(let k=0;k<3;k++)weight[k]*=b.f[k]*Math.max(0,V.dot(n,d))/b.pdf;
  if(bounce>=2){const rr=Math.min(.95,Math.max(...weight));if(rnd()>rr)break;for(let k=0;k<3;k++)weight[k]/=rr;}
  o=offset;prevPdf=b.pdf;
 }return sum;
}
function tone(x){x=Math.max(0,x*.85);x=Math.min(1,(x*(2.51*x+.03))/(x*(2.43*x+.59)+.14));return Math.round(255*(x<=.0031308?12.92*x:1.055*x**(1/2.4)-.055));}
function bitmapURL(bytes,w,h){
 const header=new Uint8Array(54),v=new DataView(header.buffer),out=new Uint8Array(54+bytes.length);header[0]=66;header[1]=77;v.setUint32(2,out.length,true);v.setUint32(10,54,true);v.setUint32(14,40,true);v.setInt32(18,w,true);v.setInt32(22,-h,true);v.setUint16(26,1,true);v.setUint16(28,32,true);v.setUint32(34,bytes.length,true);out.set(header);
 for(let i=0;i<bytes.length;i+=4){out[i+54]=bytes[i+2];out[i+55]=bytes[i+1];out[i+56]=bytes[i];out[i+57]=255;}
 let b='';for(let i=0;i<out.length;i+=8192)b+=String.fromCharCode(...out.subarray(i,i+8192));return 'data:image/bmp;base64,'+btoa(b);
}
function fastPreview(sc,cam,w,h){
 const data=new Uint8ClampedArray(w*h*4),depth=new Float32Array(w*h);depth.fill(-Infinity);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,ray=cameraRay(cam,((x+.5)/w-.5)*cam.film[0],(.5-(y+.5)/h)*cam.film[1]),c=environment(ray.d);for(let k=0;k<3;k++)data[i+k]=tone(c[k]);data[i+3]=255;}
 const project=v=>{const q=V.sub(v,cam.center),dep=V.dot(q,cam.normal),factor=cam.distance/Math.max(1,cam.distance-dep);return [(V.dot(q,cam.right)*factor/cam.film[0]+.5)*w,(.5-V.dot(q,cam.up)*factor/cam.film[1])*h,V.dot(v,cam.normal)];};
 const light=norm([-.5,.7,.8]),half=norm(V.add(light,cam.normal)),T=sc.t;
 for(let j=0;j<T.length;j+=24){const av=Array.from(T.slice(j,j+3)),bv=V.add(av,Array.from(T.slice(j+4,j+7))),cv=V.add(av,Array.from(T.slice(j+8,j+11)));
  if([av,bv,cv].some(p=>cam.distance-V.dot(V.sub(p,cam.center),cam.normal)<.2))continue;
  const [a,b,c]=[av,bv,cv].map(project),area=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);if(Math.abs(area)<.003)continue;
  const cols=[12,16,20].map(off=>{const n=Array.from(T.slice(j+off,j+off+3)),sh=.28+.75*Math.max(0,V.dot(n,light)),sp=Math.pow(Math.max(0,V.dot(n,half)),32)*.45;return materials[T[j+3]].slice(0,3).map(x=>tone(x*sh+sp));});
  const xmin=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),xmax=Math.min(w-1,Math.ceil(Math.max(a[0],b[0],c[0]))),ymin=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),ymax=Math.min(h-1,Math.ceil(Math.max(a[1],b[1],c[1])));
  const ux=(b[1]-c[1])/area,uy=(c[0]-b[0])/area,vx=(c[1]-a[1])/area,vy=(a[0]-c[0])/area;
  for(let y=ymin;y<=ymax;y++){let u=ux*(xmin+.5-c[0])+uy*(y+.5-c[1]),v=vx*(xmin+.5-c[0])+vy*(y+.5-c[1]);for(let x=xmin;x<=xmax;x++,u+=ux,v+=vx){const k=1-u-v;if(u<0||v<0||k<0)continue;const z=a[2]*u+b[2]*v+c[2]*k,i=y*w+x;if(z<=depth[i])continue;depth[i]=z;for(let q=0;q<3;q++)data[i*4+q]=cols[0][q]*u+cols[1][q]*v+cols[2][q]*k;}}
 }return bitmapURL(data,w,h);
}
function applyPose(sc,pose){
 const T=sc.t,A=sc.base,B=sc.b,ga=-pose.angle*PI/180,ka=pose.turn*PI/180,hinge=packed.params.hinge_origin;
 for(let j=0;j<A.length;j+=24){const moving=A[j+7],turn=A[j+11],bolt=A[j+15],center=turn===2?packed.params.outside_knob_center:packed.params.inside_knob_center;
  for(const off of [0,4,8,12,16,20]){let v=[A[j+off],A[j+off+1],A[j+off+2]];if(off===0&&bolt)v[0]+=pose.stroke;
   if(turn&&ka){if(off===0)v=V.sub(v,center);v=ry(v,ka);if(off===0)v=V.add(v,center);}
   if(moving&&ga){if(off===0)v=V.sub(v,hinge);v=rz(v,ga);if(off===0)v=V.add(v,hinge);}
   T[j+off]=v[0];T[j+off+1]=v[1];T[j+off+2]=v[2];
  }
 }
 for(let i=sc.count-1;i>=0;i--){const k=i*8,code=B[k+7],cnt=code%8,first=(code-cnt)/8;
  if(cnt){for(let a=0;a<3;a++){let lo=Infinity,hi=-Infinity;for(let f=first;f<first+cnt;f++){const j=f*24;const v=T[j+a],v1=v+T[j+4+a],v2=v+T[j+8+a];lo=Math.min(lo,v,v1,v2);hi=Math.max(hi,v,v1,v2);}B[k+a]=lo;B[k+4+a]=hi;}}
  else{const l=(i+1)*8,r=B[l+3]*8;for(let a=0;a<3;a++){B[k+a]=Math.min(B[l+a],B[r+a]);B[k+4+a]=Math.max(B[l+4+a],B[r+4+a]);}}
 }
}
