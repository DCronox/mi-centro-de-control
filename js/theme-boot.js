/* Tema: el elegido por la persona (si lo cambió) o, si no, el del sistema. Se aplica antes de pintar. */
try{const t=localStorage.getItem('mcc-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}
function effectiveTheme(){const t=document.documentElement.dataset.theme;if(t==='light'||t==='dark')return t;return matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
function syncBrowserThemeColor(){const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=effectiveTheme()==='dark'?'#0f1513':'#f3f5f2'}
syncBrowserThemeColor();
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',syncBrowserThemeColor)}catch(e){}
