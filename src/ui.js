const stage=root.querySelector('.pg-stage'),gpuCanvas=root.querySelector('[data-gpu]'),cpuImage=root.querySelector('[data-cpu]'),renderStatus=root.querySelector('[data-render-status]'),pauseButton=root.querySelector('[data-pause]'),playButton=root.querySelector('[data-play]'),motion=root.querySelector('[data-motion]'),flyButton=root.querySelector('[data-fly]'),resumeFly=root.querySelector('[data-resume-fly]'),fullscreenButton=root.querySelector('[data-fullscreen]');
const parts=[...unpack(packed),...makeGateContext()],initialPose={stroke:0,angle:0,turn:0};
const partLabels={postTube:'Fixed post',gateTube:'Gate tube',outsidePlate:'Outside plate',insidePlate:'Inside plate',keypad:'Keypad + knob',lockCase:'Inside lock case',actuator:'Inside actuator',bolt:'Sliding bolt',keeper:'Keeper',postStop:'Post stop',gateStop:'Gate stop'};
const partFinishes={postTube:[0],gateTube:[1],outsidePlate:[2],insidePlate:[17],keypad:[8,19,9,20],lockCase:[3],actuator:[7],bolt:[4],keeper:[5],postStop:[6],gateStop:[18]};
const originalRoughness=materials.map(m=>m[4]);
const partVisibility={...Object.fromEntries(Object.keys(partLabels).map(k=>[k,true])),fullGate:false,fullPost:false,pickets:false};
let background=[232,234,237],az=-.35,el=.16,zoom=1,seq=0,quality='balanced',paused=false,playing=false,drag=null,visible=true;
let samples=0,backend='CPU',gpu=null,scene=null,camera=null,sceneDirty=true,renderJob=0,debounce=0,previewJob=0,animationJob=0,lastPose='',imageData=null,accum=null,pixel=0,renderW=0,renderH=0;
let fitPending=true,orbitCenter=[39,0,0],orbitRadius=500,flyMode=true,flyActive=false,flyPosition=[0,-500,0],flySpeed=600,flightJob=0,flightTime=0,locked=false,expanded=false,lastPreviewTime=0;
const held=new Set(),flightKeys=new Set(['KeyW','KeyA','KeyS','KeyD','KeyE','KeyQ','ShiftLeft','ShiftRight','ControlLeft','ControlRight']);
let fullscreenAvailable=typeof root.requestFullscreen==='function'&&document.fullscreenEnabled===true;
function readTheme(){
 const swatch=document.createElement('span');swatch.style.color='var(--background)';swatch.style.display='none';root.appendChild(swatch);const str=getComputedStyle(swatch).color;swatch.remove();const m=str.match(/^rgba?\(([^)]+)\)/);if(m)background=m[1].split(/[,\s]+/).slice(0,3).map(Number);
 materials[13]=[.15,.125,.065,0,.9];
}
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
function sequence(t){
 let u=0,a=0;if(t<1.2)u=0;else if(t<3)u=ease((t-1.2)/1.8);else if(t<13.3)u=1;else if(t<14.9)u=1-ease((t-13.3)/1.6);
 if(t>=4&&t<7.5)a=5*ease((t-4)/3.5);else if(t>=7.5&&t<8.8)a=5;else if(t>=8.8&&t<12.3)a=5*(1-ease((t-8.8)/3.5));return {stroke:18*u,angle:a,turn:90*u};
}
function updateScene(){
 if(sceneDirty){scene=buildScene(parts,initialPose,partVisibility);scene.groundZ=(partVisibility.fullGate||partVisibility.fullPost||partVisibility.pickets)?-914.95:-144.55;sceneDirty=false;lastPose='';root.dataset.visibleTriangles=String(scene.t.length/24);root.dataset.groundZ=String(scene.groundZ);root.dataset.context=JSON.stringify({gate:partVisibility.fullGate,post:partVisibility.fullPost,pickets:partVisibility.pickets});}
 const pose=sequence(seq),key=JSON.stringify(pose);if(key!==lastPose){applyPose(scene,pose);lastPose=key;if(gpu)gpu.setScene(scene);}
 root.querySelector('[data-motion-readout]').textContent=`Bolt ${pose.stroke.toFixed(1)} mm · Gate ${pose.angle.toFixed(1)}°`;
 root.dataset.stroke=String(pose.stroke);root.dataset.angle=String(pose.angle);root.dataset.actuator=String(pose.turn);
}
function axes(){return {right:[Math.cos(az),Math.sin(az),0],up:[-Math.sin(el)*Math.sin(az),Math.sin(el)*Math.cos(az),Math.cos(el)],normal:[Math.cos(el)*Math.sin(az),-Math.cos(el)*Math.cos(az),Math.sin(el)]};}
function viewCamera(w,h){
 const a=axes();if(fitPending){const fit=cameraFor(scene,w,h,az,el,1);orbitCenter=fit.center;orbitRadius=fit.distance;if(flyMode)flyPosition=V.add(fit.center,V.mul(a.normal,fit.distance));fitPending=false;}
 const distance=flyMode?100:orbitRadius/zoom,center=flyMode?V.sub(flyPosition,V.mul(a.normal,distance)):orbitCenter;
 const cam={...a,center,distance,film:[2*distance*Math.tan(PI/8)*w/h,2*distance*Math.tan(PI/8)]};
 root.dataset.cameraPosition=JSON.stringify(V.add(center,V.mul(a.normal,distance)).map(x=>+x.toFixed(3)));root.dataset.cameraDirection=JSON.stringify(a.normal.map(x=>+(-x).toFixed(5)));return cam;
}
function dimensions(maxWidth,dpr=1){const w=stage.clientWidth||736,h=stage.clientHeight||520,ratio=Math.min(dpr,maxWidth/w,Math.sqrt(2073600/(w*h)));return [Math.max(80,Math.round(w*ratio)),Math.max(80,Math.round(h*ratio))];}
function setStatus(text){if(renderStatus.textContent!==text)renderStatus.textContent=text;}
function sampleTarget(){return quality==='ultra'?2048:quality==='sharp'?1024:256;}
function announce(text){root.querySelector('[data-announcement]').textContent=text;}
function deviceLabel(){return gpu?(gpu.software?'WebGL software':'GPU'):'CPU';}
function graphicsStatus(){
 backend=gpu?'GPU':'CPU';root.dataset.backend=backend;root.querySelector('[data-graphics-label]').textContent=gpu?(gpu.software?'Graphics: WebGL software':'Graphics: GPU · WebGL2'):'Graphics: CPU fallback';
 root.querySelector('[data-device]').textContent=gpu?gpu.renderer:'WebGL2 unavailable in this view. CPU rendering is active.';
 root.dataset.renderer=gpu?gpu.renderer:'CPU';
}
function showProgress(){root.dataset.samples=String(samples);setStatus(`${deviceLabel()} path tracing · ${samples} samples · ${renderW} × ${renderH}${samples>=sampleTarget()?' · Complete':''}`);}
function moving(){return !!drag||playing||(flyActive&&held.size>0);}
function stopRender(){cancelAnimationFrame(renderJob);renderJob=0;clearTimeout(debounce);}
function dropGPU(e){root.dataset.gpuFallback=String(e?.message||e||'WebGL2 unavailable');try{gpu?.destroy()}catch{}gpu=null;graphicsStatus();}
function preview(){
 stopRender();if(!visible||!root.isConnected)return;
 if(gpu&&!gpu.ready()){previewJob=requestAnimationFrame(()=>{previewJob=0;preview();});return;}
 samples=0;root.dataset.samples='0';updateScene();
 if(gpu){const [w,h]=dimensions(quality==='ultra'?1920:quality==='sharp'?1440:960,Math.min(2,devicePixelRatio||1));camera=viewCamera(w,h);try{gpu.preview(camera,w,h);cpuImage.style.display='none';gpuCanvas.style.display='block';root.dataset.previewBackend='GPU';}catch(e){dropGPU(e);}}
 if(!gpu){const [w,h]=dimensions(320);camera=viewCamera(w,h);cpuImage.src=fastPreview(scene,camera,w,h);cpuImage.style.display='block';gpuCanvas.style.display='none';root.dataset.previewBackend='CPU';}
 const now=performance.now(),fps=lastPreviewTime?Math.min(999,Math.round(1000/(now-lastPreviewTime))):0;lastPreviewTime=now;
 setStatus(paused?`${deviceLabel()} preview · Refinement paused`:moving()?`${deviceLabel()} preview${fps?' · '+fps+' fps':''}`:`${deviceLabel()} preview · Refining shortly…`);
 if(!moving()&&!paused&&visible)debounce=setTimeout(startRefining,250);
}
function requestPreview(){stopRender();samples=0;root.dataset.samples='0';if(previewJob)return;previewJob=requestAnimationFrame(()=>{previewJob=0;preview();});}
function cpuStart(){
 backend='CPU';[renderW,renderH]=dimensions(quality==='ultra'?560:quality==='sharp'?440:320);camera=viewCamera(renderW,renderH);samples=0;pixel=0;
 accum=new Float32Array(renderW*renderH*3);imageData=new Uint8ClampedArray(renderW*renderH*4);for(let i=3;i<imageData.length;i+=4)imageData[i]=255;
 gpuCanvas.style.display='none';cpuImage.style.display='block';setStatus('CPU path tracing · First sample…');root.dataset.backend=backend;renderJob=requestAnimationFrame(cpuTick);
}
let seed=42;function random(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;}
function cpuTick(){
 renderJob=0;if(paused||moving()||!visible||!root.isConnected)return;
 const start=performance.now(),total=renderW*renderH;
 do{const limit=Math.min(total,pixel+64);for(;pixel<limit;pixel++){
  seed=((pixel*1973+(samples+1)*26699)|1);seed^=seed>>>16;seed=Math.imul(seed,2246822519);seed^=seed>>>13;
  const x=pixel%renderW,y=Math.floor(pixel/renderW),sx=((x+random())/renderW-.5)*camera.film[0],sy=(.5-(y+random())/renderH)*camera.film[1],ray=cameraRay(camera,sx,sy),c=path(scene,ray.o,ray.d,random);
  for(let k=0;k<3;k++){accum[pixel*3+k]+=c[k];imageData[pixel*4+k]=tone(accum[pixel*3+k]/(samples+1));}
 }if(pixel===total){samples++;pixel=0;cpuImage.src=bitmapURL(imageData,renderW,renderH);showProgress();break;}}while(performance.now()-start<11);
 if(samples<sampleTarget())renderJob=requestAnimationFrame(cpuTick);
}
function gpuTick(){
 renderJob=0;if(paused||moving()||!visible||!root.isConnected)return;
 try{if(!gpu.ready()){renderJob=requestAnimationFrame(gpuTick);return;}gpu.sample(samples);samples++;cpuImage.style.display='none';gpuCanvas.style.display='block';showProgress();if(samples<sampleTarget())renderJob=requestAnimationFrame(gpuTick);}
 catch(e){dropGPU(e);cpuStart();}
}
function startRefining(){
 if(paused||moving()||!visible||!root.isConnected)return;
 if(gpu&&!gpu.ready()){debounce=setTimeout(startRefining,20);return;}updateScene();samples=0;
 if(gpu){backend='GPU';[renderW,renderH]=dimensions(quality==='ultra'?1920:quality==='sharp'?1440:960,Math.min(2,devicePixelRatio||1));camera=viewCamera(renderW,renderH);try{gpu.reset(camera,renderW,renderH);setStatus(`${deviceLabel()} path tracing · First sample…`);renderJob=requestAnimationFrame(gpuTick);return;}catch(e){dropGPU(e);}}
 cpuStart();
}
function stopPlaying(){playing=false;cancelAnimationFrame(animationJob);playButton.textContent='Play mechanism';}
function clearPreset(){root.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed','false'));}
function controlsHint(){
 root.dataset.mode=flyMode?'fly':'orbit';root.dataset.flyActive=String(flyActive);root.dataset.mouseCapture=locked?'locked':root.dataset.pointerFallback?'drag':'available';
 flyButton.setAttribute('aria-pressed',String(flyMode));flyButton.textContent=flyMode?'Exit fly':'Start fly (WASD)';resumeFly.hidden=!flyMode||flyActive;
 root.querySelector('[data-flight-speed]').hidden=!flyMode;stage.classList.toggle('pg-flying',flyMode);stage.classList.toggle('pg-aiming',flyActive);
 root.querySelector('[data-controls-hint]').textContent=flyMode?(flyActive?`WASD move · Shift/E screen-up · Ctrl/Q screen-down · ${locked?'Mouse aim':'Drag to aim'} · Esc release`:'Fly mode · Click the view to use WASD'):'Drag to orbit · Scroll to zoom · Start fly for WASD';
}
function clearFlight(){held.clear();cancelAnimationFrame(flightJob);flightJob=0;flightTime=0;}
function pauseFlight(){clearFlight();flyActive=false;drag=null;if(document.pointerLockElement===stage)document.exitPointerLock();controlsHint();requestPreview();}
function exitFly(){
 if(!flyMode)return;const a=axes();orbitRadius=200;zoom=1;orbitCenter=V.sub(flyPosition,V.mul(a.normal,orbitRadius));flyMode=false;pauseFlight();
}
function pointerFallback(){if(!flyMode||!flyActive)return;root.dataset.pointerFallback='true';controlsHint();announce('Mouse capture is unavailable here. Drag to aim; WASD moves, Shift or E moves toward the top of the view, and Control or Q toward the bottom.');}
function captureMouse(){
 if(document.pointerLockElement===stage)return;
 if(root.dataset.pointerFallback==='true'){controlsHint();return;}
 if(typeof stage.requestPointerLock!=='function'){pointerFallback();return;}
 try{const p=stage.requestPointerLock();if(p&&typeof p.catch==='function')p.catch(pointerFallback);}catch{pointerFallback();}
}
function focusFlight(){flyButton.focus({preventScroll:true});}
function activateFly(){
 stopPlaying();clearPreset();if(!flyMode){updateScene();const [w,h]=dimensions(960),cam=viewCamera(w,h);flyPosition=V.add(cam.center,V.mul(cam.normal,cam.distance));flyMode=true;}
 flyActive=true;controlsHint();focusFlight();captureMouse();requestPreview();
}
flyButton.addEventListener('click',()=>{if(flyMode)exitFly();else activateFly();});resumeFly.addEventListener('click',e=>{e.stopPropagation();activateFly();});
document.addEventListener('pointerlockchange',()=>{const was=locked;locked=document.pointerLockElement===stage;if(locked){flyActive=true;drag=null;stage.classList.remove('pg-dragging');delete root.dataset.pointerFallback;}else if(was){clearFlight();flyActive=false;drag=null;}controlsHint();requestPreview();});
document.addEventListener('pointerlockerror',pointerFallback);
function look(dx,dy){if(!dx&&!dy)return;az-=dx*.0026;el=Math.max(-1.54,Math.min(1.54,el+dy*.0026));clearPreset();requestPreview();}
document.addEventListener('mousemove',e=>{if(flyMode&&flyActive&&locked)look(e.movementX,e.movementY);});
function flightTick(now){
 flightJob=0;if(!flyMode||!flyActive||!held.size||!visible||!root.isConnected){flightTime=0;return;}
 const dt=flightTime?Math.min(.12,(now-flightTime)/1000):0;flightTime=now;
 const a=axes(),forward=Number(held.has('KeyW'))-Number(held.has('KeyS')),side=Number(held.has('KeyD'))-Number(held.has('KeyA')),vertical=Number(held.has('ShiftLeft')||held.has('ShiftRight')||held.has('KeyE'))-Number(held.has('ControlLeft')||held.has('ControlRight')||held.has('KeyQ'));
 const d=V.add(V.add(V.mul(a.normal,-forward),V.mul(a.right,side)),V.mul(a.up,vertical));if(Math.hypot(...d)>0){flyPosition=V.add(flyPosition,V.mul(norm(d),flySpeed*dt));clearPreset();requestPreview();}
 flightJob=requestAnimationFrame(flightTick);
}
function movementCode(e){
 if(flightKeys.has(e.code))return e.code;
 const key=String(e.key||'').toLowerCase();
 return ({w:'KeyW',a:'KeyA',s:'KeyS',d:'KeyD',e:'KeyE',q:'KeyQ',shift:e.location===2?'ShiftRight':'ShiftLeft',control:e.location===2?'ControlRight':'ControlLeft'})[key]||'';
}
document.addEventListener('keydown',e=>{
 if((e.code==='Escape'||e.key==='Escape')&&(flyActive||expanded)){if(flyActive)pauseFlight();if(expanded){expanded=false;root.dataset.expanded='false';fullscreenChanged();}return;}
 const code=movementCode(e);
 if(!flyMode||!flyActive||!code||e.altKey||e.metaKey||e.isComposing||(!locked&&(!root.contains(document.activeElement)||e.target.closest?.('input,select,textarea,[contenteditable="true"]'))))return;
 e.preventDefault();e.stopPropagation();held.add(code);stopRender();if(!flightJob)flightJob=requestAnimationFrame(flightTick);
},true);
document.addEventListener('keyup',e=>{const code=movementCode(e);if(!held.has(code))return;e.preventDefault();e.stopPropagation();held.delete(code);if(!held.size){clearFlight();requestPreview();}},true);
root.querySelector('[data-speed]').addEventListener('change',e=>{flySpeed=Number(e.target.value);});
document.addEventListener('pointerdown',e=>{if(flyActive&&!stage.contains(e.target)&&e.target!==flyButton)pauseFlight();});
document.addEventListener('focusin',e=>{if(flyActive&&!locked&&e.target!==flyButton&&e.target!==resumeFly)pauseFlight();});
window.addEventListener('blur',()=>{if(flyActive)pauseFlight();else clearFlight();});
function fullscreenChanged(){
 const full=document.fullscreenElement===root;root.dataset.fullscreen=String(full);root.dataset.fullscreenAvailable=String(fullscreenAvailable);fullscreenButton.textContent=full?'Exit fullscreen':expanded?'Collapse view':fullscreenAvailable?'Fullscreen':'Expand view';fullscreenButton.setAttribute('aria-pressed',String(full||expanded));
 root.querySelector('[data-display-note]').textContent=fullscreenAvailable?'':expanded?'Larger inline view · Fullscreen requires the browser version':'Embedded view · Fullscreen unavailable';
 requestPreview();
}
fullscreenButton.addEventListener('click',async()=>{
 if(document.fullscreenElement===root){try{await document.exitFullscreen();}catch{}return;}
 if(expanded){expanded=false;root.dataset.expanded='false';fullscreenChanged();return;}
 try{if(!fullscreenAvailable)throw Error('Fullscreen not allowed');await root.requestFullscreen({navigationUI:'hide'});}
 catch{fullscreenAvailable=false;expanded=true;root.dataset.expanded='true';fullscreenChanged();announce('This embedded view cannot enter fullscreen. The view is enlarged; use the browser version for fullscreen.');}
});
document.addEventListener('fullscreenchange',fullscreenChanged);
root.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
 stopPlaying();if(flyActive)pauseFlight();az=button.dataset.view==='outside'?-.35:2.72;el=button.dataset.view==='top'?1.10:.16;zoom=1;seq=button.dataset.view==='open'?8:0;motion.value=String(seq);fitPending=true;
 root.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));lastPose='';requestPreview();
}));
pauseButton.addEventListener('click',()=>{paused=!paused;pauseButton.textContent=paused?'Resume rendering':'Pause rendering';pauseButton.setAttribute('aria-pressed',String(paused));if(paused){stopRender();setStatus(`${deviceLabel()} rendering paused · ${samples} samples`);}else if(samples>0&&samples<sampleTarget()){renderJob=requestAnimationFrame(gpu?gpuTick:cpuTick);}else requestPreview();});
playButton.addEventListener('click',()=>{
 if(playing){stopPlaying();requestPreview();return;}
 if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){seq=seq<3?3.5:seq<8?8:0;motion.value=seq;lastPose='';requestPreview();return;}
 stopRender();if(seq>=15.95)seq=0;playing=true;playButton.textContent='Pause mechanism';let before=performance.now();
 function tick(now){if(!playing||!root.isConnected)return;if(now-before<(gpu?33:100)){animationJob=requestAnimationFrame(tick);return;}seq=Math.min(16,seq+(now-before)/1000);before=now;motion.value=String(seq);requestPreview();if(seq>=16){stopPlaying();requestPreview();}else animationJob=requestAnimationFrame(tick);}
 animationJob=requestAnimationFrame(tick);
});
motion.addEventListener('input',()=>{stopPlaying();seq=Number(motion.value);lastPose='';requestPreview();});
root.querySelector('[data-light]').addEventListener('input',e=>{setLights(Number(e.target.value));root.querySelector('[data-light-readout]').textContent=e.target.value+'°';requestPreview();});
const partsBox=root.querySelector('[data-parts]');for(const [key,label] of Object.entries(partLabels)){
 const item=document.createElement('div');
 const row=document.createElement('label');row.className='form-check';const input=document.createElement('input');input.type='checkbox';input.checked=true;input.className='form-check-input';input.dataset.part=key;const text=document.createElement('span');text.className='form-check-label';text.textContent=label;row.append(input,text);item.appendChild(row);
 const ids=partFinishes[key],initial=Math.round((1-originalRoughness[ids[0]])*100);
 const caption=document.createElement('label');caption.className='form-label text-small pg-finish-label';caption.htmlFor=root.id+'-shine-'+key;
 const output=document.createElement('output');output.className='tabular-nums';output.value=initial+'%';caption.append('Shininess',output);
 const slider=document.createElement('input');slider.type='range';slider.className='form-range';slider.id=caption.htmlFor;slider.dataset.shininess=key;slider.min='0';slider.max='100';slider.step='1';slider.value=String(initial);slider.setAttribute('aria-label',label+' shininess');slider.setAttribute('aria-valuetext',initial+'% shininess');output.htmlFor=slider.id;
 slider.addEventListener('input',()=>{
  const value=Number(slider.value),delta=(value-initial)/100;
  for(const id of ids)materials[id][4]=Math.max(.04,Math.min(1,originalRoughness[id]-delta));
  output.value=value+'%';slider.setAttribute('aria-valuetext',value+'% shininess');requestPreview();
 });
 item.append(caption,slider);partsBox.appendChild(item);
 input.addEventListener('change',()=>{partVisibility[key]=input.checked;sceneDirty=true;root.querySelector('[data-part-count]').textContent=String(Object.keys(partLabels).filter(k=>partVisibility[k]).length);requestPreview();});
}
root.querySelectorAll('[data-context]').forEach(input=>input.addEventListener('change',()=>{partVisibility[input.dataset.context]=input.checked;sceneDirty=true;if(!flyMode){fitPending=true;zoom=1;}requestPreview();}));
root.querySelector('[data-quality]').addEventListener('change',e=>{quality=e.target.value;requestPreview();});
stage.addEventListener('pointerdown',e=>{
 if(e.target.closest('button')||e.button!==0)return;
 stopPlaying();stopRender();if(flyMode){e.preventDefault();focusFlight();flyActive=true;controlsHint();if(locked||document.pointerLockElement===stage)return;drag={x:e.clientX,y:e.clientY,fly:true};}else drag={x:e.clientX,y:e.clientY,az,el};
 stage.setPointerCapture(e.pointerId);stage.classList.add('pg-dragging');
 if(flyMode)captureMouse();
});
stage.addEventListener('pointermove',e=>{if(!drag)return;if(drag.fly){look(e.clientX-drag.x,e.clientY-drag.y);drag.x=e.clientX;drag.y=e.clientY;}else{az=drag.az+(e.clientX-drag.x)*.008;el=Math.max(-1.54,Math.min(1.54,drag.el+(e.clientY-drag.y)*.008));clearPreset();requestPreview();}});
function release(){if(!drag)return;drag=null;stage.classList.remove('pg-dragging');requestPreview();}
stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',release);stage.addEventListener('lostpointercapture',release);
stage.addEventListener('wheel',e=>{e.preventDefault();if(flyMode){flyPosition=V.add(flyPosition,V.mul(axes().normal,e.deltaY*.25));}else zoom=Math.max(.08,Math.min(30,zoom*Math.exp(-e.deltaY*.001)));requestPreview();},{passive:false});
gpuCanvas.addEventListener('webglcontextlost',e=>{e.preventDefault();stopRender();gpu=null;root.dataset.gpuFallback='WebGL context lost';graphicsStatus();requestPreview();});
gpuCanvas.addEventListener('webglcontextrestored',()=>{try{gpu=createGPU(gpuCanvas);if(gpu&&skyImage.complete&&skyImage.naturalWidth)gpu.setSkyImage(skyImage);lastPose='';}catch(e){dropGPU(e);}graphicsStatus();requestPreview();});
let lastSize='';if(typeof ResizeObserver==='function')new ResizeObserver(()=>{const k=stage.clientWidth+':'+stage.clientHeight;if(k!==lastSize){lastSize=k;requestPreview();}}).observe(stage);
if(typeof IntersectionObserver==='function')new IntersectionObserver(entries=>{const was=visible;visible=entries[0].isIntersecting;if(!visible){stopRender();stopPlaying();if(flyActive)pauseFlight();}else if(!was&&!paused)requestPreview();}).observe(stage);
if(typeof MutationObserver==='function')new MutationObserver(()=>{readTheme();requestPreview();}).observe(document.documentElement,{attributes:true,attributeFilter:['class','style','data-theme']});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopRender();stopPlaying();if(flyActive)pauseFlight();}else if(!paused)requestPreview();});
readTheme();try{gpu=createGPU(gpuCanvas);}catch(e){dropGPU(e);}graphicsStatus();controlsHint();fullscreenChanged();
root.dataset.actuatorBars=String(parts.filter(p=>p.group==='actuator').length);root.dataset.triangleCount=String(parts.reduce((s,p)=>s+p.t.length/3,0));preview();
const skyImage=new Image();skyImage.onload=()=>{if(gpu){try{gpu.setSkyImage(skyImage);requestPreview();}catch{root.dataset.skyTextureFallback='true';}}};skyImage.src=skyAsset.url;
