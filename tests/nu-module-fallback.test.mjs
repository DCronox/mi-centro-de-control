import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const begin=html.indexOf('<script>\nfunction showNuImportModuleError()');
assert.notEqual(begin,-1,'el manejador de error del módulo existe');
const end=html.indexOf('</script>',begin);
const inline=html.slice(begin+'<script>'.length,end);

test('si el módulo falla antes de abrir Dinero, muestra una guía al llegar a esa pestaña',()=>{
  const listeners={},context={window:{},mount:null,document:{addEventListener(name,handler){listeners[name]=handler},getElementById(){return context.mount}}};
  vm.runInNewContext(inline,context);
  listeners.error({target:{tagName:'SCRIPT',type:'module',src:'file:///app/nu-import-ui.mjs'}});
  assert.equal(context.window.__mccNuImportUnavailable,true);
  assert.equal(context.mount,null);
  context.mount={innerHTML:''};
  listeners['mcc:rendered']();
  assert.match(context.mount.innerHTML,/localhost/i);
  assert.match(context.mount.innerHTML,/file:\/\//i);
});
