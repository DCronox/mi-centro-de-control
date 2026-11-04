/* ---- Sonidos de la interfaz ----
   Sintetizados en el navegador (Web Audio): no hay archivos de audio ni se descarga nada.
   Volumen bajo, se pueden desactivar en Cuenta › Preferencias. Preferencia por dispositivo. */
let _actx=null,_lastSfx=0;
function soundOn(){try{return localStorage.getItem('mcc-sound')!=='off'}catch(e){return true}}
function setSound(on){try{localStorage.setItem('mcc-sound',on?'on':'off')}catch(e){}}
function _ctx(){
  if(_actx)return _actx;
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
  try{_actx=new AC()}catch(e){_actx=null}
  return _actx;
}
/* Una nota corta con envolvente suave. */
function _tone(ctx,{f=880,f2=null,t=0,dur=.08,type='sine',vol=.06}){
  const o=ctx.createOscillator(),g=ctx.createGain(),now=ctx.currentTime+t;
  o.type=type;o.frequency.setValueAtTime(f,now);if(f2)o.frequency.exponentialRampToValueAtTime(f2,now+dur);
  g.gain.setValueAtTime(0.0001,now);g.gain.exponentialRampToValueAtTime(vol,now+.008);g.gain.exponentialRampToValueAtTime(0.0001,now+dur);
  o.connect(g).connect(ctx.destination);o.start(now);o.stop(now+dur+.02);
}
const SFX={
  tap:ctx=>_tone(ctx,{f:1250,f2:900,dur:.045,type:'triangle',vol:.035}),
  open:ctx=>_tone(ctx,{f:520,f2:780,dur:.09,type:'sine',vol:.04}),
  success:ctx=>{_tone(ctx,{f:660,dur:.09,vol:.05});_tone(ctx,{f:990,t:.075,dur:.14,vol:.045})},
  check:ctx=>{_tone(ctx,{f:880,f2:1320,dur:.07,type:'triangle',vol:.045})},
  uncheck:ctx=>_tone(ctx,{f:700,f2:500,dur:.06,type:'triangle',vol:.03}),
  delete:ctx=>_tone(ctx,{f:320,f2:180,dur:.14,type:'sine',vol:.06}),
  error:ctx=>{_tone(ctx,{f:300,dur:.09,type:'square',vol:.025});_tone(ctx,{f:240,t:.1,dur:.12,type:'square',vol:.025})},
  money:ctx=>{_tone(ctx,{f:1047,dur:.07,vol:.04});_tone(ctx,{f:1319,t:.06,dur:.07,vol:.04});_tone(ctx,{f:1568,t:.12,dur:.16,vol:.04})}
};
/* Reproduce un sonido. Si ya sonó otro hace menos de 120 ms, se omite para no encimarlos. */
function sfx(name){
  if(!soundOn()||!SFX[name])return;
  const now=performance.now();if(now-_lastSfx<120)return;_lastSfx=now;
  const ctx=_ctx();if(!ctx)return;
  try{if(ctx.state==='suspended')ctx.resume();SFX[name](ctx)}catch(e){}
}
