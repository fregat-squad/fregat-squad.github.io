'use strict';
const $=id=>document.getElementById(id),canvas=$('view'),g=canvas.getContext('2d',{alpha:false}),screenBox=$('screen');
g.imageSmoothingEnabled=false;
const W=canvas.width,H=canvas.height,N=19,dirs=[[1,0],[-1,0],[0,1],[0,-1]],keys=new Set();
let maze,player,enemy,items,heading,total,elapsed,target,phase='menu',muted=false,audio,master,chorusGain,chorusBuffer,chorusSource,messageUntil=0,last=0,walk=0;
let lamps=[],lightField,shadedRider,endingStart=0;
const chaseSpeed = bottles => bottles===7 ? 3.12 : .9 + bottles * .145;
const finalTempo=.68;
let nightmareRider;
function markEyes(ctx,x,y,radius){
 const flare=ctx.createRadialGradient(x,y,0,x,y,radius);
 flare.addColorStop(0,'#ffe7bc');flare.addColorStop(.19,'#ff473b');
 flare.addColorStop(.45,'#f71122c0');flare.addColorStop(1,'#b9001000');
 ctx.fillStyle=flare;ctx.fillRect(x-radius,y-radius,2*radius,2*radius)
}
function hauntSprite(img){
 return surface(img.width,img.height,c=>{
   c.drawImage(img,0,0);c.globalCompositeOperation='source-atop';c.fillStyle='#26040c8a';c.fillRect(0,0,img.width,img.height);
   c.globalCompositeOperation='source-over';markEyes(c,70,22.5,4.2);markEyes(c,79.5,21.2,4.2)
 })
}
const exit={x:1.5,y:1.5},dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),open=(x,y)=>maze[y|0]?.[x|0]===0;
function distances(x,y){const costs=new Int16Array(N*N).fill(-1),queue=[(y|0)*N+(x|0)];costs[queue[0]]=0;
 for(let i=0;i<queue.length;i++){const p=queue[i];for(const [dx,dy] of dirs){const nx=p%N+dx,ny=Math.floor(p/N)+dy,k=ny*N+nx;if(open(nx,ny)&&costs[k]<0){costs[k]=costs[p]+1;queue.push(k)}}}return costs}
function createLevel(){const r=seeded(crypto.getRandomValues(new Uint32Array(1))[0]);maze=Array.from({length:N},()=>Array(N).fill(1));maze[1][1]=0;
 function dig(x,y){let options=[...dirs];for(let i=3;i>0;i--){let j=Math.floor(r()*(i+1));[options[i],options[j]]=[options[j],options[i]]}for(let [dx,dy] of options){let nx=x+dx*2,ny=y+dy*2;if(nx>0&&nx<N-1&&ny>0&&ny<N-1&&maze[ny][nx]){maze[ny][nx]=maze[y+dy][x+dx]=0;dig(nx,ny)}}}dig(1,1);
 for(let i=0;i<180;i++){let x=2+(r()*(N-4)|0),y=2+(r()*(N-4)|0);if((x+y)%2===1&&maze[y][x]&&r()<.23)maze[y][x]=0}
 // Give every hiding place a second approach so a pursuer cannot seal a corridor.
 for(let y=1;y<N-1;y+=2)for(let x=1;x<N-1;x+=2){
   if(dirs.filter(([dx,dy])=>open(x+dx,y+dy)).length!==1)continue;
   const bypass=dirs.find(([dx,dy])=>!open(x+dx,y+dy)&&open(x+2*dx,y+2*dy));
   if(bypass)maze[y+bypass[1]][x+bypass[0]]=0;
 }
 const cells=[];for(let y=1;y<N;y+=2)for(let x=1;x<N;x+=2)cells.push({x:x+.5,y:y+.5});
 let space=distances(1,1);items=[];for(let i=0;i<7;i++){let pick=cells.reduce((a,b)=>space[(a.y|0)*N+(a.x|0)]>space[(b.y|0)*N+(b.x|0)]?a:b);items.push({...pick});let d=distances(pick.x,pick.y);space=space.map((v,k)=>Math.min(v,d[k]))}
 player={x:1.5,y:1.5};heading=open(2,1)?0:Math.PI/2;enemy={...items[0]};elapsed=walk=total=0;target=null;
 buildLighting();
}
const texture=surface(64,64,c=>{let r=seeded(680);rect(c,'#1d2d28',0,0,64,64);for(let i=0;i<1900;i++){let x=r()*64,y=r()*64;let k=Math.max(0,Math.min(4,(2+Math.sin(x*.32+Math.sin(y*.28))*.85+Math.cos(y*.37)*.45+r()*2-1)|0));rect(c,['#1b2a25','#253a2e','#344e36','#465d3e','#607348'][k],x,y,1+r()*3,1+r()*2)}});

const sky=surface(1024,150,c=>{const r=seeded(190);const wash=c.createLinearGradient(0,0,0,150);wash.addColorStop(0,'#070b10');wash.addColorStop(1,'#141c21');c.fillStyle=wash;c.fillRect(0,0,1024,150);for(let i=0;i<390;i++)pine(c,r()*1024,149,20+r()*60,'#091114',r)});
const samples=10,fieldSize=N*samples,depth=new Float32Array(W);
function buildLighting(){
 const entranceLight=open(2,1)?{x:2.6,y:1.5}:{x:1.5,y:2.6};
 const spots=[exit,entranceLight,...items],coverage=distances(exit.x,exit.y);
 function cover(spot){const d=distances(spot.x,spot.y);for(let i=0;i<d.length;i++)coverage[i]=Math.min(coverage[i],d[i])}
 spots.forEach(cover);
 while(true){let k=coverage.indexOf(Math.max(...coverage));if(coverage[k]<5)break;const spot={x:k%N+.5,y:Math.floor(k/N)+.5};spots.push(spot);cover(spot)}
 lamps=spots.map(p=>{const side=dirs.find(([x,y])=>!open(p.x+x,p.y+y))||[0,1];return {x:p.x+.34*side[0],y:p.y+.34*side[1]}});
 lightField=new Float32Array(fieldSize**2);
 for(const lamp of lamps){
   const radius=3.1;
   for(let iy=Math.max(0,Math.floor((lamp.y-radius)*samples));iy<Math.min(fieldSize,(lamp.y+radius)*samples);iy++)
   for(let ix=Math.max(0,Math.floor((lamp.x-radius)*samples));ix<Math.min(fieldSize,(lamp.x+radius)*samples);ix++){
     const x=ix/samples,y=iy/samples,dx=x-lamp.x,dy=y-lamp.y,d=Math.hypot(dx,dy);
     if(d>=radius||!open(x,y))continue;
     const steps=Math.ceil(d*9);let visible=true;for(let j=1;j<steps;j++)if(!open(lamp.x+dx*j/steps,lamp.y+dy*j/steps)){visible=false;break}
     if(visible){const k=iy*fieldSize+ix;lightField[k]=Math.min(1,lightField[k]+(1-d/radius)**1.65)}
   }
 }
}
function lightAt(x,y){
 x*=samples;y*=samples;const ix=Math.floor(x),iy=Math.floor(y);if(ix<0||iy<0||ix>=fieldSize-1||iy>=fieldSize-1)return 0;
 const u=x-ix,v=y-iy,k=iy*fieldSize+ix;return (lightField[k]*(1-u)+lightField[k+1]*u)*(1-v)+(lightField[k+fieldSize]*(1-u)+lightField[k+fieldSize+1]*u)*v
}
const floorBuffer=surface(W/2,Math.ceil(H/4)+3,()=>{}),floorCtx=floorBuffer.getContext('2d'),ground=floorCtx.createImageData(floorBuffer.width,floorBuffer.height);
function drawGround(dx,dy,px,py,horizon){
 const fw=floorBuffer.width,fh=floorBuffer.height,pixels=ground.data;
 for(let y=0;y<fh;y++){
   const d=H*.37/(y*2+1);let wx=player.x+(dx-px)*d,wy=player.y+(dy-py)*d;const sx=2*px*d/fw,sy=2*py*d/fw;
   for(let x=0;x<fw;x++,wx+=sx,wy+=sy){const n=(Math.imul(Math.floor(wx*47),73856093)^Math.imul(Math.floor(wy*47),19349663))>>>0;
     const l=lightAt(wx,wy)*(.66+(n%73)/100),i=(y*fw+x)*4;
     pixels[i]=8+119*l;pixels[i+1]=12+92*l;pixels[i+2]=14+54*l;pixels[i+3]=255
   }
 }
 floorCtx.putImageData(ground,0,0);g.drawImage(floorBuffer,0,horizon,W,fh*2)
}
function shadeLevels(img){return Array.from({length:12},(_,i)=>surface(img.width,img.height,c=>{
 c.drawImage(img,0,0);c.globalCompositeOperation='source-atop';c.fillStyle='rgba(3,8,12,'+(.89-i*.075)+')';c.fillRect(0,0,img.width,img.height)
}))}
const bottles=shadeLevels(bottle),walls=shadeLevels(texture),cafes=shadeLevels(cafe);
const lantern=surface(86,116,c=>{c.drawImage(lamp,19,3);glow(c,43,18,28,'#ffda935b','#ffbd5b2b')});
function world(){let dx=Math.cos(heading),dy=Math.sin(heading),fov=.79,px=-dy*fov,py=dx*fov,horizon=Math.floor(H*.49+Math.sin(walk)*1.6);
 let off=((heading/(2*Math.PI)*sky.width)%sky.width+sky.width)%sky.width;for(let x=0;x<W;x+=2){let u=(off+Math.atan((2*x/W-1)*fov)*sky.width/(2*Math.PI)+1024)%1024;g.drawImage(sky,u|0,0,1,150,x,0,2,horizon)}
 drawGround(dx,dy,px,py,horizon);
 for(let x=0;x<W;x+=2){let cam=2*x/W-1,rx=dx+cam*px,ry=dy+cam*py,mx=player.x|0,my=player.y|0,sx=Math.sign(rx),sy=Math.sign(ry),ddx=Math.abs(1/(rx||1e-9)),ddy=Math.abs(1/(ry||1e-9)),ax=(sx<0?player.x-mx:mx+1-player.x)*ddx,ay=(sy<0?player.y-my:my+1-player.y)*ddy,side,d;
 do{if(ax<ay){d=ax;ax+=ddx;mx+=sx;side=0}else{d=ay;ay+=ddy;my+=sy;side=1}}while(open(mx,my));
 depth[x]=depth[x+1]=d;let along=side?player.x+rx*d:player.y+ry*d,u=Math.floor((along%1)*64),height=H*.82/d,rough=(u*13%7)*height*.003,top=horizon-height*.55-rough;const lit=lightAt(player.x+rx*(d-.09),player.y+ry*(d-.09));const level=Math.min(11,Math.round(lit*14/(1+d*.07)));g.drawImage(walls[level],u,0,1,64,x,top,2,height+rough)}
 const shade=o=>Math.min(11,Math.round(lightAt(o.x,o.y)*13));let objects=items.filter(o=>!o.got).map(o=>({...o,img:bottles[shade(o)],size:.34}));
 const finalRun=total===7;
 objects.push({...enemy,img:(finalRun?nightmareRider:shadedRider)[shade(enemy)],size:finalRun?1.19:1.05},{x:1.32,y:1.32,img:cafes[shade(exit)],size:1.05},...lamps.map(o=>({...o,img:lantern,size:1.22})));
 objects=objects.map(o=>{let xx=o.x-player.x,yy=o.y-player.y;return {...o,z:xx*dx+yy*dy,l:-xx*dy+yy*dx}}).filter(o=>o.z>.15).sort((a,b)=>b.z-a.z);
 for(let o of objects){let h=H*.82*o.size/o.z,w=h*o.img.width/o.img.height,left=W/2*(1+o.l/(o.z*fov))-w/2,bottom=horizon+H*.37/o.z;for(let x=Math.max(0,Math.ceil(left));x<Math.min(W,left+w);x++){if(o.z>depth[x])continue;g.drawImage(o.img,Math.min(o.img.width-1,((x-left)/w*o.img.width)|0),0,1,o.img.height,x,bottom-h,1,h)}}
 if(finalRun){
   g.save();g.globalCompositeOperation='multiply';g.fillStyle='#de424d';g.fillRect(0,0,W,H);g.restore();
   g.fillStyle='rgba(64,0,11,'+(.14+.045*Math.sin(elapsed*2.9))+')';g.fillRect(0,0,W,H)
 }
}
let decoding,chorusBegan=0,chorusOffset=0;
function chorusPosition(){
 return (chorusOffset+(audio.currentTime-chorusBegan)*chorusSource.playbackRate.value)%chorusSource.loopEnd
}
function startFinalChase(){
 if(chorusSource){
   chorusOffset=chorusPosition();chorusBegan=audio.currentTime;
   chorusSource.playbackRate.setValueAtTime(finalTempo,chorusBegan)
 }
 $('status').textContent='ПОСЛЕДНЯЯ ПОГОНЯ';
}
let emitter,hedgeFilter,glassSound,impactBuffer,impactSource;
const hearingRadius=6.5;
function updateEmitter(){
 if(!chorusSource)return;
 const x=enemy.x-player.x,y=enemy.y-player.y,d=Math.hypot(x,y);
 const right=y*Math.cos(heading)-x*Math.sin(heading),front=x*Math.cos(heading)+y*Math.sin(heading);
 const now=audio.currentTime,proximity=Math.max(0,1-d/hearingRadius);
 let blocked=false;
 for(let step=.25;step<Math.min(d,hearingRadius);step+=.25){
   if(!open(player.x+x*step/d,player.y+y*step/d)){blocked=true;break}
 }
 emitter.positionX.setTargetAtTime(right,now,.035);
 emitter.positionZ.setTargetAtTime(-front,now,.035);
 hedgeFilter.frequency.setTargetAtTime(blocked?1250:total===7?5000:15000,now,.085);
 chorusGain.gain.setTargetAtTime(1.6*proximity**1.6*(blocked?.6:1),now,.095);
}
function breakingGlass(){
 if(!audio||muted||audio.state!=='running')return;
 if(!glassSound){
   const rate=audio.sampleRate,r=seeded(131);
   glassSound=audio.createBuffer(1,Math.ceil(rate*.85),rate);
   const data=glassSound.getChannelData(0);
   // A short fracture followed by individual fragments striking the ground.
   for(let j=0;j<35;j++){
     const start=j===0?0:Math.floor((.012+.57*r()**2)*rate);
     const pitch=1150+r()*3050,decay=.022+r()*.045,amp=j===0?1:.12+r()*.25;
     let prev=0;
     for(let i=0;i<rate*decay*5&&start+i<data.length;i++){
       const t=i/rate,n=r()*2-1,angle=2*Math.PI*pitch*t;
       data[start+i]+=amp*Math.min(1,t/.0015)*Math.exp(-t/decay)*(
         .58*Math.sin(angle)+.24*Math.sin(angle*1.48)+(n-prev)*Math.exp(-t/.009));
       prev=n;
     }
   }
   let peak=.001;for(const v of data)peak=Math.max(peak,Math.abs(v));
   for(let i=0;i<data.length;i++)data[i]*=.14/peak;
 }
 const source=audio.createBufferSource();source.buffer=glassSound;source.connect(master);
 source.onended=()=>source.disconnect();source.start();
}
function playImpact(){
 if(!impactBuffer||muted||audio.state!=='running')return;
 const source=audio.createBufferSource();
 source.buffer=impactBuffer;source.playbackRate.value=total===7?finalTempo:1;
 source.connect(master);impactSource=source;
 source.onended=()=>{source.disconnect();if(impactSource===source)impactSource=null};source.start()
}
function volumeTarget(){return muted?0:Number($('volume').value)/100}
function updateVolume(){if(master)master.gain.setTargetAtTime(volumeTarget(),audio.currentTime,.09)}
let stepDistance=0,footstepBuffer;
function footstep(){
 if(!audio||audio.state!=='running'||muted||volumeTarget()===0)return;
 if(!footstepBuffer){
   const rate=audio.sampleRate,random=seeded(1701);
   footstepBuffer=audio.createBuffer(1,Math.ceil(rate*.14),rate);
   const samples=footstepBuffer.getChannelData(0);
   let grit=0;
   for(let i=0;i<samples.length;i++){
     const t=i/rate;
     grit=.76*grit+.24*(random()*2-1);
     const sole=.065*Math.sin(2*Math.PI*(92*t-125*t*t))*Math.exp(-42*t);
     const gravel=.13*grit*Math.exp(-27*t);
     samples[i]=(sole+gravel)*Math.min(1,t/.007,(.14-t)/.012);
   }
 }
 const step=audio.createBufferSource();step.buffer=footstepBuffer;
 step.playbackRate.value=.91+Math.random()*.16;step.connect(master);
 step.onended=()=>step.disconnect();step.start()
}
function tone(freq,len,type='sine',volume=.055){
 if(!audio||muted)return;const o=audio.createOscillator(),v=audio.createGain();o.type=type;o.frequency.value=freq;o.connect(v);v.connect(master);
 v.gain.setValueAtTime(.0001,audio.currentTime);v.gain.exponentialRampToValueAtTime(volume,audio.currentTime+.014);v.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+len);o.start();o.stop(audio.currentTime+len)
}
function stopChorus(){
 if(!chorusSource)return;
 chorusOffset=chorusPosition();
 const old=chorusSource,oldGain=chorusGain;oldGain.gain.setTargetAtTime(0,audio.currentTime,.02);old.stop(audio.currentTime+.12);old.onended=()=>{old.disconnect();oldGain.disconnect()};chorusSource=null
}
async function awaken(){
 try{
  if(!audio){audio=new AudioContext();master=audio.createGain();master.gain.value=volumeTarget();master.connect(audio.destination)}
  await audio.resume();
  if(!decoding){
    const decode=data=>audio.decodeAudioData(Uint8Array.from(atob(data),c=>c.charCodeAt(0)).buffer);
    decode(impactData).then(buffer=>{impactBuffer=buffer}).catch(()=>{});
    decoding=decode(chorusData)
  }
  chorusBuffer=await decoding;if(phase!=='play'||chorusSource)return;
  if(!emitter){
    emitter=audio.createPanner();emitter.panningModel='HRTF';emitter.rolloffFactor=0;
    emitter.channelCount=1;emitter.channelCountMode='explicit';
    hedgeFilter=audio.createBiquadFilter();hedgeFilter.type='lowpass';hedgeFilter.Q.value=.6;
    hedgeFilter.connect(emitter);emitter.connect(master)
  }
  chorusGain=audio.createGain();chorusGain.gain.value=0;chorusGain.connect(hedgeFilter);
  chorusSource=audio.createBufferSource();chorusSource.buffer=chorusBuffer;chorusSource.loop=true;chorusSource.loopEnd=Math.min(32.82051,chorusBuffer.duration);
  chorusSource.playbackRate.value=total===7?finalTempo:1;
  chorusSource.connect(chorusGain);chorusBegan=audio.currentTime;chorusSource.start(0,chorusOffset);updateEmitter()
 }catch{if(phase==='play')hint('Звук недоступен в этом браузере.',3)}
}
function hint(s,seconds=3){$('hint').textContent=s;messageUntil=elapsed+seconds}
function counter(){$('count').textContent='СТИРСМАНЫ  '+total+' / 7'}
const mouseSensitivity=.0026*.70;
let mouseDelta=0,previousX=null,ignoreMouseUntil=0;
function resetMouse(){
 mouseDelta=0;previousX=null;ignoreMouseUntil=performance.now()+100
}
function captureMouse(){
 resetMouse();
 if(document.pointerLockElement!==screenBox){
   try{screenBox.requestPointerLock?.()?.catch?.(()=>{})}catch{}
 }
}
function releaseMouse(){
 resetMouse();
 if(document.pointerLockElement===screenBox)document.exitPointerLock()
}
document.addEventListener('pointerlockchange',()=>{
 resetMouse();
 if(document.pointerLockElement===screenBox&&phase!=='play')releaseMouse()
});
screenBox.addEventListener('pointerleave',()=>{previousX=null});
screenBox.addEventListener('click',e=>{
 if(phase==='play'&&!e.target.closest('button')&&!document.pointerLockElement)captureMouse()
});
document.addEventListener('pointermove',e=>{
 if(phase!=='play'||e.pointerType!=='mouse'||performance.now()<ignoreMouseUntil)return;
 let delta=e.movementX;
 if(document.pointerLockElement!==screenBox){
   if(!screenBox.contains(e.target)){previousX=null;return}
   delta=previousX===null?0:e.clientX-previousX;previousX=e.clientX
 }
 // Ignore cursor warps on lock, recenter and monitor transitions.
 if(Number.isFinite(delta)&&Math.abs(delta)<=180)mouseDelta+=delta
});
function play(fresh){
 if(fresh){if(impactSource)impactSource.stop();createLevel();chorusOffset=0;counter();hint('Слышишь припев? Лёха рядом. Слушай, с какой стороны он едет.',5)}
 phase='play';stepDistance=.55;keys.clear();captureMouse();$('modal').hidden=$('menu').hidden=true;$('hud').hidden=false;
 screenBox.classList.remove('ending','dead');screenBox.classList.add('live');
 $('status').textContent=total===7?'ПОСЛЕДНЯЯ ПОГОНЯ':'В ЛАБИРИНТЕ';awaken()
}
function stop(kind){if(phase!=='play'&&!(phase==='dying'&&kind==='lost'))return;phase=kind;releaseMouse();stopChorus();keys.clear();$('hud').hidden=true;$('modal').hidden=false;
 if(kind==='won'){endingStart=performance.now();screenBox.classList.add('ending');tone(440,.58,'sine',.04);tone(659,.75,'sine',.028)}
 const info={pause:['Пауза','Лабиринт подождёт.','Продолжить'],lost:['Ты погиб','Лёха догнал тебя. Собрано стирсманов — '+total+' из 7.','Попробовать снова'],won:['За закрытой дверью','Ты задвигаешь щеколду. Семь бутылок звякают на стойке. За стеклом Лёха ещё раз проезжает мимо.','Сыграть ещё']}[kind];$('modalTitle').textContent=info[0];$('modalText').textContent=info[1];$('resume').textContent=info[2];$('status').textContent=info[0].toUpperCase();$('resume').focus()}
function advance(dt){elapsed+=dt;let turn=Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft'));heading+=turn*dt*2.925+Math.max(-.23,Math.min(.23,mouseDelta*mouseSensitivity));mouseDelta=0;let f=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),s=Number(keys.has('KeyD'))-Number(keys.has('KeyA')),dx=Math.cos(heading),dy=Math.sin(heading),speed=(keys.has('ShiftLeft')||keys.has('ShiftRight')?3.25:2.18)*dt/(Math.hypot(f,s)||1);
 const oldX=player.x,oldY=player.y;
 const ax=(dx*f-dy*s)*speed,ay=(dy*f+dx*s)*speed,r=.17;if(open(player.x+ax+Math.sign(ax)*r,player.y-r)&&open(player.x+ax+Math.sign(ax)*r,player.y+r))player.x+=ax;if(open(player.x-r,player.y+ay+Math.sign(ay)*r)&&open(player.x+r,player.y+ay+Math.sign(ay)*r))player.y+=ay;const travelled=Math.hypot(player.x-oldX,player.y-oldY);
 if(travelled>0){
   walk+=dt*9;stepDistance+=travelled;
   if(stepDistance>=1){stepDistance%=1;footstep()}
 }
 for(const item of items)if(!item.got&&dist(player,item)<.56){
   item.got=true;total++;counter();
   if(total===7){startFinalChase();tone(86,.55,'triangle',.048);hint('7 / 7 · Дверь открыта. Беги во «Фрегат»!',4)}
   else{tone(390+total*40,.32,'triangle');hint('Стирсман найден · '+total+' / 7')}
 }
 if(total===7&&dist(player,exit)<.74){stop('won');return}
 if(elapsed>7){if(!target||dist(enemy,target)<.025){const costs=distances(player.x,player.y),ex=enemy.x|0,ey=enemy.y|0;let best=costs[ey*N+ex];target={x:player.x,y:player.y};for(const [a,b] of dirs){const x=ex+a,y=ey+b,k=y*N+x;if(costs[k]>=0&&costs[k]<best){best=costs[k];target={x:x+.5,y:y+.5}}}}
 let d=dist(enemy,target),v=Math.min(d,chaseSpeed(total)*dt);if(d){enemy.x+=(target.x-enemy.x)/d*v;enemy.y+=(target.y-enemy.y)/d*v}if(dist(enemy,player)<.42){beginDeath();return}}
 updateEmitter();
 const near=Math.max(0,1-dist(player,enemy)/8);
 if(elapsed>messageUntil){$('hint').textContent=dist(player,exit)<1.4&&total<7?'Кафе закрыто · Найдено '+total+' из 7':near>.73?'Лёха совсем близко…':''}
}
const lastView=surface(W,H,()=>{});
let deathTime=0,strikeSide=1,shattered=false,spatter=[],shards=[];
const impactAt=.32;
function beginDeath(){
 phase='dying';releaseMouse();deathTime=0;shattered=false;
 strikeSide=((enemy.y-player.y)*Math.cos(heading)-(enemy.x-player.x)*Math.sin(heading))<0?-1:1;
 lastView.getContext('2d').drawImage(canvas,0,0);
 keys.clear();stopChorus();$('hud').hidden=true;screenBox.classList.add('dead');
 const r=seeded(317+total);
 spatter=Array.from({length:115},()=>{
   const a=r()*2*Math.PI,len=18+r()**.65*320;
   return {x:Math.cos(a)*len,y:Math.sin(a)*len*.67,w:1+Math.floor(r()**2*10),drip:r()**3*38,
     ink:['#55121d','#791621','#98242c','#65141c'][Math.floor(r()*4)]}
 });
 shards=Array.from({length:27},()=>({vx:(r()-.5)*520,vy:-65-r()*235,spin:r()*9-4.5,w:2+r()*7}));
}
function renderDeath(dt){
 deathTime+=dt;const t=deathTime-impactAt;
 g.drawImage(lastView,0,0);
 const x=W*(strikeSide>0?.60:.40),y=H*.41;
 if(t<0){
   const swing=(deathTime/impactAt)**2;
   g.save();g.translate(x+strikeSide*(1-swing)*W*.58,y-(1-swing)*H*.12);
   g.rotate(strikeSide*(-1.3+swing*2.4));
   if(strikeBottle.complete&&strikeBottle.naturalWidth)g.drawImage(strikeBottle,-22,-135,44,200);
   g.restore();return
 }
 if(!shattered){shattered=true;breakingGlass();playImpact()}
 if(t<.95 && scareFace.complete && scareFace.naturalWidth){
   const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
   const rush=reduced?1:1-Math.exp(-t*19);
   const width=W*(.48+.44*rush),height=width*scareFace.height/scareFace.width;
   const recoil=reduced?0:strikeSide*Math.sin(t*41)*8*Math.exp(-t*7);
   g.save();g.globalAlpha=Math.min(1,(.95-t)/.22);
   g.fillStyle='#100a0d';g.fillRect(0,0,W,H);
   const left=(W-width)/2+recoil,top=H*.48-height*.44;
   g.drawImage(scareFace,left,top,width,height);
   if(total===7){
     g.fillStyle='#42000d66';g.fillRect(left,top,width,height);
     markEyes(g,left+width*.369,top+height*.45,width*.062);
     markEyes(g,left+width*.70,top+height*.417,width*.062)
   }
   g.restore()
 }
 g.fillStyle='rgba(90,5,15,'+(.16+.19*Math.exp(-8*t))+')';g.fillRect(0,0,W,H);
 const spread=1-Math.exp(-t*19);
 for(const p of spatter){
   const px=x+p.x*spread,py=y+p.y*spread,trail=Math.floor(Math.max(0,t-.16)*p.drip);
   rect(g,p.ink,px,py,p.w,p.w*.8);
   if(trail){rect(g,p.ink,px+1,py+1,Math.max(1,p.w*.34),trail);rect(g,p.ink,px,py+trail,Math.max(2,p.w*.48),3)}
 }
 for(const s of shards){
   g.save();g.translate(x+s.vx*t,y+s.vy*t+410*t*t);g.rotate(s.spin*t);
   poly(g,'#bfd7d9',[[0,0],[s.w,-s.w],[s.w*.35,s.w*1.35]]);g.restore()
 }
 g.fillStyle='rgba(12,4,7,'+Math.min(.6,t*.38)+')';g.fillRect(0,0,W,H);
 if(t>=1.45)stop('lost');
}
function renderEnding(now){
 g.drawImage(interior,0,0,W,H);
 const t=(now-endingStart)/1000;
 // Through the glass the rider coasts past, then disappears beyond the door frame.
 if(t>.3&&t<4.5){g.save();g.scale(W/800,H/440);g.beginPath();g.rect(298,89,102,79);g.rect(298,174,102,43);g.clip();g.globalAlpha=.55;g.drawImage(shadedRider[5],408-(t-.3)*34,166,24,47);g.restore()}
 if(t<.75){g.fillStyle='rgba(4,5,4,'+Math.max(0,1-t/.75)+')';g.fillRect(0,0,W,H)}
}
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(phase==='play'){advance(dt);if(phase==='play')world()}if(phase==='dying'&&!document.hidden)renderDeath(dt);if(phase==='won')renderEnding(now);requestAnimationFrame(frame)}
$('start').disabled=true;Promise.all([nightArtReady,scareFace.decode()]).then(()=>{shadedRider=shadeLevels(rider);nightmareRider=shadedRider.map(hauntSprite);g.drawImage(poster,0,0,W,H);$('start').disabled=false}).catch(()=>{$('status').textContent='Ошибка загрузки изображения'});requestAnimationFrame(frame);
$('start').onclick=()=>play(true);$('resume').onclick=()=>play(phase!=='pause');$('pause').onclick=()=>stop('pause');
$('sound').onclick=()=>{muted=!muted;$('sound').textContent=muted?'Звук выкл.':'Звук вкл.';updateVolume()};
$('volume').oninput=updateVolume;
function expandGame(on){
 document.body.classList.toggle('expanded',on);
 if(arcadeFrame)arcadeFrame.ownerDocument.body.classList.toggle('maze-expanded',on);
 $('full').textContent=on?'Свернуть':'Полный экран';
 $('full').setAttribute('aria-pressed',String(on))
}
$('full').onclick=async()=>{
 if(document.body.classList.contains('expanded')){
   expandGame(false);
   if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});
   return
 }
 expandGame(true);
 // Embedded browsers can disallow native fullscreen. The viewport layout works in both modes.
 if(document.fullscreenEnabled)try{await document.documentElement.requestFullscreen()}catch{}
};
document.addEventListener('fullscreenchange',()=>expandGame(Boolean(document.fullscreenElement)));
document.addEventListener('keydown',e=>{
 if(e.code==='Escape'&&document.body.classList.contains('expanded')&&!document.fullscreenElement)expandGame(false)
});
document.addEventListener('keydown',e=>{if(phase==='play'){if(e.code==='Escape'){stop('pause');return}if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys.add(e.code)}});document.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>stop('pause'));document.addEventListener('visibilitychange',()=>{if(document.hidden)stop('pause')});
