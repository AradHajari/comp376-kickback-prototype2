import {createGame,advance,shoot} from './engine.js';
import {createRenderer} from './renderer.js';

const canvas=document.querySelector('#game');
const renderer=await createRenderer(canvas,document.querySelector('#labels'));
const note=document.querySelector('#note'),overlay=document.querySelector('#overlay'),start=document.querySelector('#start');
const countdown=document.querySelector('#countdown'),count=document.querySelector('#count');
const goal=document.querySelector('#goal'),health=document.querySelector('#health'),timer=document.querySelector('#time');
let state=createGame(),ready=true,paused=false,aim={x:600,y:250},firing=false,sound=false,audio,last=0,kickCue=0,deployIn=0,goFlash=0;
const keys=new Set(),runs=[];
window.kickbackRuns=runs;
const clock=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
let previousHUD='';
function updateHUD(){
  const value=`${state.collected}/${state.health}/${Math.floor(state.time)}`;
  if(value===previousHUD)return;previousHUD=value;
  goal.textContent=state.collected===3?'ALL FLAGS — EVAC ←':`FLAGS ${state.collected} / 3`;
  goal.classList.toggle('complete',state.collected===3);
  health.textContent='♥ '.repeat(state.health)+'♡ '.repeat(3-state.health);timer.textContent=clock(state.time);
}
function beep(type){
  if(!sound)return;audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();
  const osc=audio.createOscillator(),gain=audio.createGain();osc.type='triangle';osc.frequency.value=type==='pickup'?620:type==='hit'?90:180;
  gain.gain.setValueAtTime(.07,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.08);
  osc.connect(gain);gain.connect(audio.destination);osc.onended=()=>{osc.disconnect();gain.disconnect();};osc.start();osc.stop(audio.currentTime+.09);
}
function show(tag,headline,detail,button){
  overlay.hidden=false;document.querySelector('#briefing-steps').hidden=true;document.querySelector('#warning').hidden=true;
  document.querySelector('#tag').textContent=tag;document.querySelector('#headline').textContent=headline;
  document.querySelector('#detail').textContent=detail;start.textContent=button;
}
function begin(){
  state=createGame();ready=false;paused=false;firing=false;keys.clear();kickCue=0;deployIn=3;goFlash=0;
  overlay.hidden=true;countdown.hidden=false;count.textContent='3';document.querySelector('#pause').textContent='Pause · P';
  note.textContent='Get ready.';canvas.focus({preventScroll:true});
}
function pause(){
  if(ready||state.phase!=='playing')return;paused=!paused;keys.clear();firing=false;
  if(paused){countdown.hidden=true;show('PAUSED','Take a breath.','WASD moves. Mouse aims. Hold click to fire. Recover three blue flags and return to EVAC.','Resume →');}
  else{overlay.hidden=true;countdown.hidden=deployIn<=0&&goFlash<=0;}
  document.querySelector('#pause').textContent=paused?'Resume · P':'Pause · P';
}
function fireOnce(){if(!ready&&!paused&&deployIn<=0)shoot(state,Math.atan2(aim.y-state.player.y,aim.x-state.player.x));}
function pointer(event){const box=canvas.getBoundingClientRect();aim={x:(event.clientX-box.left)/box.width*960,y:(event.clientY-box.top)/box.height*500};}
start.addEventListener('click',()=>paused?pause():begin());document.querySelector('#reset').addEventListener('click',begin);document.querySelector('#pause').addEventListener('click',pause);
document.querySelector('#sound').addEventListener('click',event=>{sound=!sound;event.currentTarget.textContent=`Sound ${sound?'on':'off'}`;event.currentTarget.setAttribute('aria-pressed',sound);beep('pickup');});
canvas.addEventListener('pointermove',pointer);
canvas.addEventListener('pointerdown',event=>{pointer(event);if(event.button===0){firing=true;fireOnce();canvas.focus({preventScroll:true});event.preventDefault();}});
window.addEventListener('pointerup',()=>{firing=false;keys.delete('space');});
const keyMap={ArrowUp:'w',ArrowDown:'s',ArrowLeft:'a',ArrowRight:'d',' ':'space'};
document.addEventListener('keydown',event=>{
  const key=keyMap[event.key]??event.key.toLowerCase();
  if(['w','a','s','d','space'].includes(key)){event.preventDefault();keys.add(key);if(key==='space'&&!event.repeat)fireOnce();}
  if(!event.repeat&&key==='r')begin();if(!event.repeat&&key==='p')pause();
  if(!event.repeat&&key==='enter'&&!overlay.hidden){event.preventDefault();start.click();}
});
document.addEventListener('keyup',event=>keys.delete(keyMap[event.key]??event.key.toLowerCase()));
window.addEventListener('blur',()=>{keys.clear();firing=false;if(!ready&&!paused&&state.phase==='playing')pause();});
document.querySelectorAll('[data-key]').forEach(button=>{
  button.addEventListener('pointerdown',event=>{event.preventDefault();keys.add(button.dataset.key);button.setPointerCapture(event.pointerId);});
  button.addEventListener('pointerup',()=>keys.delete(button.dataset.key));button.addEventListener('pointercancel',()=>keys.delete(button.dataset.key));
});
document.querySelector('#fire').addEventListener('pointerdown',event=>{event.preventDefault();keys.add('space');fireOnce();});
function frame(now){
  const dt=Math.min((now-last)/1000||0,.035);last=now;kickCue=Math.max(0,kickCue-dt);
  if(!ready&&!paused&&state.phase==='playing'){
    if(deployIn>0){
      deployIn=Math.max(0,deployIn-dt);count.textContent=String(Math.ceil(deployIn));
      if(deployIn===0){count.textContent='GO';goFlash=.5;note.textContent='Recover all three blue flags, then return to EVAC on the left.';}
    }else{
      goFlash=Math.max(0,goFlash-dt);countdown.hidden=goFlash===0;
      advance(state,dt,{x:Number(keys.has('d'))-Number(keys.has('a')),y:Number(keys.has('s'))-Number(keys.has('w')),fire:firing||keys.has('space'),angle:Math.atan2(aim.y-state.player.y,aim.x-state.player.x)});
      for(const event of state.events){
        if(['shot','pickup','hit'].includes(event))beep(event);
        if(event==='shot')kickCue=.5;
        if(event==='pickup')note.textContent=state.collected===3?'All flags recovered. Return to green EVAC ←':`${state.collected}/3 flags recovered.`;
        if(event==='locked')note.textContent=`Recover ${3-state.collected} more ${state.collected===2?'flag':'flags'} before extraction.`;
        if(event==='hit')note.textContent='Knife hit! Keep your distance.';
        if(event==='won'||event==='lost'){
          firing=false;keys.clear();runs.push({result:event,seconds:Math.round(state.time),shots:state.shots,flags:state.collected,kills:state.kills});
          show(event==='won'?'MISSION COMPLETE':'MISSION ENDED',event==='won'?'Signals recovered.':'Soldier down.',`${state.collected}/3 flags · ${clock(state.time)} · ${state.shots} shots`,'Deploy again →');
        }
      }
      state.events.length=0;
    }
  }
  renderer.draw(state,{aim,kickCue,moving:keys.has('w')||keys.has('a')||keys.has('s')||keys.has('d')||Math.hypot(state.player.vx,state.player.vy)>10,ready});
  updateHUD();requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
