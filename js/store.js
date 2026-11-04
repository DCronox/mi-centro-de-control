let S=defaultData();
try{const r=localStorage.getItem('mcc1');if(r){const d=JSON.parse(r);if(validData(d))S=Object.assign(S,d)}}catch(e){}
/* Instantánea de los elementos tal como se guardaron por última vez; sirve para detectar cambios y borrados. */
let syncBaseline=new Map();
function resetSyncBaseline(){normalizeData(S);syncBaseline=syncSnapshot(S)}
resetSyncBaseline();
let cloudUser=null,cloudReady=false,cloudPending=null,cloudClient=null,cloudExistingData=null,cloudUpdatedAt=null,cloudSaving=false,cloudLocalCandidate=null,cloudPulling=false;
const CLOUD_URL='https://xruxsuobpctyekkyracr.supabase.co';
const CLOUD_KEY='sb_publishable_-0Zepm3uTSMSM1wMKTvpmA_ZP3vyPaM';
try{if(window.supabase?.createClient)cloudClient=window.supabase.createClient(CLOUD_URL,CLOUD_KEY)}catch(e){}
const cloudStatus=(m)=>{const el=document.getElementById('cloudStatus'),panel=document.getElementById('cloudPanel');if(el)el.textContent=m;if(panel)panel.setAttribute('aria-busy',String(/…$/.test(m)))};
let localRevision=0,saveFailed=false,lastLocalJson=null,cloudResave=false,cloudRetry=null,renderPending=false,syncState='local';
const dirtyKey=()=>'mcc1-dirty-'+(cloudUser?cloudUser.id:'');
const isDirty=()=>{try{return !!cloudUser&&localStorage.getItem(dirtyKey())==='1'}catch(e){return false}};
const setDirty=v=>{try{if(!cloudUser)return;if(v)localStorage.setItem(dirtyKey(),'1');else localStorage.removeItem(dirtyKey())}catch(e){}};
const syncTime=()=>new Intl.DateTimeFormat('es-CO',{timeZone:TZ,hour:'2-digit',minute:'2-digit'}).format(new Date());
/* Indicador de guardado: local · conectando · pendiente · guardando · guardado · sin conexión · error */
function setSync(state){
  syncState=state;
  const t=syncTime(),M={
    local:['Solo en este dispositivo','Tus cambios se guardan solo en este dispositivo. Inicia sesión para que también se guarden en la nube y aparezcan en tus otros dispositivos.'],
    syncing:['Conectando…','Conectando con tu cuenta…'],
    pending:['Cambios sin guardar…','Detecté un cambio. Se guardará en la nube en un instante.'],
    saving:['Guardando…','Guardando en la nube…'],
    saved:['Guardado ✓ · '+t,'Todo guardado en la nube a las '+t+'. Tus otros dispositivos lo reciben solos en unos segundos.'],
    offline:['Sin conexión','Sin conexión: tus cambios están a salvo en este dispositivo y se subirán solos cuando vuelva internet.'],
    error:['No se pudo guardar','No se pudo guardar en la nube. Tus cambios siguen a salvo en este dispositivo y se reintentará solo.']
  }[state]||['',''];
  const pill=document.getElementById('syncPill');
  if(pill){pill.dataset.state=state;pill.querySelector('span').textContent=M[0];pill.setAttribute('aria-label',M[1]);pill.title=M[1]}
  cloudStatus(M[1]);
}
const cloudSchedule=()=>{if(!cloudClient||!cloudUser||!cloudReady)return;setSync(navigator.onLine?'pending':'offline');clearTimeout(cloudPending);cloudPending=setTimeout(()=>{cloudPending=null;cloudSave()},600)};
function softRender(){const a=document.activeElement,app=document.getElementById('app');if(a&&app&&app.contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)){renderPending=true;return}render()}
document.addEventListener('focusout',()=>{if(!renderPending)return;setTimeout(()=>{const a=document.activeElement,app=document.getElementById('app');if(a&&app&&app.contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))return;renderPending=false;render()},60)});
function adopt(d){S=Object.assign(defaultData(),d);resetSyncBaseline();try{lastLocalJson=JSON.stringify(S);if(cloudUser)localStorage.setItem('mcc1-user-'+cloudUser.id,lastLocalJson)}catch(e){}softRender()}
function backupLocal(){try{localStorage.setItem('mcc1-backup-before-cloud',JSON.stringify(S))}catch(e){}}
async function cloudPush(data){
  const updatedAt=new Date().toISOString();
  if(cloudUpdatedAt){
    const r=await cloudClient.from('mcc_data').update({data,updated_at:updatedAt}).eq('user_id',cloudUser.id).eq('updated_at',cloudUpdatedAt).select('updated_at');
    if(r.error)throw r.error;
    if(!r.data||!r.data.length)return{ok:false};
    return{ok:true,updatedAt:r.data[0].updated_at||updatedAt};
  }
  const r=await cloudClient.from('mcc_data').upsert({user_id:cloudUser.id,data,updated_at:updatedAt},{onConflict:'user_id'}).select('updated_at').single();
  if(r.error)throw r.error;
  return{ok:true,updatedAt:(r.data&&r.data.updated_at)||updatedAt};
}
async function cloudMergeRemote(){
  const {data,error}=await cloudClient.from('mcc_data').select('data,updated_at').eq('user_id',cloudUser.id).maybeSingle();
  if(error)throw error;
  if(!data||!data.data){cloudUpdatedAt=null;return}
  if(!validData(data.data))throw new Error('La copia de la nube no tiene el formato esperado.');
  backupLocal();cloudUpdatedAt=data.updated_at||null;adopt(mergeData(data.data,S));
}
async function cloudSave(){
  if(!cloudClient||!cloudUser||!cloudReady)return;
  clearTimeout(cloudPending);cloudPending=null;
  if(cloudSaving){cloudResave=true;return}
  if(!navigator.onLine){setSync('offline');return}
  cloudSaving=true;cloudResave=false;setSync('saving');
  const revision=localRevision;
  try{
    for(let n=0;;n++){
      const r=await cloudPush(S);
      if(r.ok){cloudUpdatedAt=r.updatedAt;break}
      if(n>=3)throw new Error('conflicto');
      await cloudMergeRemote();
    }
    clearTimeout(cloudRetry);
    if(revision===localRevision)setDirty(false);
    if(revision!==localRevision||cloudResave)cloudSchedule();else setSync('saved');
  }catch(e){
    setSync(navigator.onLine?'error':'offline');
    clearTimeout(cloudRetry);cloudRetry=setTimeout(()=>cloudSave(),8000);
  }finally{cloudSaving=false}
}
async function cloudPull(){
  if(!cloudClient||!cloudUser||!cloudReady||cloudSaving||cloudPulling||!navigator.onLine)return;
  cloudPulling=true;
  try{
    const m=await cloudClient.from('mcc_data').select('updated_at').eq('user_id',cloudUser.id).maybeSingle();
    if(m.error||!m.data||m.data.updated_at===cloudUpdatedAt)return;
    const r=await cloudClient.from('mcc_data').select('data,updated_at').eq('user_id',cloudUser.id).maybeSingle();
    if(r.error||!r.data||!r.data.data||!validData(r.data.data)||cloudSaving)return;
    cloudUpdatedAt=r.data.updated_at||null;
    if(isDirty()||cloudPending){backupLocal();adopt(mergeData(r.data.data,S));setDirty(true);cloudSchedule()}
    else{adopt(r.data.data);setDirty(false);setSync('saved')}
  }catch(e){}finally{cloudPulling=false}
}
async function flushCloud(){if(cloudPending||isDirty())await cloudSave()}
const save=()=>{saveFailed=false;let json=null;try{json=JSON.stringify(S)}catch(e){}if(json!==null&&json===lastLocalJson)return true;try{syncBaseline=trackChanges(S,syncBaseline,Date.now());json=JSON.stringify(S)}catch(e){}lastLocalJson=json;localRevision++;try{const key=cloudUser?'mcc1-user-'+cloudUser.id:'mcc1';localStorage.setItem(key,json);if(cloudUser)setDirty(true)}catch(e){saveFailed=true;cloudStatus('No se pudo guardar en este navegador. Descarga una copia de seguridad.')}cloudSchedule();return !saveFailed};
function validData(d){return !!d&&typeof d==='object'&&!Array.isArray(d)&&Array.isArray(d.tx)&&Array.isArray(d.goals)&&Array.isArray(d.routines)&&d.inst&&typeof d.inst==='object'&&Array.isArray(d.shifts)&&(d.budgets===undefined||Array.isArray(d.budgets))&&(d.obligations===undefined||Array.isArray(d.obligations))&&(d.scheduledShifts===undefined||Array.isArray(d.scheduledShifts))}
function exportBackup(){const payload={app:'Mi Centro de Control',version:1,exportedAt:new Date().toISOString(),data:S};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='mi-centro-de-control-'+hoy()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);toast('Copia descargada')}
document.getElementById('exportData').addEventListener('click',exportBackup);
document.getElementById('importData').addEventListener('change',async e=>{const f=e.target.files?.[0];if(!f)return;try{const parsed=JSON.parse(await f.text()),d=parsed?.data||parsed;if(!validData(d))throw new Error('La copia no tiene el formato esperado.');if(!confirm('Restaurar esta copia reemplazará los datos actuales de este dispositivo. Se guardará una copia local de respaldo. ¿Continuar?'))return;try{localStorage.setItem('mcc1-backup-before-import-'+Date.now(),JSON.stringify(S))}catch(_){}const prevDeleted=S.deleted||{};S=Object.assign(defaultData(),d);normalizeData(S);S.deleted=Object.assign({},prevDeleted,S.deleted);gen();save();render();toast('Copia restaurada')}catch(err){alert('No se pudo restaurar la copia: '+(err.message||err))}finally{e.target.value=''}});
