const vertexSource=`#version 300 es
precision highp float;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0,1);}`;
const traceSource=`#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
out vec4 outColor;
uniform sampler2D triangles,nodes,previous,skyMap;
uniform int nodeCount,sampleCount;
uniform vec2 resolution,film;
uniform vec3 cameraCenter,cameraRight,cameraUp,cameraNormal;
uniform vec4 matBase[${materials.length}];
uniform float matRough[${materials.length}];
uniform vec3 sunDirection;
uniform float skyRotation,cameraDistance,groundZ;
const float PI=3.141592653589793;
const float EPS=.025;
const float sunCos=.9994;
uint rng;
float random(){rng^=rng<<13;rng^=rng>>17;rng^=rng<<5;return float(rng)*2.3283064365386963e-10;}
vec4 readData(sampler2D tex,int i){return texelFetch(tex,ivec2(i%1024,i/1024),0);}
struct Hit{float t;vec3 n;vec3 ng;int material;};
bool trace(vec3 o,vec3 d,bool shadow,out Hit hit){
 hit.t=1e8;hit.material=-1;bool ground=false;int selected=-1;vec2 uv=vec2(0);
 if(d.z<-.00000001){float t=(groundZ-o.z)/d.z;if(t>EPS&&t<hit.t){if(shadow)return true;hit.t=t;ground=true;}}
 vec3 inv=1.0/(sign(d+vec3(1e-20))*max(abs(d),vec3(1e-10)));int i=0;
 while(i<nodeCount){vec4 a=readData(nodes,i*2),b=readData(nodes,i*2+1);vec3 t0=(a.xyz-o)*inv,t1=(b.xyz-o)*inv;vec3 lo=min(t0,t1),hi=max(t0,t1);float nearT=max(max(lo.x,lo.y),max(lo.z,0.)),farT=min(min(hi.x,hi.y),min(hi.z,hit.t));
  if(farT<nearT){i=int(a.w);continue;}
  int code=int(b.w),count=code%8,first=code/8;
  for(int j=0;j<4;j++){if(j>=count)break;int index=(first+j)*6;vec3 v0=readData(triangles,index).xyz,e1=readData(triangles,index+1).xyz,e2=readData(triangles,index+2).xyz;vec3 p=cross(d,e2);float det=dot(e1,p);if(abs(det)<1e-9)continue;
   float ri=1./det;vec3 s=o-v0;float u=dot(s,p)*ri;if(u<0.||u>1.)continue;vec3 q=cross(s,e1);float v=dot(d,q)*ri;if(v<0.||u+v>1.)continue;float t=dot(e2,q)*ri;
   if(t>EPS&&t<hit.t){if(shadow)return true;hit.t=t;selected=index;uv=vec2(u,v);ground=false;}
  }i++;
 }
 if(shadow)return false;
 if(ground){hit.n=vec3(0,0,1);hit.ng=hit.n;hit.material=13;return true;}
 if(selected<0)return false;
 hit.material=int(readData(triangles,selected).w);
 hit.ng=normalize(cross(readData(triangles,selected+1).xyz,readData(triangles,selected+2).xyz));if(dot(hit.ng,d)>0.)hit.ng=-hit.ng;
 hit.n=normalize(readData(triangles,selected+3).xyz*(1.-uv.x-uv.y)+readData(triangles,selected+4).xyz*uv.x+readData(triangles,selected+5).xyz*uv.y);
 if(dot(hit.n,hit.ng)<0.)hit.n=-hit.n;if(dot(hit.n,d)>-.001)hit.n=hit.ng;
 return true;
}
vec3 env(vec3 d){
 float u=fract(.5+(atan(d.y,d.x)-skyRotation)/(2.*PI)),v=acos(clamp(d.z,-1.,1.))/PI;
 vec3 rgb=texture(skyMap,vec2(u,v)).rgb;
 vec3 c=mix(pow((rgb+.055)/1.055,vec3(2.4)),rgb/12.92,lessThanEqual(rgb,vec3(.04045)))*2.;
 float sd=dot(d,sunDirection),glow=1.5*exp((sd-1.)*230.);c+=(glow+(sd>sunCos?180.:0.))*vec3(1.,.95,.85);return c;
}
float envPdf(vec3 d){return .55/(4.*PI)+(dot(d,sunDirection)>sunCos?.45/(2.*PI*(1.-sunCos)):0.);}
vec3 basis(vec3 n,vec3 v){vec3 t=normalize(cross(abs(n.z)<.999?vec3(0,0,1):vec3(0,1,0),n)),b=cross(n,t);return normalize(t*v.x+b*v.y+n*v.z);}
vec3 sampleSun(){float z=1.-random()*(1.-sunCos),r=sqrt(max(0.,1.-z*z)),a=2.*PI*random();return basis(sunDirection,vec3(r*cos(a),r*sin(a),z));}
vec3 sampleEnv(){if(random()<.45)return sampleSun();float z=2.*random()-1.,r=sqrt(max(0.,1.-z*z)),a=2.*PI*random();return vec3(r*cos(a),r*sin(a),z);}
vec3 groundBackdrop(vec3 o,vec3 d,Hit hit){
 vec3 p=o+d*hit.t+vec3(0,0,EPS*2.),l;
 if(random()<.65)l=sampleSun();else{float u=random(),r=sqrt(u),a=2.*PI*random();l=vec3(r*cos(a),r*sin(a),sqrt(1.-u));}
 Hit sh;float visibility=trace(p,l,true,sh)?0.:1.;return env(d)*(.3+.7*visibility);
}
float smith(float x,float a2){return 2.*x/(x+sqrt(a2+(1.-a2)*x*x));}
vec3 evaluate(vec3 n,vec3 v,vec3 l,int id,out float pdf){
 vec4 m=matBase[id];float nv=max(0.,dot(n,v)),nl=max(0.,dot(n,l));pdf=0.;if(nv<=0.||nl<=0.)return vec3(0);
 vec3 h=normalize(v+l);float nh=max(0.,dot(n,h)),vh=max(0.,dot(v,h)),a=matRough[id]*matRough[id],a2=a*a,den=nh*nh*(a2-1.)+1.,D=a2/(PI*den*den),G=smith(nv,a2)*smith(nl,a2),sp=.25+.75*m.w;
 vec3 F0=mix(vec3(.04),m.xyz,m.w),F=F0+(1.-F0)*pow(1.-vh,5.);
 pdf=(1.-sp)*nl/PI+sp*D*nh/max(4.*vh,1e-8);
 return (1.-F)*(1.-m.w)*m.xyz/PI+D*G*F/max(4.*nv*nl,1e-8);
}
vec3 sampleMaterial(vec3 n,vec3 v,int id){
 float a=matRough[id]*matRough[id];if(random()<.25+.75*matBase[id].w){float u=random(),ct=sqrt((1.-u)/(1.+(a*a-1.)*u)),st=sqrt(max(0.,1.-ct*ct)),p=2.*PI*random();vec3 h=basis(n,vec3(st*cos(p),st*sin(p),ct));return normalize(2.*dot(v,h)*h-v);}
 float u=random(),r=sqrt(u),p=2.*PI*random();return basis(n,vec3(r*cos(p),r*sin(p),sqrt(1.-u)));
}
vec3 path(vec3 o,vec3 d){
 vec3 weight=vec3(1),sum=vec3(0);float prevPdf=0.;
 for(int bounce=0;bounce<4;bounce++){
  Hit hit;if(!trace(o,d,false,hit)){float ep=envPdf(d),mis=bounce==0?1.:prevPdf*prevPdf/(prevPdf*prevPdf+ep*ep);sum+=weight*env(d)*mis;break;}
  if(bounce==0&&hit.material==13)return groundBackdrop(o,d,hit);
  vec3 p=o+d*hit.t,n=hit.n,v=-d,offset=p+hit.ng*(EPS*2.);vec3 l=sampleEnv();float nl=dot(n,l);
  if(nl>0.&&dot(hit.ng,l)>0.){Hit sh;if(!trace(offset,l,true,sh)){float bp;vec3 f=evaluate(n,v,l,hit.material,bp);float lp=envPdf(l),mis=lp*lp/(lp*lp+bp*bp);sum+=weight*env(l)*f*(nl*mis/lp);}}
  d=sampleMaterial(n,v,hit.material);if(dot(hit.ng,d)<=0.)break;float bp;vec3 f=evaluate(n,v,d,hit.material,bp);if(bp<1e-9)break;weight*=f*(max(0.,dot(n,d))/bp);
  if(bounce>=2){float rr=min(.95,max(max(weight.r,weight.g),weight.b));if(random()>rr)break;weight/=rr;}
  o=offset;prevPdf=bp;
 }return sum;
}
void main(){
 uvec2 p=uvec2(gl_FragCoord.xy);rng=(p.x*1973u+p.y*9277u+uint(sampleCount+1)*26699u)|1u;rng^=rng>>16;rng*=2246822519u;rng^=rng>>13;
 vec2 uv=(gl_FragCoord.xy+vec2(random(),random())-.5)/resolution;
 vec3 o=cameraCenter+cameraNormal*cameraDistance;
 vec3 direction=normalize(-cameraNormal*cameraDistance+cameraRight*((uv.x-.5)*film.x)+cameraUp*((uv.y-.5)*film.y));
 vec3 sampleColor=path(o,direction);vec3 old=sampleCount==0?vec3(0):texelFetch(previous,ivec2(gl_FragCoord.xy),0).rgb;
 outColor=vec4(mix(old,sampleColor,1./float(sampleCount+1)),1);
}`;
const displaySource=`#version 300 es
precision highp float;uniform sampler2D image;out vec4 outColor;
void main(){vec3 x=max(vec3(0),texelFetch(image,ivec2(gl_FragCoord.xy),0).rgb*.85);x=clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);x=mix(1.055*pow(x,vec3(1./2.4))-.055,x*12.92,lessThanEqual(x,vec3(.0031308)));outColor=vec4(x,1);}`;
// Conventional GPU rasterization during navigation; path tracing takes over at rest.
const rasterCommon=`
precision highp float;
uniform sampler2D skyMap;
uniform vec3 sunDirection;
uniform float skyRotation;
vec3 sky(vec3 d,float lod){
 vec2 uv=vec2(fract(.5+(atan(d.y,d.x)-skyRotation)/6.28318530718),acos(clamp(d.z,-1.,1.))/3.14159265359);
 vec3 s=textureLod(skyMap,uv,lod).rgb;return mix(pow((s+.055)/1.055,vec3(2.4)),s/12.92,lessThanEqual(s,vec3(.04045)))*2.;
}
vec3 toneMap(vec3 x){x=max(vec3(0),x*.85);x=clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);return mix(1.055*pow(x,vec3(1./2.4))-.055,x*12.92,lessThanEqual(x,vec3(.0031308)));}
`;
const rasterSkySource=`#version 300 es
${rasterCommon}
uniform vec2 resolution,tangent;
uniform vec3 cameraRight,cameraUp,cameraNormal;
out vec4 outColor;
void main(){vec2 p=gl_FragCoord.xy/resolution*2.-1.;vec3 d=normalize(-cameraNormal+cameraRight*p.x*tangent.x+cameraUp*p.y*tangent.y);float sd=dot(d,sunDirection);vec3 c=sky(d,0.)+(1.5*exp((sd-1.)*230.)+(sd>.9994?180.:0.))*vec3(1.,.95,.85);outColor=vec4(toneMap(c),1);}`;
const rasterVertexSource=`#version 300 es
precision highp float;
layout(location=0)in vec3 position;
layout(location=1)in vec3 normal;
layout(location=2)in float material;
uniform vec3 eye,cameraRight,cameraUp,cameraNormal;
uniform vec2 tangent;
out vec3 worldPosition,worldNormal;
flat out int materialId;
void main(){vec3 q=position-eye;float z=-dot(q,cameraNormal);gl_Position=vec4(dot(q,cameraRight)/tangent.x,dot(q,cameraUp)/tangent.y,z*1.000004-.4000008,z);worldPosition=position;worldNormal=normal;materialId=int(material+.5);}`;
const rasterFragmentSource=`#version 300 es
${rasterCommon}
uniform vec3 eye;
uniform vec4 matBase[${materials.length}];
uniform float matRough[${materials.length}];
in vec3 worldPosition,worldNormal;
flat in int materialId;
out vec4 outColor;
void main(){
 vec3 n=normalize(worldNormal),v=normalize(eye-worldPosition);if(dot(n,v)<0.)n=-n;
 vec4 m=matBase[materialId];float r=matRough[materialId],nv=max(.001,dot(n,v)),nl=max(0.,dot(n,sunDirection));
 vec3 f0=mix(vec3(.04),m.rgb,m.a),f=f0+(1.-f0)*pow(1.-nv,5.);
 vec3 ambient=sky(n,5.5)*.6+vec3(.12),reflection=sky(reflect(-v,n),r*6.);
 vec3 c=(1.-m.a)*(1.-f)*m.rgb*(ambient+nl*.7)+reflection*f*(1.-r*.25);
 vec3 h=normalize(v+sunDirection);float nh=max(0.,dot(n,h)),vh=max(0.,dot(v,h)),a2=pow(r,4.),den=nh*nh*(a2-1.)+1.;
 vec3 fs=f0+(1.-f0)*pow(1.-vh,5.);float D=a2/(3.14159265*den*den),G=2.*nv/(nv+sqrt(a2+(1.-a2)*nv*nv))*2.*nl/max(nl+sqrt(a2+(1.-a2)*nl*nl),.0001);
 c+=fs*D*G*.7/max(4.*nv,.001);outColor=vec4(toneMap(c),1);
}`;
function createGPU(canvas){
 const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});if(!gl||!gl.getExtension('EXT_color_buffer_float'))return null;
 function program(fragment,vertex=vertexSource){const p=gl.createProgram();for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);gl.deleteShader(s);}gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}
 const tracer=program(traceSource),display=program(displaySource),vao=gl.createVertexArray();gl.bindVertexArray(vao);
 const loc={};for(const n of ['triangles','nodes','previous','nodeCount','sampleCount','resolution','film','cameraCenter','cameraRight','cameraUp','cameraNormal','matBase[0]','matRough[0]','sunDirection','skyRotation','cameraDistance','skyMap','groundZ'])loc[n]=gl.getUniformLocation(tracer,n);
 const imageLoc=gl.getUniformLocation(display,'image');let skyTex,triTex,nodeTex,frames=[],textures=[],current=0,W=0,H=0,fence=null;
 const skyProgram=program(rasterSkySource),meshProgram=program(rasterFragmentSource,rasterVertexSource),meshVAO=gl.createVertexArray(),meshBuffer=gl.createBuffer();let vertexCount=0;
 const previewLocations=new Map();for(const p of [skyProgram,meshProgram]){const l={};for(const n of ['skyMap','sunDirection','skyRotation','resolution','tangent','eye','cameraRight','cameraUp','cameraNormal','matBase[0]','matRough[0]'])l[n]=gl.getUniformLocation(p,n);previewLocations.set(p,l);}
 gl.bindVertexArray(meshVAO);gl.bindBuffer(gl.ARRAY_BUFFER,meshBuffer);for(const [i,size,off] of [[0,3,0],[1,3,12],[2,1,24]]){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,size,gl.FLOAT,false,28,off);}gl.bindVertexArray(vao);
 let renderer='Device name unavailable';try{const ext=gl.getExtension('WEBGL_debug_renderer_info');renderer=String(gl.getParameter(ext?ext.UNMASKED_RENDERER_WEBGL:gl.RENDERER));}catch{}
 const software=/SwiftShader|llvmpipe|software rasterizer|Microsoft Basic Render Driver/i.test(renderer);
 function tex(w,h,data){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,w,h,0,gl.RGBA,gl.FLOAT,data);return t;}
 function dataTex(data){const h=Math.max(1,Math.ceil(data.length/4096)),padded=new Float32Array(4096*h);padded.set(data);return tex(1024,h,padded);}
 function uploadSky(source){
  if(skyTex)gl.deleteTexture(skyTex);skyTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,skyTex);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  if(source)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,skyAsset.width,skyAsset.height,0,gl.RGBA,gl.UNSIGNED_BYTE,skyRGBA);
  gl.generateMipmap(gl.TEXTURE_2D);
 }
 uploadSky(null);
 function bind(t,unit){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);}
 function sync(){if(fence)gl.deleteSync(fence);fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();}
 return {gl,renderer,software,setSkyImage:uploadSky,
  ready(){if(!fence)return true;const r=gl.clientWaitSync(fence,0,0);if(r===gl.TIMEOUT_EXPIRED)return false;gl.deleteSync(fence);fence=null;return true;},
  setScene(sc){if(triTex)gl.deleteTexture(triTex);if(nodeTex)gl.deleteTexture(nodeTex);triTex=dataTex(sc.t);nodeTex=dataTex(sc.b);gl.useProgram(tracer);gl.uniform1i(loc.nodeCount,sc.count);gl.uniform1f(loc.groundZ,sc.groundZ);
   const a=new Float32Array(sc.t.length/24*21),T=sc.t;let k=0;for(let j=0;j<T.length;j+=24)for(let v=0;v<3;v++){for(let n=0;n<3;n++)a[k++]=T[j+n]+(v?T[j+v*4+n]:0);for(let n=0;n<3;n++)a[k++]=T[j+12+v*4+n];a[k++]=T[j+3];}
   vertexCount=a.length/7;gl.bindBuffer(gl.ARRAY_BUFFER,meshBuffer);gl.bufferData(gl.ARRAY_BUFFER,a,gl.DYNAMIC_DRAW);
  },
  preview(cam,w,h){
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,w,h);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.disable(gl.DEPTH_TEST);gl.clearDepth(1);gl.clear(gl.DEPTH_BUFFER_BIT);
   for(const p of [skyProgram,meshProgram]){const l=previewLocations.get(p);gl.useProgram(p);bind(skyTex,3);gl.uniform1i(l.skyMap,3);gl.uniform3fv(l.sunDirection,lights[0]);gl.uniform1f(l.skyRotation,skyYaw);gl.uniform2f(l.resolution,w,h);gl.uniform2f(l.tangent,cam.film[0]/(2*cam.distance),cam.film[1]/(2*cam.distance));gl.uniform3fv(l.eye,V.add(cam.center,V.mul(cam.normal,cam.distance)));for(const n of ['Right','Up','Normal'])gl.uniform3fv(l['camera'+n],cam[n.toLowerCase()]);
    if(p===skyProgram){gl.bindVertexArray(vao);gl.drawArrays(gl.TRIANGLES,0,3);}else{gl.uniform4fv(l['matBase[0]'],Float32Array.from(materials.flatMap(m=>m.slice(0,4))));gl.uniform1fv(l['matRough[0]'],Float32Array.from(materials.map(m=>m[4])));gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LESS);gl.bindVertexArray(meshVAO);gl.drawArrays(gl.TRIANGLES,0,vertexCount);}
   }gl.disable(gl.DEPTH_TEST);sync();if(gl.getError()!==gl.NO_ERROR)throw Error('GPU preview unavailable');
  },
  reset(cam,w,h){
   if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
   if(w!==W||h!==H){W=w;H=h;canvas.width=w;canvas.height=h;for(const f of frames)gl.deleteFramebuffer(f);for(const t of textures)gl.deleteTexture(t);frames=[];textures=[];
    for(let i=0;i<2;i++){const t=tex(w,h,null),f=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Float buffer unavailable');textures.push(t);frames.push(f);}
   }current=0;gl.useProgram(tracer);gl.uniform2f(loc.resolution,w,h);gl.uniform2fv(loc.film,cam.film);for(const n of ['Center','Right','Up','Normal'])gl.uniform3fv(loc['camera'+n],cam[n.toLowerCase()]);
   gl.uniform4fv(loc['matBase[0]'],Float32Array.from(materials.flatMap(m=>m.slice(0,4))));gl.uniform1fv(loc['matRough[0]'],Float32Array.from(materials.map(m=>m[4])));gl.uniform3fv(loc.sunDirection,lights[0]);gl.uniform1f(loc.skyRotation,skyYaw);gl.uniform1f(loc.cameraDistance,cam.distance);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  },
  sample(n){gl.bindVertexArray(vao);gl.viewport(0,0,W,H);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.useProgram(tracer);gl.bindFramebuffer(gl.FRAMEBUFFER,frames[1-current]);bind(triTex,0);bind(nodeTex,1);bind(textures[current],2);bind(skyTex,3);gl.uniform1i(loc.skyMap,3);gl.uniform1i(loc.triangles,0);gl.uniform1i(loc.nodes,1);gl.uniform1i(loc.previous,2);gl.uniform1i(loc.sampleCount,n);gl.drawArrays(gl.TRIANGLES,0,3);current=1-current;
   gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.useProgram(display);bind(textures[current],0);gl.uniform1i(imageLoc,0);gl.drawArrays(gl.TRIANGLES,0,3);if(fence)gl.deleteSync(fence);fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush();if(n===0&&gl.getError()!==gl.NO_ERROR)throw Error('GPU render unavailable');
  },
  destroy(){if(skyTex)gl.deleteTexture(skyTex);if(fence)gl.deleteSync(fence);for(const f of frames)gl.deleteFramebuffer(f);for(const t of textures)gl.deleteTexture(t);if(triTex)gl.deleteTexture(triTex);if(nodeTex)gl.deleteTexture(nodeTex);gl.deleteBuffer(meshBuffer);gl.deleteVertexArray(meshVAO);gl.deleteVertexArray(vao);for(const p of [tracer,display,skyProgram,meshProgram])gl.deleteProgram(p);}
 };
}
