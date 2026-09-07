import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { createBird, poseBird } from './bird.mjs';

const W=1920,H=1080, TAU=Math.PI*2;
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const clamp=(x)=>Math.max(0,Math.min(1,x));
const smooth=(x)=>{x=clamp(x);return x*x*(3-2*x);};
const mix=(a,b,t)=>a+(b-a)*t;
let seed=5417;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const range=(a,b)=>mix(a,b,random());
const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('film'),antialias:true,alpha:false,preserveDrawingBuffer:true});
renderer.setSize(W,H,false);renderer.setPixelRatio(1);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const camera=new THREE.PerspectiveCamera(43,W/H,.1,400);
const composer=new EffectComposer(renderer);
const renderPass=new RenderPass(new THREE.Scene(),camera);composer.addPass(renderPass);
const dof=new BokehPass(renderPass.scene,camera,{focus:6,aperture:.0025,maxblur:.012});composer.addPass(dof);
const bloom=new UnrealBloomPass(new THREE.Vector2(W,H),.3,.65,1.15);composer.addPass(bloom);composer.addPass(new OutputPass());
const sphere=new THREE.SphereGeometry(1,20,14), lowSphere=new THREE.IcosahedronGeometry(1,1);
const materials=new Map();
function mat(color,roughness=.8,metalness=0){const key=`${color}/${roughness}/${metalness}`;if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness,metalness}));return materials.get(key);}
function ell(parent,color,p,s,rough=.8,geo=sphere){const m=new THREE.Mesh(geo,mat(color,rough));m.position.set(...p);m.scale.set(...s);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function tube(parent,pts,r,color,segments=24){const c=new THREE.CatmullRomCurve3(pts.map(p=>V(...p)));const m=new THREE.Mesh(new THREE.TubeGeometry(c,segments,r,7,false),mat(color));m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
function sky(scene,top,bottom,sunPos,sunColor=0xffdfaa){
 const sun=V(...sunPos).normalize();
 const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{top:{value:new THREE.Color(top)},bottom:{value:new THREE.Color(bottom)},sun:{value:sun},sunColor:{value:new THREE.Color(sunColor)}},vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'varying vec3 p;uniform vec3 top;uniform vec3 bottom;uniform vec3 sun;uniform vec3 sunColor;void main(){vec3 d=normalize(p);float h=smoothstep(-.24,.38,d.y);vec3 c=mix(bottom,top,h);float s=max(dot(d,sun),0.);c+=sunColor*pow(s,28.)*.25+sunColor*pow(s,320.)*.5+sunColor*pow(s,2500.)*2.;gl_FragColor=vec4(c,1.);}'});
 const dome=new THREE.Mesh(new THREE.SphereGeometry(230,32,24),material);scene.add(dome);
}
function base(top,bottom,fog,sunPos=[-20,30,-50],sunColor=0xffdeb1){
 const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(fog,.013);sky(scene,top,bottom,sunPos,sunColor);
 scene.add(new THREE.HemisphereLight(0xe8f8ff,0x314735,1.25));
 const key=new THREE.DirectionalLight(sunColor,3.2);key.position.set(...sunPos);key.castShadow=true;key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-25,right:25,top:25,bottom:-25,near:.1,far:160});key.shadow.bias=-.0008;key.shadow.normalBias=.025;scene.add(key);
 const fill=new THREE.DirectionalLight(0x8ed6d9,1.2);fill.position.set(5,8,15);scene.add(fill);
 return {scene,key,fill,movers:[],birds:[],clouds:[],water:null};
}
const leafGeometry=(()=>{const sh=new THREE.Shape();sh.moveTo(0,0);sh.bezierCurveTo(.6,.35,.6,1.2,0,1.9);sh.bezierCurveTo(-.6,1.2,-.6,.35,0,0);const g=new THREE.ShapeGeometry(sh,10);const pos=g.attributes.position;for(let i=0;i<pos.count;i++){const y=pos.getY(i);pos.setZ(i,Math.sin(y/1.9*Math.PI)*.17+Math.abs(pos.getX(i))*.15);}g.computeVertexNormals();return g;})();
const leafMats=[0x246e55,0x3c9564,0x78ac63,0x1e6759,0x629e78].map(c=>new THREE.MeshStandardMaterial({color:c,side:THREE.DoubleSide,roughness:.68}));
function plant(parent,x,y,z,size=1,kind=0){
 const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(size);parent.add(g);
 for(let j=0;j<(kind?9:6);j++){const angle=j*2.4;const stem=new THREE.Group();stem.rotation.set(range(-.2,.2),angle,range(.15,.8));g.add(stem);if(kind){for(let k=0;k<7;k++){for(const sign of [-1,1]){const l=new THREE.Mesh(leafGeometry,leafMats[(j+k)%5]);l.position.set(sign*.02,k*.25,0);l.rotation.z=sign*(-1.05);l.scale.set(.32*(1-k*.085),.45*(1-k*.08),.4);stem.add(l);}}}else{const l=new THREE.Mesh(leafGeometry,leafMats[j%5]);l.rotation.x=-.25;l.scale.set(.75,range(.8,1.3),.8);stem.add(l);}}
 return g;
}
function flower(parent,x,y,z,s=1,color=0xf3b38b){
 const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(s);parent.add(g);tube(g,[[0,0,0],[.06,.5,0],[0,1,0]],.025,0x42694b,10);
 for(let j=0;j<6;j++){const a=j*TAU/6;const p=ell(g,color,[Math.sin(a)*.22,1.05,Math.cos(a)*.22],[.18,.1,.36],.5);p.rotation.y=a;}
 ell(g,0xf8d26d,[0,1.12,0],[.16,.12,.16],.45);return g;
}
function rock(parent,x,y,z,s,color=0x547b71){return ell(parent,color,[x,y,z],[s,s*.65,s*.8],1,lowSphere);}
function cloud(world,x,y,z,s=1,color=0xffedda){
 const g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(s);world.scene.add(g);
 for(let i=0;i<7;i++)ell(g,color,[range(-2.5,2.5),range(-.3,.6),range(-1.1,1.1)],[range(1,2.4),range(.7,1.4),range(.9,1.6)],1,sphere).castShadow=false;
 world.clouds.push({g,x,z});return g;
}
function dust(world,count,color=0xffe3ad,spread=22){
 const positions=new Float32Array(count*3);for(let i=0;i<count;i++){positions[i*3]=range(-spread,spread);positions[i*3+1]=range(.3,12);positions[i*3+2]=range(-spread,spread);}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
 const points=new THREE.Points(geo,new THREE.PointsMaterial({color,size:.045,transparent:true,opacity:.6,sizeAttenuation:true,depthWrite:false}));world.scene.add(points);world.dust=points;
}
function terrain(world,color=0x3b765b){
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(220,220),mat(color));ground.rotation.x=-Math.PI/2;ground.position.y=-1;ground.receiveShadow=true;world.scene.add(ground);
}
function tree(world,x,z,s=1){
 const g=new THREE.Group();g.position.set(x,-1,z);g.scale.setScalar(s);world.scene.add(g);
 tube(g,[[0,0,0],[-.2,3,0],[.15,6,.1],[0,10,0]],.24,0x455044);
 for(let j=0;j<4;j++){const a=j*2.4;const ex=Math.cos(a)*2.5,ez=Math.sin(a)*2.5;tube(g,[[0,4+j,0],[ex*.5,6+j,ez*.5],[ex,7+j,ez]],.1,0x475848,12);ell(g,[0x2d6651,0x327355,0x548763][j%3],[ex,8+j,ez],[2.4,1.3,2.2],1,lowSphere);}
 return g;
}
function water(world,color){
 const geo=new THREE.PlaneGeometry(200,200,100,100);geo.rotateX(-Math.PI/2);
 const material=new THREE.ShaderMaterial({uniforms:{time:{value:0},base:{value:new THREE.Color(color)},light:{value:new THREE.Color(0xfce6bd)}},vertexShader:'uniform float time;varying vec3 p;void main(){p=position;vec3 v=position;v.y+=sin(v.x*.5+time)*.04+sin(v.z*.8+time*1.3)*.025;gl_Position=projectionMatrix*modelViewMatrix*vec4(v,1.);}',fragmentShader:'uniform float time;uniform vec3 base;uniform vec3 light;varying vec3 p;void main(){float w=sin(p.x*5.+sin(p.z*1.8+time)*2.+time*1.3)*sin(p.z*12.-time*2.);float gleam=pow(max(w,0.),18.)*.45;float broad=sin(p.x*.24+p.z*.31+time*.25)*.07;float reflect=exp(-pow((p.x-4.-sin(p.z*.4+time)*1.5)/6.,2.))*.1;gl_FragColor=vec4(base*(1.+broad)+light*(gleam+reflect),1.);}'});
 const m=new THREE.Mesh(geo,material);m.position.y=-.5;world.scene.add(m);world.water=material;return m;
}
function mountain(world,x,y,z,s,color){const g=rock(world.scene,x,y,z,s,color);g.scale.set(s,s*1.6,s*.85);g.rotation.y=range(0,6);return g;}
function addHero(world,variant='hero',detail=true){const b=createBird(THREE,{variant,detail});world.scene.add(b);world.birds.push(b);return b;}

// Forest: arching trunks, fern silhouettes, flowering moss and floating pollen.
const forest=base(0x4d8986,0xeed2a2,0x6c9980,[-12,27,-16]);forest.scene.fog.density=.026;terrain(forest,0x315744);
for(let i=0;i<54;i++){const x=range(-30,42),z=range(-27,20);if(Math.abs(z)>4||x<-5)tree(forest,x,z,range(.6,1.6));}
for(let i=0;i<22;i++){tree(forest,-65+i*6,-38,range(1.1,2.1));ell(forest.scene,0x578975,[-65+i*6,-1,-52],[9,5+Math.sin(i)*2,6],1,lowSphere);}
for(let i=0;i<135;i++){let x=range(-18,38),z=range(-15,12);if(Math.abs(z)<2)z+=5;const p=plant(forest.scene,x,-.95,z,range(.45,1.7),i%3===0);if(i%8===0)forest.movers.push(p);}
for(let i=0;i<32;i++){const x=range(-8,12),z=range(-6,7);flower(forest.scene,x,-.9,z,range(.4,1.1),i%2?0xf2c98a:0xe1a09e);}
const branch=tube(forest.scene,[[-6,.65,-1],[-3,1.15,-.3],[0,1.6,0],[2,1.3,.1],[4,1.7,0]],.16,0x675842,40);
for(let i=0;i<13;i++){const x=range(-5,4);ell(forest.scene,0x68966b,[x,1.52-.055*Math.abs(x),0],[.35,.09,.2]);}
flower(forest.scene,1.5,1.34,.08,.45);plant(forest.scene,-2,1.1,-.2,.55);
dust(forest,160);const heroForest=addHero(forest);heroForest.position.set(0,2.08,0);

// The river is an open blue-green ribbon between ochre stones and reeds.
const river=base(0x659da7,0xffe2b5,0xb6d6c4,[-35,32,-45]);water(river,0x248f92);
for(let i=0;i<58;i++){const x=range(-35,55),sign=i%2?1:-1,z=sign*range(5.5,18);rock(river.scene,x,-.45,z,range(1,3.2),[0x91ab83,0xbfb990,0x688f78][i%3]);plant(river.scene,x,.2,z,range(.6,1.6),i%3===0);}
for(let i=0;i<10;i++)mountain(river,-60+i*16,0,-42,range(5,10),0x75a995);
for(let i=0;i<15;i++)cloud(river,range(-65,80),range(22,35),range(-70,-25),range(1,2));
const heroRiver=addHero(river),friendRiver=addHero(river,'gold');

// Coral flamingos inhabit a shallow rose lagoon.
const lagoon=base(0x80b5bd,0xfbd0b3,0xe7bea9,[-25,30,-60],0xffddbd);water(lagoon,0xb0777e);
function flamingo(x,z,s,phase){
 const g=new THREE.Group();g.position.set(x,-.42,z);g.scale.setScalar(s);lagoon.scene.add(g);
 const neck=new THREE.Group();neck.position.set(.42,2,0);g.add(neck);
 tube(neck,[[0,0,0],[-.05,.75,0],[.3,1.5,0],[.75,1.45,0],[.8,1.02,0]],.10,0xf0a099,26);
 ell(neck,0xffb2a3,[.79,1.05,0],[.19,.25,.17],.55);
 tube(neck,[[.84,1.03,0],[1.04,.89,0],[.99,.69,0]],.072,0xede0be,10);ell(neck,0x37373b,[1.0,.71,0],[.082,.12,.074]);
 for(const sign of [-1,1]){ell(neck,0x282e33,[.85,1.12,sign*.153],[.028,.032,.018],.18);tube(g,[[-.05,1.8,sign*.23],[.05,.9,sign*.24],[.0,.0,sign*.24]],.035,0xac6c63,12);tube(g,[[0,.03,sign*.24],[.23,.015,sign*.24]],.025,0x905b54,7);}
 ell(g,0xf49791,[0,1.95,0],[.75,.43,.44],.7);ell(g,0xdc7b80,[-.08,2.01,.36],[.57,.30,.12]);
 for(let i=0;i<8;i++){const p=ell(g,i%2?0xf4a096:0xe58787,[-.5+i*.11,1.94,.39],[.27,.095,.065]);p.rotation.z=-.35;}
 const reflection=new THREE.Mesh(new THREE.CircleGeometry(.7,32),new THREE.MeshBasicMaterial({color:0xfac5b0,transparent:true,opacity:.09,depthWrite:false}));reflection.rotation.x=-Math.PI/2;reflection.position.set(x,-.445,z);reflection.scale.set(1,3,1);lagoon.scene.add(reflection);
 lagoon.movers.push({g,neck,phase});return g;
}
for(let i=0;i<23;i++)flamingo(range(-18,26),range(-12,7),range(.75,1.12),range(0,TAU));
for(let i=0;i<18;i++){const x=range(-40,55);rock(lagoon.scene,x,-.6,-17,range(1.4,3.8),0xcaa08a);}
for(let i=0;i<9;i++)cloud(lagoon,range(-60,65),range(22,38),range(-75,-45),range(1.8,3),0xffe6cc);
for(let i=0;i<16;i++)mountain(lagoon,-85+i*11,-6,-55,range(4,8),0xb7ad9f);
const heroLagoon=addHero(lagoon);

// Storm is deliberately brief: rain, deep slate clouds, a determined upward turn.
const storm=base(0x263950,0x627b89,0x657a87,[-20,22,-50],0xcbd4db);storm.scene.fog.density=.018;storm.key.intensity=1.9;storm.fill.intensity=1.5;
for(let i=0;i<55;i++)cloud(storm,range(-55,65),range(-8,35),range(-65,20),range(1.5,4),[0x687d89,0x7b8e94,0x566979][i%3]);
const rainPositions=new Float32Array(1100*6);for(let i=0;i<1100;i++){const x=range(-22,30),y=range(-5,26),z=range(-25,16);rainPositions.set([x,y,z,x-.10,y-.7,z],i*6);}
const rainGeo=new THREE.BufferGeometry();rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPositions,3));const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:0xc9e2e8,transparent:true,opacity:.24}));storm.scene.add(rain);const heroStorm=addHero(storm);

// Above the weather: a luminous ocean of billowing clouds and open sky.
const heaven=base(0x488da9,0xffd6a2,0xc4d6cf,[-40,30,-80]);heaven.scene.fog.density=.006;heaven.key.intensity=3.8;
for(let i=0;i<95;i++)cloud(heaven,range(-100,100),range(-8,0),range(-120,65),range(2,5),[0xffead4,0xe8ddca,0xf9e1c6][i%3]);
const heroHeaven=addHero(heaven),friendHeaven=addHero(heaven,'gold'),whiteHeaven=addHero(heaven,'white');

// Sunset: feathered foreground birds against a coherent sweeping murmuration.
const sunset=base(0x726e91,0xe8a077,0xca987f,[-25,8,-100],0xffc08a);sunset.scene.fog.density=.006;sunset.key.intensity=2.6;sunset.fill.color.set(0xadc6df);sunset.fill.intensity=1.25;
const sunDisc=new THREE.Mesh(new THREE.SphereGeometry(6.8,40,32),new THREE.MeshBasicMaterial({color:new THREE.Color(2.6,1.32,.55),fog:false}));sunDisc.position.set(-22,12,-110);sunset.scene.add(sunDisc);
for(let i=0;i<17;i++)mountain(sunset,-100+i*14,-15,-70-range(0,35),range(8,15),i%2?0x9a868f:0x807d8c);
for(let i=0;i<30;i++)cloud(sunset,range(-100,100),range(-10,-2),range(-90,15),range(2,5),0xe9b494);
const heroSunset=addHero(sunset);const companions=[];for(let i=0;i<12;i++){const b=addHero(sunset,i%3===0?'gold':i%3===1?'white':'hero',false);b.scale.setScalar(range(.45,.75));companions.push(b);}
const flockShape=new THREE.Shape();flockShape.moveTo(-.34,0);flockShape.quadraticCurveTo(-.2,.30,0,.03);flockShape.quadraticCurveTo(.20,.30,.34,0);flockShape.quadraticCurveTo(.13,.11,0,-.055);flockShape.quadraticCurveTo(-.13,.11,-.34,0);
const flockGeo=new THREE.ShapeGeometry(flockShape,4),flockMat=new THREE.MeshBasicMaterial({color:0x4e505e,side:THREE.DoubleSide});const flock=new THREE.InstancedMesh(flockGeo,flockMat,380);flock.instanceMatrix.setUsage(THREE.DynamicDrawUsage);sunset.scene.add(flock);const dummy=new THREE.Object3D();
function aim(pos,target,fov=43,roll=0){camera.position.set(...pos);camera.up.set(Math.sin(roll),Math.cos(roll),0);camera.fov=fov;camera.lookAt(...target);camera.updateProjectionMatrix();}
function birdPose(b,t,pos,rot,opts={}){b.position.set(...pos);b.rotation.set(...rot);poseBird(b,t,opts);}
function renderAt(globalTime){
 const time=Math.max(0,Math.min(59.999,globalTime));const shot=Math.min(7,Math.floor(time/7.5)),t=time-shot*7.5,u=t/7.5;
 let world;
 if(shot===0){
  world=forest;birdPose(heroForest,time,[0,2.08+Math.sin(t*1.7)*.012,0],[0,-.12+Math.sin(t*.42)*.08,0],{flight:0,look:Math.sin(t*.65)*.14});
  aim([mix(3.4,2.75,u),mix(2.95,2.7,u),mix(5.3,4.7,u)],[-.65,2.24,0],39);
 }else if(shot===1){
  world=forest;const launch=smooth((t-.65)/1.3),x=smooth((t-.8)/6.7)*24;const y=2.08+launch*1.75+Math.sin(t*2)*.14*launch;
  birdPose(heroForest,time,[x,y,Math.sin(t*.8)*.6*launch],[0,-.1,-.25*Math.sin(clamp(t/2)*Math.PI)],{flight:launch,flapSpeed:3.7});
  aim([x+mix(3.8,4.4,u),y+mix(1.6,.55,u),mix(9.4,7.4,u)],[x+.3,y+.2,0],45);
 }else if(shot===2){
  world=river;const x=-13+u*38,y=1.3+Math.sin(t*1.1)*.35,z=Math.sin(t*.6)*1.2;
  birdPose(heroRiver,time,[x,y,z],[0,-.1,Math.sin(t*.7)*.18],{flight:1,flapSpeed:3.5,glide:smooth(Math.sin(t*.65))*.7});
  birdPose(friendRiver,time+.43,[x-3.3,y+.75,z-2.3],[0,.12,Math.sin(t*.65)*.13],{flight:1,flapSpeed:3.2});
  aim([x+4.2,y+1.5,8.5],[x-1,y+.3,z-.6],48,-.03*Math.sin(t*.4));
 }else if(shot===3){
  world=lagoon;const x=-8+u*20;birdPose(heroLagoon,time,[x,5.0+Math.sin(t*.8)*.25,-1],[0,.04,-.08],{flight:1,flapSpeed:3.4,glide:.4});
  aim([mix(10,18,u),mix(5.5,8.8,u),mix(18,24,u)],[mix(1,6,u),2.8,-2],47);
  for(const m of lagoon.movers){m.neck.rotation.z=Math.sin(t*.65+m.phase)*.12;m.g.rotation.y=.15+Math.sin(m.phase)*.6;}
 }else if(shot===4){
  world=storm;const x=u*20,y=8+u*5+Math.sin(t*3.4)*.12;birdPose(heroStorm,time,[x,y,0],[.12*Math.sin(t),.13,-.1-u*.24],{flight:1,flapSpeed:4.2});
  rain.position.set(x-5,-(t*14)%11,0);aim([x+mix(2.3,3.2,u),y+.9,4.8],[x,y+.22,0],42,.035*Math.sin(t*2));
 }else if(shot===5){
  world=heaven;const x=u*13,y=5+Math.sin(u*Math.PI)*1.3;birdPose(heroHeaven,time,[x,y,0],[Math.sin(t*.45)*.15,-.15,-.08],{flight:1,flapSpeed:2.8,glide:smooth((t-1)/2)});
  friendHeaven.visible=false;whiteHeaven.visible=false;
  aim([x+mix(3.6,-4.2,smooth(u)),y+mix(.7,4.2,u),mix(6.3,9.3,u)],[x,y,0],40,-.07*Math.sin(u*Math.PI));
 }else if(shot===6){
  world=sunset;const x=u*8;birdPose(heroSunset,time,[x,4.8,4],[0,-.1,-.04],{flight:1,flapSpeed:2.9,glide:.65});
  for(let i=0;i<companions.length;i++){const side=i%2?1:-1,k=Math.floor(i/2)+1;birdPose(companions[i],time+i*.28,[x-k*1.9,4.8+k*.18+Math.sin(t*.8+i)*.2,4+side*k*1.45],[0,-.1,Math.sin(t+i)*.07],{flight:1,flapSpeed:2.8,glide:.55});}
  for(let i=0;i<380;i++){const a=i*.31+time*.13,b=i*.618;const r=5+((i*37)%100)/7;dummy.position.set(x-14+Math.cos(a)*r*1.5,8+Math.sin(a)*r*.25+Math.sin(b+t*.35)*1.4,-25+Math.sin(b)*5);dummy.rotation.set(0,0,Math.sin(a)*.22);dummy.scale.setScalar(.36+((i*17)%10)/25);dummy.scale.y*=.5+.5*Math.abs(Math.sin(time*7+i));dummy.updateMatrix();flock.setMatrixAt(i,dummy.matrix);}flock.instanceMatrix.needsUpdate=true;
  aim([x+mix(7,12,u),mix(7,10,u),mix(19,28,u)],[x-4,6,-3],45);
 }else{
  world=heaven;friendHeaven.visible=true;whiteHeaven.visible=true;const x=u*9,y=7+u;
  birdPose(heroHeaven,time,[x,y,-u*2],[0,.35,-.04],{flight:1,flapSpeed:2.8,glide:.95});
  birdPose(friendHeaven,time+.5,[x-3,y+.3,-3-u*2],[0,.35,0],{flight:1,glide:.95});
  birdPose(whiteHeaven,time+1,[x-5,y+.6,3-u*2],[0,.35,0],{flight:1,glide:.95});
  aim([x+mix(6,12,u),y+mix(2.4,6,u),mix(14,33,u)],[x-2,y-1,-8],44);
 }
 for(let i=0;i<world.clouds.length;i++){const c=world.clouds[i];c.g.position.x=c.x+Math.sin(time*.04+i)*.8;c.g.position.z=c.z+Math.cos(time*.035+i)*.45;}
 if(world.water)world.water.uniforms.time.value=time;
 if(world.dust){world.dust.rotation.y=time*.012;world.dust.position.y=Math.sin(time*.2)*.2;}
 if(world===forest){for(let i=0;i<forest.movers.length;i++)forest.movers[i].rotation.z=Math.sin(time*.8+i)*.025;}
 renderer.toneMappingExposure=shot===4?.92:shot===3?1.05:1.03;
 bloom.strength=shot===4?.13:shot>=5?.32:.22;
 renderPass.scene=world.scene;dof.scene=world.scene;dof.enabled=shot===0;dof.uniforms.focus.value=camera.position.distanceTo(heroForest.position);composer.render();
 window.__filmState={time,shot:shot+1,camera:camera.position.toArray(),drawCalls:renderer.info.render.calls};
}
window.addEventListener('hf-seek',e=>renderAt(e.detail.time));
window.renderFilmAt=renderAt;
renderAt(window.__hfThreeTime||0);
window.__filmReady=true;
