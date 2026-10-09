export const W=960,H=500;
export const crates=[{x:310,y:100,w:85,h:115},{x:565,y:285,w:85,h:115}];
export const spawnPoints=[{x:925,y:250},{x:490,y:85},{x:925,y:415},{x:490,y:415},{x:25,y:85}];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

export function chooseSpawnPoint(state){
  for(let offset=0;offset<spawnPoints.length;offset++){
    const index=(state.spawnIndex+offset)%spawnPoints.length,point=spawnPoints[index];
    if(distance(point,state.player)>200)return {...point,index};
  }
  return {...spawnPoints[state.spawnIndex%spawnPoints.length],index:state.spawnIndex%spawnPoints.length};
}

export function createGame(){
  return {phase:'playing',time:0,health:3,collected:0,shots:0,kills:0,cooldown:0,invulnerable:0,spawnIn:6,spawnIndex:0,
    player:{x:95,y:250,vx:0,vy:0},flags:[{x:850,y:80,taken:false},{x:480,y:250,taken:false},{x:850,y:420,taken:false}],
    enemies:[],bullets:[],particles:[],events:[]};
}

function particles(s,x,y,color,count=8){
  for(let i=0;i<count;i++){const angle=i/count*Math.PI*2;s.particles.push({x,y,vx:Math.cos(angle)*85,vy:Math.sin(angle)*85,life:.4,color});}
}

export function shoot(s,angle){
  if(s.phase!=='playing'||s.cooldown>0)return false;
  const dx=Math.cos(angle),dy=Math.sin(angle),p=s.player;
  s.bullets.push({x:p.x+dx*19,y:p.y+dy*19,vx:dx*620,vy:dy*620,life:1.5});
  p.vx-=dx*230;p.vy-=dy*230;
  const speed=Math.hypot(p.vx,p.vy);if(speed>460){p.vx*=460/speed;p.vy*=460/speed;}
  s.cooldown=.22;s.shots++;s.events.push('shot');
  return true;
}

function collides(x,y,r,box){return Math.hypot(x-clamp(x,box.x,box.x+box.w),y-clamp(y,box.y,box.y+box.h))<r;}
function blocked(x,y,r=13){return crates.some(box=>collides(x,y,r,box));}

function move(body,dx,dy,r){
  const oldX=body.x,oldY=body.y;
  body.x=clamp(body.x+dx,r+10,W-r-10);
  if(blocked(body.x,body.y,r))body.x=oldX;
  body.y=clamp(body.y+dy,r+10,H-r-10);
  if(blocked(body.x,body.y,r))body.y=oldY;
  if(body.x===oldX&&dx!==0&&'vx' in body)body.vx*=.15;
  if(body.y===oldY&&dy!==0&&'vy' in body)body.vy*=.15;
}

// Enemies walk around the sandbag positions.
function waypoint(enemy,player){
  const size=40,cols=24,rows=12;
  const cell=p=>({x:clamp(Math.floor(p.x/size),0,cols-1),y:clamp(Math.floor(p.y/size),0,rows-1)});
  const start=cell(enemy),end=cell(player),key=p=>p.y*cols+p.x;
  const queue=[start],parents=new Map([[key(start),null]]);let found=false;
  for(let n=0;n<queue.length;n++){
    const p=queue[n];if(key(p)===key(end)){found=true;break;}
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const q={x:p.x+dx,y:p.y+dy},k=key(q);
      if(q.x<0||q.x>=cols||q.y<0||q.y>=rows||parents.has(k)||blocked(q.x*size+20,q.y*size+20,19))continue;
      parents.set(k,p);queue.push(q);
    }
  }
  if(!found||key(start)===key(end))return {...player};
  let q=end;
  while(parents.get(key(q))&&key(parents.get(key(q)))!==key(start))q=parents.get(key(q));
  return {x:q.x*size+20,y:q.y*size+20};
}

export function advance(s,dt,input={}){
  if(s.phase!=='playing')return;
  dt=Math.min(dt,.035);s.time+=dt;s.cooldown=Math.max(0,s.cooldown-dt);s.invulnerable=Math.max(0,s.invulnerable-dt);
  if(input.fire)shoot(s,input.angle??0);
  const p=s.player,mx=input.x??0,my=input.y??0,length=Math.max(1,Math.hypot(mx,my));
  move(p,(mx/length*150+p.vx)*dt,(my/length*150+p.vy)*dt,13);
  p.vx*=Math.exp(-3.4*dt);p.vy*=Math.exp(-3.4*dt);
  for(const flag of s.flags){
    if(!flag.taken&&distance(p,flag)<27){flag.taken=true;s.collected++;s.events.push('pickup');particles(s,flag.x,flag.y,'blue');}
  }
  const atEvac=p.x<75&&Math.abs(p.y-250)<45;
  if(atEvac&&s.collected<3&&!s.atEvac)s.events.push('locked');
  s.atEvac=atEvac;
  if(s.collected===3&&atEvac){s.phase='won';s.events.push('won');return;}
  s.spawnIn-=dt;
  if(s.spawnIn<=0){
    if(s.enemies.length<5){const point=chooseSpawnPoint(s);s.spawnIndex=(point.index+1)%spawnPoints.length;s.enemies.push({x:point.x,y:point.y,pathIn:0,target:{...p}});}
    s.spawnIn=5;
  }
  for(const bullet of s.bullets){
    bullet.x+=bullet.vx*dt;bullet.y+=bullet.vy*dt;bullet.life-=dt;
    if(blocked(bullet.x,bullet.y,3)||bullet.x<0||bullet.x>W||bullet.y<0||bullet.y>H)bullet.life=0;
    if(bullet.life<=0)continue;
    const hit=s.enemies.find(e=>!e.dead&&distance(e,bullet)<17);
    if(hit){hit.dead=true;bullet.life=0;s.kills++;s.events.push('kill');particles(s,hit.x,hit.y,'dust');}
  }
  for(const enemy of s.enemies){
    if(enemy.dead)continue;
    enemy.pathIn-=dt;
    if(enemy.pathIn<=0){enemy.target=waypoint(enemy,p);enemy.pathIn=.3;}
    const target=distance(enemy,p)<45?p:enemy.target,dx=target.x-enemy.x,dy=target.y-enemy.y,norm=Math.hypot(dx,dy)||1;
    move(enemy,dx/norm*85*dt,dy/norm*85*dt,12);
    if(distance(enemy,p)<24&&s.invulnerable===0){
      s.health--;s.invulnerable=1.2;p.vx+=dx/norm*110;p.vy+=dy/norm*110;
      s.events.push('hit');particles(s,p.x,p.y,'dust');
      if(s.health<=0){s.phase='lost';s.events.push('lost');}
    }
  }
  for(const part of s.particles){part.x+=part.vx*dt;part.y+=part.vy*dt;part.life-=dt;}
  s.enemies=s.enemies.filter(e=>!e.dead);s.bullets=s.bullets.filter(b=>b.life>0);s.particles=s.particles.filter(p=>p.life>0);
}
