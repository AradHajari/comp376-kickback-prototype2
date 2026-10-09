import {W,H,crates,chooseSpawnPoint} from './engine.js';

export async function createRenderer(canvas,labelCanvas){
  const gl=canvas.getContext('webgl',{alpha:false,antialias:false});
  if(!gl)throw new Error('WebGL is unavailable. Enable hardware acceleration and reload.');
  const labels=labelCanvas.getContext('2d');
  const colors={grass:[.27,.33,.20],soil:[.32,.35,.23],white:[.91,.94,.85],blue:[.45,.67,.78],dust:[.66,.62,.42],red:[.75,.30,.24],orange:[.85,.63,.34],green:[.66,.81,.44]};
  function program(vertex,fragment){
    const p=gl.createProgram();
    for(const [type,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]){
      const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));gl.attachShader(p,s);
    }
    gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));return p;
  }
  const colorProgram=program('attribute vec2 position;attribute vec3 color;varying vec3 tint;void main(){gl_Position=vec4(position.x/480.0-1.0,1.0-position.y/250.0,0,1);tint=color;}',
    'precision mediump float;varying vec3 tint;void main(){gl_FragColor=vec4(tint,1.0);}');
  const spriteProgram=program('attribute vec2 position;attribute vec2 uv;attribute float opacity;varying vec2 texCoord;varying float alpha;void main(){gl_Position=vec4(position.x/480.0-1.0,1.0-position.y/250.0,0,1);texCoord=uv;alpha=opacity;}',
    'precision mediump float;uniform sampler2D atlas;varying vec2 texCoord;varying float alpha;void main(){vec4 color=texture2D(atlas,texCoord);gl_FragColor=vec4(color.rgb,color.a*alpha);}');
  const colorPosition=gl.getAttribLocation(colorProgram,'position'),colorTint=gl.getAttribLocation(colorProgram,'color');
  const spritePosition=gl.getAttribLocation(spriteProgram,'position'),spriteUV=gl.getAttribLocation(spriteProgram,'uv'),spriteAlpha=gl.getAttribLocation(spriteProgram,'opacity');
  const groundBuffer=gl.createBuffer(),colorBuffer=gl.createBuffer(),spriteBuffer=gl.createBuffer();
  const image=new Image();
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Sprite sheet could not load.'));image.src='assets/sprites.svg';});
  const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  let vertices=[],sprites=[];
  function triangle(a,b,c,tint){for(const p of [a,b,c])vertices.push(...p,...tint);}
  function rect(x,y,w,h,tint){triangle([x,y],[x+w,y],[x,y+h],tint);triangle([x+w,y],[x+w,y+h],[x,y+h],tint);}
  function line(x1,y1,x2,y2,tint,width=1){
    const n=Math.hypot(x2-x1,y2-y1)||1,dx=-(y2-y1)/n*width/2,dy=(x2-x1)/n*width/2;
    triangle([x1+dx,y1+dy],[x2+dx,y2+dy],[x1-dx,y1-dy],tint);triangle([x2+dx,y2+dy],[x2-dx,y2-dy],[x1-dx,y1-dy],tint);
  }
  function text(value,x,y,size=13,color='#ebedda'){
    labels.font=`bold ${size}px Arial,sans-serif`;labels.textAlign='center';labels.textBaseline='middle';labels.fillStyle='#29301f';labels.fillText(value,x+1,y+2);labels.fillStyle=color;labels.fillText(value,x,y);
  }
  function colored(buffer,count){
    gl.useProgram(colorProgram);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.disable(gl.BLEND);gl.disableVertexAttribArray(spriteAlpha);
    gl.enableVertexAttribArray(colorPosition);gl.vertexAttribPointer(colorPosition,2,gl.FLOAT,false,20,0);
    gl.enableVertexAttribArray(colorTint);gl.vertexAttribPointer(colorTint,3,gl.FLOAT,false,20,8);
    gl.drawArrays(gl.TRIANGLES,0,count);
  }
  // The terrain is fixed and uploaded once. Only actors, shots and effects change each frame.
  rect(0,0,W,H,colors.grass);rect(45,231,850,38,colors.soil);rect(817,55,59,391,colors.soil);
  for(const [x,y] of [[145,65],[218,120],[693,86],[755,155],[726,385],[188,423],[427,65],[482,447],[91,363],[879,322],[714,261],[249,287]]){
    rect(x,y,2,6,[.22,.29,.15]);rect(x+4,y+2,2,4,[.34,.41,.24]);
  }
  for(const b of crates)rect(b.x+3,b.y+4,b.w,b.h,[.20,.25,.14]);
  const groundCount=vertices.length/5;gl.bindBuffer(gl.ARRAY_BUFFER,groundBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
  function sprite(col,row,x,y,w,h,angle=0,flip=false,alpha=1){
    const c=Math.cos(angle),s=Math.sin(angle),u0=(col+(flip?1:0))/4,u1=(col+(flip?0:1))/4,v0=row/3,v1=(row+1)/3;
    const corners=[[-w/2,-h/2,u0,v0],[w/2,-h/2,u1,v0],[w/2,h/2,u1,v1],[-w/2,h/2,u0,v1]];
    for(const i of [0,1,2,0,2,3]){const [px,py,u,v]=corners[i];sprites.push(x+px*c-py*s,y+px*s+py*c,u,v,alpha);}
  }
  function draw(state,{aim,kickCue,moving,ready}){
    vertices.length=0;sprites.length=0;labels.clearRect(0,0,W,H);gl.viewport(0,0,W,H);colored(groundBuffer,groundCount);
    const open=state.collected===3,p=state.player,angle=Math.atan2(aim.y-p.y,aim.x-p.x),dx=Math.cos(angle),dy=Math.sin(angle);
    if(open){rect(13,210,56,80,[.35,.45,.23]);line(76,250,47,250,colors.green,4);line(47,250,59,240,colors.green,4);line(47,250,59,260,colors.green,4);}
    sprite(0,2,36,250,49,67);text(open?'EVAC ←':'EVAC',68,192,13,open?'#d4eead':'#c0caae');
    if(!open)text('3 FLAGS',68,208,9,'#c0caae');
    for(const b of crates)for(let y=0;y<4;y++)for(let x=0;x<3;x++)sprite(3,0,b.x+(x+.5)*b.w/3,b.y+(y+.5)*b.h/4,b.w/3,b.h/4);
    state.flags.forEach((flag,i)=>{if(!flag.taken){sprite(2,0,flag.x,flag.y,49,49);text(String(i+1),flag.x,flag.y+32,13,'#c4e3ef');}});
    for(const bullet of state.bullets){const n=Math.hypot(bullet.vx,bullet.vy);line(bullet.x-bullet.vx/n*11,bullet.y-bullet.vy/n*11,bullet.x,bullet.y,colors.orange,3);}
    for(const part of state.particles)rect(part.x-2,part.y-2,4,4,colors[part.color]);
    for(const [i,enemy] of state.enemies.entries()){
      const a=Math.atan2(p.y-enemy.y,p.x-enemy.x),step=Math.floor(state.time*8+i*.7)%2;
      sprite(1,step,enemy.x,enemy.y,43,43,0,Math.cos(a)<0);
      sprite(3,1,enemy.x+Math.cos(a)*12,enemy.y+Math.sin(a)*12,36,36,a);
    }
    if(!ready&&state.phase==='playing'&&state.spawnIn<1.4&&state.enemies.length<5){
      const at=chooseSpawnPoint(state);text('!',Math.max(35,Math.min(W-35,at.x)),Math.max(65,Math.min(H-38,at.y)),23,'#eb9e85');
    }
    if(kickCue>0){
      const x=p.x-dx*65,y=p.y-dy*65;line(p.x-dx*29,p.y-dy*29,x,y,colors.orange,2);
      line(x,y,x+dx*10-dy*6,y+dy*10+dx*6,colors.orange,2);line(x,y,x+dx*10+dy*6,y+dy*10-dx*6,colors.orange,2);
    }
    const step=moving?Math.floor(state.time*8)%2:0,alpha=state.invulnerable>0&&Math.floor(state.time*12)%2?.45:1;
    sprite(0,step,p.x,p.y,44,44,0,dx<0,alpha);sprite(2,1,p.x+dx*9,p.y+dy*9,40,40,angle,false,alpha);
    line(aim.x-5,aim.y,aim.x+5,aim.y,colors.white);line(aim.x,aim.y-5,aim.x,aim.y+5,colors.white);
    gl.bindBuffer(gl.ARRAY_BUFFER,colorBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);colored(colorBuffer,vertices.length/5);
    gl.useProgram(spriteProgram);gl.bindBuffer(gl.ARRAY_BUFFER,spriteBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(sprites),gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(spritePosition);gl.vertexAttribPointer(spritePosition,2,gl.FLOAT,false,20,0);
    gl.enableVertexAttribArray(spriteUV);gl.vertexAttribPointer(spriteUV,2,gl.FLOAT,false,20,8);
    gl.enableVertexAttribArray(spriteAlpha);gl.vertexAttribPointer(spriteAlpha,1,gl.FLOAT,false,20,16);
    gl.bindTexture(gl.TEXTURE_2D,texture);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.TRIANGLES,0,sprites.length/5);
  }
  return {draw};
}
