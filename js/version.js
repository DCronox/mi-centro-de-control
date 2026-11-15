/* Versión de Mi Centro de Control. Única fuente: se muestra en el pie de index.html y gym.html.
   Formato semver; «-dev» mientras la versión no se publique. */
const MCC_VERSION='0.3.0-dev';
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('[data-mcc-version]').forEach(el=>{el.textContent='Versión '+MCC_VERSION})});
if(typeof module!=='undefined')module.exports={MCC_VERSION};
