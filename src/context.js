// Whole-gate context follows the earlier layout model, shifted down so the lock
// centre stays at z=0. Height, hinge placement and wood dimensions remain estimates.
function makeGateContext(){
 const out=[],R=36.5,ri=R-5.334,LH=914.4,H=1809.75,zt=H-R-LH,zb=R-LH,GL=41.5,GR=1311.5,GX=78,HX=1275,HP=1353,front=-55.55,mid=762-LH;
 function mesh(name,key,moving,material,draw){
  const v=[],n=[],t=[];
  const point=(p,normal)=>{const i=v.length/3;v.push(...p);n.push(...normal);return i;};
  const tri=(a,b,c)=>{t.push(a,b,c)};
  const face=(a,b,c,d,normal)=>{const i=[a,b,c,d].map(p=>point(p,normal));tri(i[0],i[1],i[2]);tri(i[0],i[2],i[3]);};
  draw({point,tri,face});out.push({name,group:'context',context:key,partKey:key,moving,material,inferred:false,turn:false,v:Float32Array.from(v),n:Float32Array.from(n),t:Uint16Array.from(t)});return out[out.length-1];
 }
 function box(name,key,moving,material,lo,hi){return mesh(name,key,moving,material,({face})=>{
  const [a,b,c]=lo,[x,y,z]=hi;
  face([a,b,c],[a,b,z],[a,y,z],[a,y,c],[-1,0,0]);face([x,b,c],[x,y,c],[x,y,z],[x,b,z],[1,0,0]);
  face([a,b,c],[x,b,c],[x,b,z],[a,b,z],[0,-1,0]);face([a,y,c],[a,y,z],[x,y,z],[x,y,c],[0,1,0]);
  face([a,b,c],[a,y,c],[x,y,c],[x,b,c],[0,0,-1]);face([a,b,z],[x,b,z],[x,y,z],[a,y,z],[0,0,1]);
 });}
 function tube(name,key,moving,axis,center,low,high,inner=ri,radius=R,segments=64,caps=true){
  return mesh(name,key,moving,moving?1:0,({point,tri,face})=>{
   const index=(r,a,s)=>{const q=axis==='z'?[center[0]+r*Math.cos(a),center[1]+r*Math.sin(a),0]:[0,center[1]+r*Math.cos(a),center[2]+r*Math.sin(a)];q[axis==='z'?2:0]=(s?high:low)(q);return q;};
   for(const [r,inward] of [[radius,false],[inner,true]]){
    if(r<=0)continue;const rows=[];
    for(let i=0;i<=segments;i++){const a=i*2*PI/segments,n=axis==='z'?[Math.cos(a),Math.sin(a),0]:[0,Math.cos(a),Math.sin(a)];rows.push([0,1].map(s=>point(index(r,a,s),V.mul(n,inward?-1:1))));}
    for(let i=0;i<segments;i++){const a=rows[i][0],b=rows[i+1][0],c=rows[i+1][1],d=rows[i][1];if(inward){tri(a,c,b);tri(a,d,c)}else{tri(a,b,c);tri(a,c,d)}}
   }
   if(caps)for(let s=0;s<2;s++)for(let i=0;i<segments;i++){
    const a=i*2*PI/segments,b=(i+1)*2*PI/segments,p=[index(radius,a,s),index(radius,b,s),index(inner,b,s),index(inner,a,s)];if(!s)p.reverse();
    const n=norm(V.cross(V.sub(p[1],p[0]),V.sub(p[3],p[0])));face(...p,n);
   }
  });
 }
 // Preserve the original recessed-window and mitre geometry on the latch tube.
 const decode=(s,Type)=>{const a=Uint8Array.from(atob(s),c=>c.charCodeAt(0));return new Type(a.buffer)};
 out.push({name:'Full gate latch tube with recessed windows',group:'context',context:'fullGate',partKey:'gateTube',moving:true,material:1,inferred:false,turn:false,v:Float32Array.from(decode(fullLatch.v,Int16Array),x=>x/20),n:Float32Array.from(decode(fullLatch.n,Int8Array),x=>x/127),t:decode(fullLatch.t,Uint16Array)});
 tube('Full gate hinge tube','fullGate',true,'z',[HX,0,0],p=>zb-(p[0]-HX),p=>zt+(p[0]-HX),ri,R,64,false);
 tube('Full gate top tube','fullGate',true,'x',[0,0,zt],p=>GX-(p[2]-zt),p=>HX+(p[2]-zt),ri,R,64,false);
 tube('Full gate bottom tube','fullGate',true,'x',[0,0,zb],p=>GX+(p[2]-zb),p=>HX-(p[2]-zb),ri,R,64,false);
 const post=tube('Full fixed latch post','fullPost',false,'z',[0,0,0],()=>-LH,()=>H-LH);post.partKey='postTube';
 tube('Full fixed hinge post','fullPost',false,'z',[HP,0,0],()=>-LH,()=>H-LH);
 tube('Fixed narrow panel top tube','fullPost',false,'x',[0,0,zt],()=>-268.3,()=>0);
 // Cladding covers the outside of the steel frame. Only the lock has a window.
 function boards(x0,x1,count,moving,name,window=false){
  const gap=1.8,w=(x1-x0-(count-1)*gap)/count;
  for(let i=0;i<count;i++){
   const a=x0+i*(w+gap),b=a+w,tag=name+' picket '+(i+1);
   if(window&&a<102&&b>54){
    box(tag+' below lock','pickets',moving,15,[a,front,-LH],[b,-R,-75]);box(tag+' above lock','pickets',moving,15,[a,front,75],[b,-R,H-LH]);
    if(a<54)box(tag+' left of lock','pickets',moving,15,[a,front,-75],[54,-R,75]);if(b>102)box(tag+' right of lock','pickets',moving,15,[102,front,-75],[b,-R,75]);
   }else box(tag,'pickets',moving,15,[a,front,-LH],[b,-R,H-LH]);
  }
  box(name+' exterior fascia','pickets',moving,16,[x0,front-19.05,1828.8-107.95-LH],[x1,front,H-LH]);
  box(name+' top cap','pickets',moving,16,[x0,front-19.05,H-LH],[x1,R+4,1828.8-LH]);
 }
 boards(GL,GR,9,true,'Gate',true);boards(-268.3,R,3,false,'Fixed panel');boards(HP-R,HP+R+70,1,false,'Hinge side');
 for(const z of [155-LH,mid,H-155-LH]){
  box('Gate inside wood rail','pickets',true,16,[GX+R,-R,z-44.45],[HX-R,1.6,z+44.45]);
  box('Fixed panel wood rail','pickets',false,16,[-268.3,-R,z-44.45],[-R,1.6,z+44.45]);
  for(const [a,b] of [[GX+22,GX+58],[HX-58,HX-22]])box('Wood rail tab','fullGate',true,1,[a,2,z-36],[b,6,z+36]);
 }
 // Swept round bars give the pull handles smooth bends and polished highlights.
 for(const [side,base,sign] of [['Inside',3,1],['Outside',front,-1]]){
  const path=[],p=(x,y)=>[x,base+y*sign,mid];
  function curve(a,b,c,d){for(let j=0;j<=16;j++){const t=j/16,u=1-t;path.push([0,1,2].map(k=>a[k]*u*u*u+3*b[k]*u*u*t+3*c[k]*u*t*t+d[k]*t*t*t));}}
  curve(p(240,3),p(260,3),p(260,40),p(284,40));curve(p(646,40),p(670,40),p(670,3),p(690,3));
  mesh(side+' polished copper pull handle','fullGate',true,14,({point,tri})=>{
   const rows=[];for(let i=0;i<path.length;i++){
    const dir=norm(V.sub(path[Math.min(path.length-1,i+1)],path[Math.max(0,i-1)])),u=[0,0,1],v=V.cross(dir,u),row=[];
    for(let j=0;j<=24;j++){const a=2*PI*j/24,n=V.add(V.mul(u,Math.cos(a)),V.mul(v,Math.sin(a)));row.push(point(V.add(path[i],V.mul(n,7)),n));}rows.push(row);
   }
   for(let i=0;i<rows.length-1;i++)for(let j=0;j<24;j++){tri(rows[i][j],rows[i+1][j],rows[i+1][j+1]);tri(rows[i][j],rows[i+1][j+1],rows[i][j+1]);}
  });
  for(const x of [240,690]){
   // Rounded rectangular mounting pads, with a small bevel around each face.
   mesh(side+' copper handle foot','fullGate',true,14,({point,tri})=>{
    const rows=[],levels=[[base,.65],[base+sign*.65,0],[base+sign*4.35,0],[base+sign*5,.65]];
    for(let s=0;s<4;s++){
     const [y,inset]=levels[s],row=[];
     for(let c=0;c<4;c++)for(let j=0;j<=8;j++){
      const a=-PI/2+c*PI/2+j*PI/16,xx=x+([26,26,-26,-26][c])+(6-inset)*Math.cos(a),zz=mid+([-8,8,8,-8][c])+(6-inset)*Math.sin(a),ny=s===0?-sign:s===3?sign:0;
      row.push(point([xx,y,zz],norm([Math.cos(a),ny,Math.sin(a)])));
     }rows.push(row);
    }
    for(let s=0;s<3;s++)for(let i=0;i<rows[0].length;i++){const j=(i+1)%rows[0].length;tri(rows[s][i],rows[s+1][i],rows[s+1][j]);tri(rows[s][i],rows[s+1][j],rows[s][j]);}
    for(const s of [0,3]){const y=levels[s][0],n=[0,s===0?-sign:sign,0],c=point([x,y,mid],n);
     // Separate flat-face vertices keep the pad bevel's smoothing off the face.
     const ids=[];for(let q=0;q<4;q++)for(let j=0;j<=8;j++){const a=-PI/2+q*PI/2+j*PI/16;ids.push(point([x+[26,26,-26,-26][q]+(6-levels[s][1])*Math.cos(a),y,mid+[-8,8,8,-8][q]+(6-levels[s][1])*Math.sin(a)],n));}
     for(let i=0;i<ids.length;i++)tri(c,ids[i],ids[(i+1)%ids.length]);
    }
   });
  }
 }
 // Same estimated hinge centres as the earlier whole-gate model.
 for(const z of [300-LH,H-300-LH]){
  tube('Fixed hinge pin','fullPost',false,'z',[1314,42,0],()=>z-53,()=>z+53,0,7.5,24);
  tube('Moving hinge knuckle','fullGate',true,'z',[1314,42,0],()=>z-20,()=>z+20,8,13,32);
  box('Gate hinge lug','fullGate',true,1,[HX,29,z-14],[1314,49,z+14]);
  for(const [a,b] of [[z-49,z-22],[z+22,z+49]]){tube('Fixed hinge knuckle','fullPost',false,'z',[1314,42,0],()=>a,()=>b,8,13,32);box('Fixed hinge lug','fullPost',false,0,[1314,29,a],[HP,49,b]);}
 }
 return out;
}
