/* Cliente Supabase SIMULADO para probar gym.html en el navegador sin red ni datos reales.
   Uso (consola o herramienta de pruebas): pegar este archivo y luego `await gymMockBoot()`.
   Guarda la «base de datos» simulada en sessionStorage para sobrevivir a una recarga. */
(function(){
  const KEY='gym-mock-db';
  const seed=()=>({gym_routines:[],gym_sessions:[{id:'ses-anterior',routine_id:null,name:'Entreno anterior',started_at:'2026-10-28T11:00:00Z',ended_at:'2026-10-28T12:00:00Z',notes:''}],
    gym_sets:[{id:'set-anterior',session_id:'ses-anterior',exercise_id:'ex-banca',set_index:1,weight_kg:60,reps:10,rpe:null}],
    gym_exercises:[{id:'ex-banca',name:'Press de banca',muscle:'Pecho',notes:'',archived:false,catalog_key:null,muscles:{}}],body_metrics:[],gym_profiles:[],nutrition_targets:[],food_logs:[],water_logs:[],food_custom:[],recovery_logs:[]});
  const load=()=>{try{return JSON.parse(sessionStorage.getItem(KEY))||seed()}catch(e){return seed()}};
  const persist=db=>sessionStorage.setItem(KEY,JSON.stringify(db));
  window.gymMockCalls=[];
  function from(table){
    const st={op:'select',body:null,filters:[],single:false};
    const api={select(){return api},insert(b){st.op='insert';st.body=b;return api},update(b){st.op='update';st.body=b;return api},upsert(b,o){st.op='upsert';st.body=b;st.key=(o&&o.onConflict)||'id';return api},delete(){st.op='delete';return api},
      eq(k,v){st.filters.push([k,v]);return api},in(){return api},gte(k,v){st.filters.push([k,v,"gte"]);return api},lte(k,v){st.filters.push([k,v,"lte"]);return api},order(){return api},limit(){return api},single(){st.single=true;return api},maybeSingle(){st.single=true;return api},
      then(res,rej){
        const db=load();if(/^(food_logs|water_logs|food_custom|recovery_logs)$/.test(table)&&!db[table]&&!db.__noNutri)db[table]=[];const rows=db[table],match=r=>st.filters.every(([k,v,op])=>op==="gte"?String(r[k])>=String(v):op==="lte"?String(r[k])<=String(v):r[k]===v);let data=null;
        gymMockCalls.push(st.op+' '+table);
        if(!rows){persist(db);return Promise.resolve({data:null,error:{message:'Could not find the table public.'+table+' in the schema cache'}}).then(res,rej)}
        if(st.op==='select'){data=st.filters.length?rows.filter(match):rows;if(st.single)data=data[0]||null}
        else if(st.op==='insert'){const list=[].concat(st.body).map(b=>({id:crypto.randomUUID(),created_at:new Date().toISOString(),archived:false,position:0,notes:'',catalog_key:null,muscles:{},...b}));rows.push(...list);data=st.single?list[0]:list}
        else if(st.op==='update'){rows.filter(match).forEach(r=>Object.assign(r,st.body));data=st.single?rows.find(match):null}
        else if(st.op==='upsert'){const ks=st.key.split(',');const out=[];[].concat(st.body).forEach(b=>{const i=rows.findIndex(r=>ks.every(k=>r[k]===b[k]));if(i>=0){rows[i]={...rows[i],...b};out.push(rows[i])}else{const n={created_at:new Date().toISOString(),...b};if(ks[0]==='id'&&!n.id)n.id=crypto.randomUUID();rows.push(n);out.push(n)}});data=st.single?out[0]:out}
        else if(st.op==='delete'){db[table]=rows.filter(r=>!match(r));if(table==='gym_routines')db.gym_sessions.forEach(s=>{if(!db.gym_routines.some(r=>r.id===s.routine_id))s.routine_id=null})}
        persist(db);return Promise.resolve({data,error:null}).then(res,rej);
      }};
    return api;
  }
  window.gymMockDb=()=>load();
  window.gymMockReset=()=>sessionStorage.removeItem(KEY);
  /* Simula que la migración de perfil aún no se aplicó. */
  window.gymMockNoNutriTables=()=>{const db=load();delete db.food_logs;delete db.water_logs;delete db.food_custom;db.__noNutri=true;persist(db)};
  window.gymMockNoProfileTables=()=>{const db=load();delete db.gym_profiles;delete db.nutrition_targets;persist(db)};
  /* Función «food-search» simulada a partir de las respuestas reales de USDA guardadas en tests/fixtures.
     gymMockUsda.mode: 'ok' | 'notDeployed' | 'error'. */
  window.gymMockUsda={mode:'ok',calls:0};
  async function invoke(name,{body}){
    gymMockUsda.calls++;
    const fail=(status,error)=>({data:null,error:{message:'FunctionsHttpError',context:{status,json:async()=>({ok:false,error})}}});
    if(name!=='food-search')return fail(404,'Not found');
    if(gymMockUsda.mode==='notDeployed')return fail(404,'Requested function was not found');
    if(gymMockUsda.mode==='error')return fail(429,'USDA limitó las búsquedas por ahora. Inténtalo más tarde.');
    const U=await import('/supabase/functions/_shared/usda.mjs');
    const full=await (await fetch('/tests/fixtures/usda-full.json')).json();
    const q=U.normQuery(body.query),en=U.toEnglishQuery(q);
    const results=full.map(U.usdaToRef).filter(r=>en.split(' ').some(w=>w.length>2&&r.name_en.toLowerCase().includes(w)));
    return{data:{ok:true,cached:false,demo_key:true,query_en:en,results},error:null};
  }
  window.gymMockBoot=async()=>{gymClient={from,functions:{invoke},auth:{getSession:async()=>({data:{session:{user:{id:'u-prueba',email:'prueba@local'}}},error:null})}};await gymBoot()};
})();
