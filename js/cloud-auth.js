(function setupCloud(){
 const $=id=>document.getElementById(id),authForm=$('cloudAuth'),logged=$('cloudLogged');
 const defaults=()=>({tx:[],goals:[],routines:[],inst:{},budgets:[],obligations:[],scheduledShifts:[],rate:13000,shifts:[]}),accountKey=id=>'mcc1-user-'+id;
 const hasPersonalData=d=>!!(d&&(d.tx?.length||d.goals?.length||d.routines?.length||d.budgets?.length||d.obligations?.length||d.scheduledShifts?.length||d.shifts?.length||Object.keys(d.inst||{}).length));
 const setLocal=(d,key)=>{try{localStorage.setItem(key,JSON.stringify(d));return true}catch(e){return false}};
 const getLocal=key=>{try{const raw=localStorage.getItem(key);if(!raw)return null;const d=JSON.parse(raw);return validData(d)?d:null}catch(e){return null}};
 let authBusy=false;
 if(!cloudClient){cloudStatus('No se pudo cargar el servicio de conexión. Revisa tu conexión a internet y recarga la página.');return}
 function showRecover(){$('cloudRecover').classList.remove('cloud-hidden');authForm.classList.add('cloud-hidden');cloudStatus('Escribe tu nueva contraseña.');$('cloudNewPassword').focus()}
 if(/type=recovery/.test(location.hash+location.search))showRecover();
 function showSignedOut(){cloudUser=null;cloudReady=false;cloudUpdatedAt=null;cloudExistingData=null;cloudLocalCandidate=null;clearTimeout(cloudPending);clearTimeout(cloudRetry);cloudPending=null;const local=getLocal('mcc1');S=Object.assign(defaults(),local||{});try{lastLocalJson=JSON.stringify(S)}catch(e){}gen();render();authForm.classList.remove('cloud-hidden');logged.classList.add('cloud-hidden');setSync('local');cloudStatus('Sesión cerrada. Los datos locales de este dispositivo siguen disponibles aquí.')}
 function showSignedIn(){authForm.classList.add('cloud-hidden');logged.classList.remove('cloud-hidden');$('cloudAccount').textContent='Sesión iniciada: '+(cloudUser.email||'cuenta Supabase')+'.'}
 let signingIn=false;
 async function onSignedIn(user){
  if(!user?.id||signingIn)return;
  signingIn=true;
  try{
   cloudUser=user;cloudReady=false;cloudUpdatedAt=null;showSignedIn();setSync('syncing');
   const accountLocal=getLocal(accountKey(user.id)),legacy=accountLocal?null:getLocal('mcc1'),local=accountLocal||legacy||null;
   let firstTime=true;try{firstTime=!localStorage.getItem('mcc2-synced-'+user.id)}catch(e){}
   const unsynced=isDirty()||firstTime||(!accountLocal&&hasPersonalData(legacy));
   S=Object.assign(defaults(),local||{});try{lastLocalJson=JSON.stringify(S)}catch(e){}render();
   const {data,error}=await cloudClient.from('mcc_data').select('data,updated_at').eq('user_id',user.id).maybeSingle();
   if(error)throw error;
   let mustPush=false;
   if(data&&data.data&&Object.keys(data.data).length){
    if(!validData(data.data)){setSync('error');cloudStatus('La copia de la nube no tiene el formato esperado. No se modificó ni se reemplazó. Descarga una copia local antes de continuar.');return}
    cloudUpdatedAt=data.updated_at||null;
    if(local&&(unsynced||isDirty())){backupLocal();adopt(mergeData(data.data,S));mustPush=true}
    else{adopt(data.data);setDirty(false)}
   }else{cloudUpdatedAt=null;mustPush=true}
   if(mustPush)setDirty(true);
   cloudReady=true;gen();softRender();
   try{localStorage.setItem('mcc2-synced-'+user.id,'1')}catch(e){}
   if(mustPush||isDirty())await cloudSave();else setSync('saved');
  }catch(e){
   setSync(navigator.onLine?'error':'offline');
   if(navigator.onLine)cloudStatus('No se pudieron leer tus datos. Revisa la conexión y las políticas RLS de mcc_data. Se reintentará solo.');
   clearTimeout(cloudRetry);cloudRetry=setTimeout(()=>{if(cloudUser&&!cloudReady)onSignedIn(cloudUser)},8000);
  }finally{signingIn=false}
 }
 authForm.addEventListener('submit',async ev=>{ev.preventDefault();if(authBusy||!authForm.reportValidity())return;const action=ev.submitter?.id||'cloudLogin',email=$('cloudEmail').value.trim(),password=$('cloudPassword').value;authBusy=true;$('cloudLogin').disabled=true;$('cloudSignup').disabled=true;try{if(action==='cloudSignup'){if(!$('cloudConsent').checked){cloudStatus('Para crear la cuenta debes aceptar la Política de privacidad y los Términos, y confirmar que eres mayor de 18 años.');$('cloudConsent').focus();return}$('cloudPassword').setAttribute('autocomplete','new-password');cloudStatus('Creando cuenta…');const {data,error}=await cloudClient.auth.signUp({email,password,options:{data:{legal_version:'2026-10-28',legal_accepted_at:new Date().toISOString()}}});if(error)throw error;if(data.session&&data.user)await onSignedIn(data.user);else cloudStatus('Solicitud de cuenta enviada. Revisa tu correo para confirmarla y luego inicia sesión aquí.')}else{$('cloudPassword').setAttribute('autocomplete','current-password');cloudStatus('Iniciando sesión…');const {data,error}=await cloudClient.auth.signInWithPassword({email,password});if(error)throw error;await onSignedIn(data.user)}}catch(err){cloudStatus('No se pudo completar la solicitud. Verifica el correo, la contraseña y la conexión, e inténtalo de nuevo.')}finally{authBusy=false;$('cloudLogin').disabled=false;$('cloudSignup').disabled=false}});
 async function syncNow(){if(!cloudUser)return;if(!cloudReady){await onSignedIn(cloudUser);return}setSync('saving');await cloudPull();if(isDirty()||cloudPending)await cloudSave();else setSync('saved')}
 $('cloudSyncNow').addEventListener('click',syncNow);
 $('syncPill').addEventListener('click',()=>{if(cloudUser)syncNow();else document.getElementById('cloudPanel').scrollIntoView({behavior:'smooth',block:'start'})});
 $('cloudLogout').addEventListener('click',async()=>{try{await flushCloud()}catch(_){}const was=cloudReady;cloudReady=false;const {error}=await cloudClient.auth.signOut();if(error){cloudReady=was;cloudStatus('No se pudo cerrar sesión. Inténtalo de nuevo.');return}showSignedOut()}); $('cloudForgot').addEventListener('click',async()=>{const email=$('cloudEmail').value.trim();if(!email||!$('cloudEmail').checkValidity()){cloudStatus('Escribe tu correo arriba y vuelve a pulsar «Olvidé mi contraseña».');$('cloudEmail').focus();return}cloudStatus('Enviando enlace…');try{const {error}=await cloudClient.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error;cloudStatus('Si ese correo tiene una cuenta, recibirás un enlace para crear una nueva contraseña.')}catch(e){cloudStatus('No se pudo enviar el enlace. Inténtalo de nuevo.')}});
 $('cloudRecover').addEventListener('submit',async ev=>{ev.preventDefault();try{const {error}=await cloudClient.auth.updateUser({password:$('cloudNewPassword').value});if(error)throw error;$('cloudNewPassword').value='';$('cloudRecover').classList.add('cloud-hidden');history.replaceState(null,'',location.pathname);cloudStatus('Contraseña actualizada.')}catch(e){cloudStatus('No se pudo actualizar la contraseña. Solicita un enlace nuevo si el anterior caducó.')}});
 $('cloudDelete').addEventListener('click',async()=>{if(!cloudUser)return;if(!confirm('Se eliminarán permanentemente tu cuenta y los datos guardados en la nube. Los datos de este navegador se conservan. Descarga una copia antes de continuar. ¿Continuar?'))return;if(prompt('Escribe ELIMINAR para confirmar.')!=='ELIMINAR')return;cloudReady=false;cloudStatus('Eliminando tu cuenta…');try{const {error}=await cloudClient.rpc('delete_my_account');if(error)throw error;try{localStorage.removeItem(accountKey(cloudUser.id));localStorage.removeItem('mcc1-dirty-'+cloudUser.id);localStorage.removeItem('mcc2-synced-'+cloudUser.id)}catch(_){}try{await cloudClient.auth.signOut()}catch(_){}showSignedOut();cloudStatus('Tu cuenta y tus datos en la nube fueron eliminados.')}catch(e){cloudReady=true;cloudStatus('No se pudo eliminar la cuenta. Revisa la conexión y la configuración de Supabase.')}});
 cloudClient.auth.getSession().then(async({data,error})=>{if(error){cloudStatus('No se pudo comprobar la sesión. Recarga la página e inténtalo de nuevo.');return}if(data.session)await onSignedIn(data.session.user);else showSignedOut()});
 setInterval(()=>{if(!document.hidden)cloudPull()},10000);
 document.addEventListener('visibilitychange',()=>{if(document.hidden){if(cloudPending||isDirty())cloudSave()}else cloudPull()});
 window.addEventListener('focus',()=>cloudPull());
 window.addEventListener('online',()=>{if(!cloudUser)return;if(!cloudReady)onSignedIn(cloudUser);else if(isDirty())cloudSave();else cloudPull()});
 window.addEventListener('offline',()=>{if(cloudUser)setSync('offline')});
 window.addEventListener('pagehide',()=>{if(cloudPending||isDirty())cloudSave()});
})();
