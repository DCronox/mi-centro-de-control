const TZ='America/Bogota';
const CATS=['Alimentación','Transporte','Universidad','Gimnasio','Hogar','Entretenimiento','Salud','Compras personales','Suscripciones','Trabajo','Otros'];
const fmt=n=>'$'+Math.round(n).toLocaleString('es-CO')+' COP';
const hoy=()=>new Intl.DateTimeFormat('en-CA',{timeZone:TZ}).format(new Date());
const hora=()=>new Intl.DateTimeFormat('en-GB',{timeZone:TZ,hour:'2-digit',minute:'2-digit'}).format(new Date());
/* Identificador único: UUID del navegador; si no existe, 128 bits aleatorios criptográficos. */
const uid=()=>{const c=globalThis.crypto;if(c?.randomUUID)return c.randomUUID();if(c?.getRandomValues){const b=c.getRandomValues(new Uint8Array(16));return [...b].map(x=>x.toString(16).padStart(2,'0')).join('')}return Date.now().toString(36)+Math.random().toString(36).slice(2,12)};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fechaLarga(d){return new Intl.DateTimeFormat('es-CO',{timeZone:TZ,weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(d+'T12:00:00-05:00'))}
function dow(d){return new Date(d+'T12:00:00-05:00').getUTCDay()}
const addDays=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
const DN=['D','L','M','X','J','V','S'],TCATS=['Universidad','Gimnasio','Trabajo','Estudio','Hogar','Personal','Descanso'];
const mins=t=>{const[a,b]=t.split(':').map(Number);return a*60+b};
function mes(d){return d.slice(0,7)};
const dlabel=d=>d===hoy()?'Hoy':d===addDays(hoy(),-1)?'Ayer':new Intl.DateTimeFormat('es-CO',{timeZone:TZ,weekday:'long',day:'numeric',month:'long'}).format(new Date(d+'T12:00:00-05:00'));
function monthShift(m,n){const [y,mm]=m.split('-').map(Number);return new Date(Date.UTC(y,mm-1+n,1)).toISOString().slice(0,7)}
function monthName(m,opts={month:'long',year:'numeric'}){const [y,mm]=m.split('-').map(Number);return new Intl.DateTimeFormat('es-CO',{...opts,timeZone:'UTC'}).format(new Date(Date.UTC(y,mm-1,1)))}
const copCompact=n=>n>=1000000?'$'+(n/1000000).toFixed(1)+' M':n>=1000?'$'+Math.round(n/1000)+' mil':'$'+Math.round(n);
function monthDays(month){const[y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m,0)).getUTCDate()}
function normalizedSearch(v){return String(v||'').toLocaleLowerCase('es-CO').normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
