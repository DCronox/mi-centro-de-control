try{const t=localStorage.getItem('mcc-theme');if(t)document.documentElement.dataset.theme=t}catch(e){}
function syncBrowserThemeColor(){const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=document.documentElement.dataset.theme==='light'?'#f3f5fa':'#0b0d12'}syncBrowserThemeColor();
