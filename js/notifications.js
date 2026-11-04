/* ---- Notificaciones ----
   1) Push real (app cerrada): suscripción Web Push guardada en Supabase; la función «notify» del
      servidor calcula y envía los avisos. Requiere sesión iniciada y el servidor configurado.
   2) Alternativa: mientras la app está abierta se calculan los mismos recordatorios aquí y se muestran
      como aviso del sistema (si hay permiso) y en el historial de la app. Se desactiva cuando este
      dispositivo ya recibe push, para no duplicar. */
let RM=null; // módulo de reglas (js/reminders-core.mjs)
const remindersReady=import(new URL('./js/reminders-core.mjs',location.href).href).then(m=>{RM=m;return m}).catch(()=>null);
const notif={endpoint:null,serverReady:null,devices:[],history:[],loaded:false,busy:false,error:''};
const LOCAL_INBOX='mcc-inbox',LOCAL_FIRED='mcc-fired';
const pushSupported=()=>'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
const isIOS=()=>/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const isStandalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const notifPermission=()=>'Notification' in window?Notification.permission:'unsupported';
function notifPrefs(){return RM?RM.normalizePrefs(S.notifPrefs):Object.assign({enabled:true,categories:{finanzas:true,trabajo:true,metas:true,organizacion:true}},S.notifPrefs||{})}
function saveNotifPrefs(p){S.notifPrefs={...p,u:Date.now()};save()}
const readJSON=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v??d}catch(e){return d}};
const writeJSON=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
function deviceName(){const ua=navigator.userAgent;const os=/Android/.test(ua)?'Android':isIOS()?'iPhone/iPad':/Windows/.test(ua)?'Windows':/Mac/.test(ua)?'Mac':/Linux/.test(ua)?'Linux':'Dispositivo';const br=/Edg\//.test(ua)?'Edge':/SamsungBrowser/.test(ua)?'Samsung Internet':/Firefox\//.test(ua)?'Firefox':/Chrome\//.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'Navegador';return (br+' en '+os).slice(0,80)}
function b64ToBytes(b64){const p='='.repeat((4-b64.length%4)%4),s=atob((b64+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(s,c=>c.charCodeAt(0))}
async function swReg(){if(!('serviceWorker' in navigator))return null;try{return await navigator.serviceWorker.ready}catch(e){return null}}
async function currentSubscription(){const r=await swReg();try{return r?await r.pushManager.getSubscription():null}catch(e){return null}}
function tableMissing(err){return !!err&&(err.code==='42P01'||err.code==='PGRST205'||/does not exist|schema cache/i.test(err.message||''))}

/* Carga estado del servidor: si las tablas existen, dispositivos e historial. */
async function refreshNotif(){
  const sub=await currentSubscription();notif.endpoint=sub?sub.endpoint:null;
  if(!cloudClient||!cloudUser){notif.serverReady=null;notif.devices=[];notif.history=[];notif.loaded=true;return}
  const d=await cloudClient.from('push_subscriptions').select('id,endpoint,device,enabled,created_at,last_seen,fail_count').order('created_at',{ascending:false});
  if(d.error){notif.serverReady=tableMissing(d.error)?false:notif.serverReady;notif.error=tableMissing(d.error)?'':d.error.message;notif.loaded=true;return}
  notif.serverReady=true;notif.devices=d.data||[];
  const h=await cloudClient.from('notifications').select('id,category,title,body,tab,created_at,read_at,status,delivered').order('created_at',{ascending:false}).limit(60);
  notif.history=h.error?[]:(h.data||[]);notif.loaded=true;
}
const thisDeviceRow=()=>notif.devices.find(x=>x.endpoint===notif.endpoint)||null;
const pushActiveHere=()=>!!(notif.serverReady&&cloudUser&&notif.endpoint&&thisDeviceRow()?.enabled);

/* Guarda la suscripción del navegador en Supabase (o la reactiva si ya existía). */
async function storeSubscription(sub){
  const j=sub.toJSON(),row={user_id:cloudUser.id,endpoint:j.endpoint,p256dh:j.keys.p256dh,auth:j.keys.auth,device:deviceName()};
  const ins=await cloudClient.from('push_subscriptions').insert(row);
  if(ins.error&&ins.error.code==='23505'){const up=await cloudClient.from('push_subscriptions').update({enabled:true,device:row.device,last_seen:new Date().toISOString()}).eq('endpoint',j.endpoint).select('id');if(up.error)throw up.error;if(!up.data?.length)throw new Error('Este navegador ya está registrado con otra cuenta. Desactívalo desde esa cuenta o borra los datos del sitio.')}
  else if(ins.error)throw ins.error;
}
async function enablePush(){
  if(notif.busy)return;
  if(!pushSupported()){await notify('Este navegador no admite notificaciones push. Verás los recordatorios dentro de la app.',{title:'No disponible aquí'});return}
  if(isIOS()&&!isStandalone()){await notify('En iPhone las notificaciones solo funcionan con la app instalada: en Safari toca Compartir › «Añadir a pantalla de inicio», abre la app desde ese icono y actívalas allí.',{title:'Primero instala la app'});return}
  if(!cloudUser){await notify('Los avisos con la app cerrada los envía el servidor a partir de tus datos guardados en la nube. Inicia sesión en Cuenta y vuelve aquí.',{title:'Inicia sesión primero'});goTab('cuenta');return}
  if(notif.serverReady===false){await notify('El servidor de notificaciones aún no está configurado en Supabase. Mientras tanto puedes activar los avisos con la app abierta.',{title:'Falta configurar el servidor'});return}
  const ok=await ask('Te avisaremos de pagos que vencen, el inicio de tus turnos, tareas con recordatorio, metas y presupuestos, según tus preferencias. El navegador te pedirá permiso a continuación. Puedes desactivarlo cuando quieras.',{title:'¿Activar notificaciones en este dispositivo?',confirmLabel:'Continuar'});
  if(!ok)return;
  notif.busy=true;softRender();
  try{
    const perm=await Notification.requestPermission();
    if(perm!=='granted'){await notify(perm==='denied'?'El permiso está bloqueado. Actívalo en la configuración del sitio del navegador (icono del candado junto a la dirección) y vuelve a intentarlo.':'No se concedió el permiso. Puedes intentarlo de nuevo cuando quieras.',{title:'Sin permiso'});return}
    const reg=await swReg();if(!reg)throw new Error('No se encontró el service worker.');
    let sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToBytes(VAPID_PUBLIC_KEY)});
    await storeSubscription(sub);
    await refreshNotif();toast('Notificaciones activadas en este dispositivo');
  }catch(e){await notify('No se pudieron activar: '+(e.message||e),{title:'Algo falló'})}
  finally{notif.busy=false;softRender()}
}
async function disablePushHere(){
  if(!await ask('Este dispositivo dejará de recibir avisos con la app cerrada.',{title:'¿Desactivar en este dispositivo?',confirmLabel:'Desactivar'}))return;
  notif.busy=true;softRender();
  try{const sub=await currentSubscription();if(sub){if(cloudClient&&cloudUser)await cloudClient.from('push_subscriptions').delete().eq('endpoint',sub.endpoint);await sub.unsubscribe()}await refreshNotif();toast('Notificaciones desactivadas en este dispositivo')}
  catch(e){toast('No se pudo desactivar: '+(e.message||e),'error')}
  finally{notif.busy=false;softRender()}
}
/* Al cerrar sesión: este dispositivo deja de recibir avisos de esa cuenta. */
async function pushForgetDevice(){try{const sub=await currentSubscription();if(sub&&cloudClient&&cloudUser)await cloudClient.from('push_subscriptions').delete().eq('endpoint',sub.endpoint);if(sub)await sub.unsubscribe()}catch(e){}}
async function sendTestPush(){
  notif.busy=true;softRender();
  try{const {data,error}=await cloudClient.functions.invoke('notify',{body:{action:'test'}});if(error)throw error;
    if(!data?.ok)throw new Error(data?.error||'Respuesta inesperada');
    toast(data.delivered?'Prueba enviada a '+data.delivered+' dispositivo(s)':'No hay dispositivos activos que recibieran la prueba',data.delivered?'success':'error');await refreshNotif()}
  catch(e){await notify('No se pudo enviar la prueba: '+(e.message||e)+'. Comprueba que la función «notify» esté desplegada con sus secretos.',{title:'Prueba no enviada'})}
  finally{notif.busy=false;softRender()}
}
async function setDeviceEnabled(id,enabled){const r=await cloudClient.from('push_subscriptions').update({enabled}).eq('id',id);if(r.error)toast('No se pudo cambiar: '+r.error.message,'error');await refreshNotif();softRender()}
async function removeDevice(id){if(!await ask('Ese dispositivo dejará de recibir notificaciones.',{title:'¿Quitar dispositivo?',confirmLabel:'Quitar',danger:true}))return;const r=await cloudClient.from('push_subscriptions').delete().eq('id',id);if(r.error)toast('No se pudo quitar: '+r.error.message,'error');else sfx('delete');await refreshNotif();softRender()}
async function markRead(id){
  if(String(id).startsWith('local:')){const box=readJSON(LOCAL_INBOX,[]);const it=box.find(x=>x.id===id);if(it)it.read_at=new Date().toISOString();writeJSON(LOCAL_INBOX,box)}
  else if(cloudClient&&cloudUser){await cloudClient.from('notifications').update({read_at:new Date().toISOString()}).eq('id',id);const it=notif.history.find(x=>String(x.id)===String(id));if(it)it.read_at=new Date().toISOString()}
}
async function markAllRead(){
  const now=new Date().toISOString(),box=readJSON(LOCAL_INBOX,[]);box.forEach(x=>{if(!x.read_at)x.read_at=now});writeJSON(LOCAL_INBOX,box);
  if(cloudClient&&cloudUser&&notif.serverReady){await cloudClient.from('notifications').update({read_at:now}).is('read_at',null);notif.history.forEach(x=>{if(!x.read_at)x.read_at=now})}
}
function inboxItems(){
  const local=readJSON(LOCAL_INBOX,[]).map(x=>({...x,local:true}));
  return [...notif.history,...local].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,80);
}
const unreadCount=()=>inboxItems().filter(x=>!x.read_at).length;

/* ---- Motor local (app abierta) ---- */
async function runLocalReminders(){
  const m=await remindersReady;if(!m)return;
  const prefs=notifPrefs();if(!prefs.enabled||pushActiveHere())return;
  const fired=readJSON(LOCAL_FIRED,{}),now=Date.now();
  Object.keys(fired).forEach(k=>{if(now-fired[k]>21*864e5)delete fired[k]});
  const due=m.computeReminders(S,prefs,now,{windowMs:30*60000}).filter(r=>!fired[r.key]);
  if(!due.length){writeJSON(LOCAL_FIRED,fired);return}
  const box=readJSON(LOCAL_INBOX,[]),reg=notifPermission()==='granted'?await swReg():null;
  for(const r of due){
    fired[r.key]=now;
    box.unshift({id:'local:'+r.key,category:r.category,title:r.title,body:r.body,tab:r.tab,created_at:new Date().toISOString(),read_at:null});
    if(reg){try{await reg.showNotification(r.title,{body:r.body,icon:'./icon-192.png',badge:'./icon-192.png',tag:r.key,data:{tab:r.tab},lang:'es-CO'})}catch(e){}}
  }
  writeJSON(LOCAL_INBOX,box.slice(0,100));writeJSON(LOCAL_FIRED,fired);
  if(!reg||document.visibilityState==='visible'){sfx('open');toast(due.length===1?due[0].title:due.length+' recordatorios nuevos · '+due[0].title)}
  nav();
}
/* Permiso para avisos con la app abierta (sin servidor). */
async function enableLocalAlerts(){
  if(!('Notification' in window)){await notify('Este navegador no admite avisos del sistema. Los verás dentro de la app.',{title:'No disponible'});return}
  if(!await ask('Mientras la app esté abierta (aunque en otra pestaña), te avisaremos con una notificación del sistema. Para recibirlas con la app cerrada hace falta el servidor.',{title:'¿Permitir avisos con la app abierta?',confirmLabel:'Continuar'}))return;
  const p=await Notification.requestPermission();toast(p==='granted'?'Avisos con la app abierta activados':'No se concedió el permiso',p==='granted'?'success':'error');softRender();
}
setInterval(()=>{runLocalReminders()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)runLocalReminders()});
remindersReady.then(()=>setTimeout(runLocalReminders,1500));

/* Abrir la sección indicada por una notificación (#mov, #turnos…). */
function openFromHash(){const h=location.hash.replace(/^#/,''),[t,q]=h.split('&');if(!t)return;const id=(q||'').startsWith('n=')?decodeURIComponent(q.slice(2)):null;if(TABS.some(x=>x[0]===t)){goTab(t);if(id)markRead(id)}history.replaceState(null,'',location.pathname)}
if('serviceWorker' in navigator)navigator.serviceWorker.addEventListener('message',e=>{
  const d=e.data||{};
  if(d.type==='open-tab'&&TABS.some(x=>x[0]===d.tab)){goTab(d.tab);if(d.id)markRead(d.id)}
  if(d.type==='push-resubscribe'&&cloudUser&&notifPermission()==='granted')(async()=>{try{const reg=await swReg();const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToBytes(VAPID_PUBLIC_KEY)});await storeSubscription(sub)}catch(e){}})();
});
