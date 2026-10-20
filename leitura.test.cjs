const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
function iniciar(memoria = {}) {
  const elementos = {}, folhas = [], links = [];
  const criar = () => ({value:'',textContent:'',children:[],classList:{toggle(){},add(){},remove(){}},replaceChildren(){this.children=[];},append(...itens){this.children.push(...itens);},focus(){}});
  const get = id => elementos[id] ??= criar();
  let callback;
  class Camera { async start(a,b,fn){callback=fn;} async stop(){} async clear(){} }
  const XLSX = {utils:{book_new:()=>({}),aoa_to_sheet:rows=>({rows}),book_append_sheet:(b,s,n)=>folhas.push({nome:n,...s})},writeFile(){}};
  const contexto = {document:{getElementById:get,createElement:criar},localStorage:{getItem:k=>memoria[k] || null,setItem:(k,v)=>{memoria[k]=v;}},structuredClone,window:{Html5Qrcode:Camera,XLSX,open:url=>links.push(url)},Html5Qrcode:Camera,XLSX,confirm:()=>true};
  vm.createContext(contexto); vm.runInContext(fs.readFileSync('leitura.js','utf8'),contexto);
  return {get,folhas,links,memoria,contexto,ler:async valor=>{await get('ler').onclick();await callback(valor);}};
}
(async () => {
  const t = iniciar(), evento = {preventDefault(){}};
  t.get('setor').value='TI';t.get('formSetor').onsubmit(evento);
  t.get('movimento').value='transferencia';t.get('destino').value='RH';t.get('marca').value='Dell';t.get('observacao').value='Remanejado';
  t.get('patrimonio').value='0001';t.get('formulario').onsubmit(evento);
  assert.equal(JSON.parse(t.memoria.monitores_movimentacoes_v2).registros.length,0,'Exige câmera');
  await t.ler('0001');t.get('formulario').onsubmit(evento);
  let dados=JSON.parse(t.memoria.monitores_movimentacoes_v2);
  assert.equal(dados.registros.length,1);assert.equal(dados.registros[0].marca,'Dell');assert.equal(dados.registros[0].destino,'RH');
  t.get('exportar').onclick();assert.equal(t.folhas[0].rows.find(r=>r[0]==='TI')[3],1);assert.equal(t.folhas[0].rows.find(r=>r[0]==='RH')[4],1);assert.equal(t.folhas[1].rows[1][3],'0001');assert.equal(t.folhas[1].rows[1][4],'Dell');assert.equal(t.folhas[1].rows[1][5],'Remanejado');
  await t.get('registros').children[0].children[1].onclick();t.get('marca').value='LG';t.get('observacao').value='Corrigido';t.get('formulario').onsubmit(evento);
  dados=JSON.parse(t.memoria.monitores_movimentacoes_v2);assert.equal(dados.registros.length,1);assert.equal(dados.registros[0].marca,'LG');
  t.get('editarNome').value='Tecnologia';t.get('renomear').onclick();assert.equal(JSON.parse(t.memoria.monitores_movimentacoes_v2).registros[0].setor,'Tecnologia');
  const reaberto=iniciar(t.memoria);reaberto.get('setor').value='RH';reaberto.get('formSetor').onsubmit(evento);assert.equal(reaberto.get('registros').children.length,1);
  reaberto.get('whatsapp').onclick();assert(decodeURIComponent(reaberto.links[0]).includes('Transferências'));
  reaberto.get('registros').children[0].children[2].onclick();assert.equal(JSON.parse(t.memoria.monitores_movimentacoes_v2).registros.length,0);
  const antigo=iniciar({monitores_movimentacoes_v2:JSON.stringify({setores:['Antigo'],registros:[{setor:'Antigo',patrimonio:'007',tipo:'saida',data:new Date().toISOString()}]})});assert.equal(vm.runInContext('dados.registros[0].marca',antigo.contexto),'');
  console.log('OK: câmera, transferência nos dois setores, marca, observação, edição, exclusão, recuperação, compatibilidade, Excel e WhatsApp.');
})().catch(e=>{console.error(e);process.exitCode=1;});
