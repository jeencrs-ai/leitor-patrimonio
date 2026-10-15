const $ = id => document.getElementById(id), CHAVE = 'levantamento_monitores_v1';
let dados = [], ativo, editando, patrimonios = [], scanner, cameraIniciando = false, modoCamera = 'velho';
let ultimaCompraValida = 0;
let marcas = {};
const comprar = p => p.quantidadeCompra ?? Math.max(0, 2 - p.novos);
const acrescentar = p => Math.max(0, comprar(p) - p.velhos);
const resumoCompra = p => `Comprar ${comprar(p)} monitor(es) novo(s), sendo ${p.velhos} para substituição e ${acrescentar(p)} para acréscimo.`;
const quantidadesValidas = p => Number.isInteger(comprar(p)) && Number.isInteger(p.velhos) && comprar(p) >= 0 && comprar(p) <= 2 && p.velhos >= 0 && p.velhos <= comprar(p);
const mensagem = t => $('status').textContent = t;
const atual = () => dados.find(s => s.id === ativo);
const novoId = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`;
function mostrarTela(id) {
  ['inicio','telaResumos','telaSalvos','operacao','telaLeitura'].forEach(tela => $(tela).classList.toggle('oculto', tela !== id));
  mensagem(''); window.scrollTo?.(0,0);
}
function abrirSetor(s) {
  ativo = s.id; editando = s.rascunho?.editando || null;
  preencher(s.rascunho); render(); mostrarTela('operacao');
}
function gravar(copia) {
  try { localStorage.setItem(CHAVE, JSON.stringify(copia)); dados = copia; return true; }
  catch { mensagem('Falha ao salvar neste aparelho. Exporte os registros salvos antes de continuar.'); return false; }
}
function alterar(fn) { const copia = structuredClone(dados); fn(copia.find(s => s.id === ativo)); return gravar(copia); }
function botao(texto, fn) { const b = document.createElement('button'); b.className = 'botao botao-secundario'; b.textContent = texto; b.onclick = fn; return b; }
function item(texto) { const d = document.createElement('div'); d.className = 'item'; d.textContent = texto; return d; }
function totais(s) { return s.postos.reduce((t,p) => ({ novos:t.novos+(p.novos || 0), velhos:t.velhos+p.velhos, acrescimos:t.acrescimos+acrescentar(p), compra:t.compra+comprar(p) }), {novos:0,velhos:0,acrescimos:0,compra:0}); }
function formulario() { return {cpu:$('cpu').value, quantidadeCompra:Number($('quantidadeCompra').value), velhos:patrimonios.length, patrimonios:[...patrimonios], marcas:{...marcas}, marcaPendente:$('marca').value}; }
function rascunho() { if (ativo) alterar(s => { s.rascunho = {...formulario(), editando}; }); }
function necessidades(p) {
  return [
    ...Array.from({length:p.velhos}, (_,i) => `Substituição ${i+1}: monitor novo para substituir o patrimônio ${p.patrimonios[i] || '(aguardando leitura do velho)'}.`),
    ...Array.from({length:acrescentar(p)}, (_,i) => `Acréscimo ${i+1}: monitor novo para completar a segunda tela, sem patrimônio de saída.`)
  ];
}
function prever() {
  $('quantidadeCompra').min = String(patrimonios.length);
  const p = formulario();
  $('previsao').textContent = $('quantidadeCompra').value !== '' && quantidadesValidas(p) ? `${p.velhos} substituição(ões) · ${acrescentar(p)} acréscimo(s)` : '';
}
function preencher(p = {cpu:'',quantidadeCompra:2,patrimonios:[]}) {
  $('cpu').value = p.cpu || '';
  $('quantidadeCompra').value = String(comprar(p));
  patrimonios = [...p.patrimonios];
  marcas = {...p.marcas}; $('marca').value = p.marcaPendente || '';
  ultimaCompraValida = quantidadesValidas(formulario()) ? comprar(formulario()) : 2;
  renderPatrimonios();
}
function validarCompra() {
  const campo = $('quantidadeCompra'), valor = Number(campo.value);
  if (campo.value === '' && !campo.validity?.badInput) { rascunho(); prever(); return; }
  if (campo.validity?.badInput || !Number.isInteger(valor) || valor < patrimonios.length || valor > 2) {
    campo.value = String(Math.max(ultimaCompraValida, patrimonios.length));
    mensagem(`Informe de ${patrimonios.length} a 2 monitores a comprar.`);
  } else { ultimaCompraValida = valor; mensagem(''); }
  rascunho(); prever();
}
function renderPatrimonios() {
  $('patrimonios').replaceChildren();
  patrimonios.forEach((p,i) => {
    const d = item(`Velho ${i+1}: ${p}`), label = document.createElement('label'), campo = document.createElement('input');
    label.textContent = 'Marca'; label.className = 'campo'; campo.value = marcas[p] || ''; campo.placeholder = 'Marca do monitor';
    campo.oninput = () => { marcas[p] = campo.value.trim(); rascunho(); };
    label.append(campo); d.append(label);
    d.append(botao('REMOVER', () => { patrimonios.splice(i,1); delete marcas[p]; rascunho(); renderPatrimonios(); })); $('patrimonios').append(d);
  });
  prever();
}
function inicio() {
  renderResumos();
  $('historico').replaceChildren();
  dados.forEach(s => {
    const cartao = item(`${s.setor} · ${s.postos.length} postos · Comprar ${totais(s).compra}`);
    cartao.append(botao('ABRIR SETOR', () => abrirSetor(s)));
    const excluir = botao('EXCLUIR SETOR', () => excluirSetor(s.id));
    excluir.className = 'botao botao-perigo';
    cartao.append(excluir); $('historico').append(cartao);
  });
  if (!dados.length) $('historico').textContent = 'Nenhum levantamento salvo.';
}
function excluirSetor(id) {
  const setor = dados.find(s => s.id === id);
  if (!setor || !confirm(`Excluir o setor "${setor.setor}" e todos os seus ${setor.postos.length} registros de CPU? Esta ação não pode ser desfeita.`)) return;
  if (!gravar(dados.filter(s => s.id !== id))) return;
  if (ativo === id) { ativo = null; editando = null; preencher(); }
  inicio(); mensagem(`Setor "${setor.setor}" excluído.`);
}
function renderResumos() {
  const grupos = new Map();
  dados.forEach(s => {
    const chave = s.setor.trim().toLocaleUpperCase('pt-BR'), t = totais(s);
    const g = grupos.get(chave) || {setor:s.setor, cpus:0, compra:0, velhos:0};
    g.cpus += s.postos.length; g.compra += t.compra; g.velhos += t.velhos; grupos.set(chave,g);
  });
  const geral = [...grupos.values()].reduce((t,g) => ({cpus:t.cpus+g.cpus,compra:t.compra+g.compra,velhos:t.velhos+g.velhos}),{cpus:0,compra:0,velhos:0});
  $('resumoGeral').replaceChildren(); $('resumoSetores').replaceChildren();
  [['Setores',grupos.size],['CPUs',geral.cpus],['Novos a comprar',geral.compra],['Substituições incluídas',geral.velhos]].forEach(([nome,valor]) => {
    const linha = document.createElement('div'), texto = document.createElement('span'), numero = document.createElement('strong'); texto.textContent = nome; numero.textContent = valor; linha.append(texto,numero); $('resumoGeral').append(linha);
  });
  grupos.forEach(g => $('resumoSetores').append(item(`${g.setor} · Novos a comprar: ${g.compra} · Substituições: ${g.velhos}`)));
  if (!grupos.size) $('resumoSetores').textContent = 'Nenhum setor salvo.';
}
function referencia(p, s) { return p.cpu ? `CPU ${p.cpu}` : p.usuario ? `Registro anterior: ${p.usuario}` : `Posto ${s.postos.findIndex(x => x.id === p.id) + 1}`; }
function render() {
  const s = atual(), t = totais(s); $('titulo').textContent = s.setor; $('totais').replaceChildren();
  [['CPUs',s.postos.length],['Total a comprar',t.compra]].forEach(([nome,n]) => {
    const d = document.createElement('div'), span = document.createElement('span'), b = document.createElement('strong'); span.textContent = nome; b.textContent = n; d.append(span,b); $('totais').append(d);
  });
  $('postos').replaceChildren();
  s.postos.forEach(p => {
    const d = item(`${referencia(p, s)} · ${resumoCompra(p)} Patrimônios velhos: ${p.patrimonios.join(', ') || 'Nenhum'}.`);
    d.append(botao('EDITAR', () => { editando = p.id; preencher(p); rascunho(); $('cpu').focus(); }));
    d.append(botao('EXCLUIR', () => { if (confirm(`Excluir ${referencia(p, s)}?`) && alterar(s => { s.postos = s.postos.filter(x => x.id !== p.id); if (s.rascunho?.editando === p.id) delete s.rascunho; })) { if(editando === p.id) {editando = null; preencher();} render(); } }));
    $('postos').append(d);
  });
}
function adicionar(codigo) {
  const p = String(codigo).trim(), chave = v => v.toLocaleUpperCase('pt-BR'); if (!p) return;
  if ($('quantidadeCompra').value === '' || !quantidadesValidas({...formulario(), velhos:patrimonios.length+1})) { mensagem('Os velhos não podem ultrapassar a quantidade a comprar.'); return; }
  if (patrimonios.some(v => chave(v) === chave(p)) || atual().postos.some(x => x.id !== editando && x.patrimonios.some(v => chave(v) === chave(p)))) { mensagem('Patrimônio já registrado neste setor.'); return; }
  patrimonios.push(p); marcas[p] = $('marca').value.trim(); $('marca').value = ''; rascunho(); renderPatrimonios(); $('codigo').value = ''; mensagem(`Patrimônio ${p} registrado.`);
  return true;
}
async function parar() { if (cameraIniciando) return; if (scanner) { const s = scanner; scanner = null; try { await s.stop(); } catch {} try { await s.clear(); } catch {} } }
function linhas(s) { return [['Setor','Patrimônio CPU','Qtd. novos a comprar','Patrimônio velho 1','Marca velho 1','Patrimônio velho 2','Marca velho 2'], ...s.postos.map(p => [s.setor,p.cpu || '',comprar(p),p.patrimonios[0] || '',p.marcas?.[p.patrimonios[0]] || '',p.patrimonios[1] || '',p.marcas?.[p.patrimonios[1]] || ''])]; }
function exportar() {
  if (!atual().postos.length) { mensagem('Salve ao menos um posto antes de exportar.'); return; }
  const tabela = linhas(atual()), nome = `levantamento_${atual().setor.replace(/[^a-zA-Z0-9_-]/g,'_')}`;
  try {
    if (window.XLSX?.utils) {
      const livro = XLSX.utils.book_new(), folha = XLSX.utils.aoa_to_sheet(tabela);
      folha['!cols'] = [24,22,24,24,20,24,20].map(wch => ({wch}));
      folha['!autofilter'] = {ref:`A1:G${tabela.length}`};
      folha['!rows'] = [{hpt:26}];
      XLSX.utils.book_append_sheet(livro,folha,'Monitores'); XLSX.writeFile(livro,`${nome}.xlsx`);
    }
    else {
      const csv = '\uFEFF' + tabela.map(l => l.map(v => { let t = String(v); if (/^[=+\-@\t\r\n]/.test(t)) t = "'" + t; return '"' + t.replaceAll('"','""') + '"'; }).join(';')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})), a = document.createElement('a'); a.href = url; a.download = `${nome}.csv`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
    } mensagem('Levantamento exportado. Apenas postos salvos foram incluídos.');
  } catch(e) { mensagem(`Falha na exportação: ${e.message}`); }
}
function iniciar() {
  try { dados = JSON.parse(localStorage.getItem(CHAVE) || '[]'); if (!Array.isArray(dados)) throw Error(); }
  catch { mensagem('Não foi possível recuperar os dados. O conteúdo salvo foi preservado.'); $('criar').disabled = true; return; }
  inicio();
  $('criar').onclick = () => { const setor = $('setor').value.trim(); if (!setor) return mensagem('Informe o setor.'); const novo = {id:novoId(),setor,postos:[]}; if (gravar([...dados,novo])) abrirSetor(novo); };
  $('abrirResumos').onclick = () => { renderResumos(); mostrarTela('telaResumos'); };
  $('abrirSalvos').onclick = () => { inicio(); mostrarTela('telaSalvos'); };
  $('voltarResumos').onclick = $('voltarSalvos').onclick = () => mostrarTela('inicio');
  $('cpu').oninput = () => { rascunho(); prever(); };
  $('marca').oninput = rascunho;
  $('quantidadeCompra').oninput = validarCompra;
  $('quantidadeCompra').onchange = validarCompra;
  let processandoCodigo = false;
  async function receberCodigo(codigo) {
    if (cameraIniciando || processandoCodigo || !String(codigo).trim()) return;
    processandoCodigo = true;
    try {
      if (modoCamera === 'cpu') {
        const valor = String(codigo).trim();
        if (atual().postos.some(p => p.id !== editando && p.cpu?.toLocaleUpperCase('pt-BR') === valor.toLocaleUpperCase('pt-BR'))) { mensagem('Esta CPU já foi registrada. Volte e edite o registro existente.'); return; }
        $('cpu').value = valor; rascunho();
      } else if (!adicionar(codigo)) return;
      await parar(); $('codigo').value = ''; mostrarTela('operacao');
      mensagem(modoCamera === 'cpu' ? 'CPU lida. Informe a quantidade a comprar.' : 'Monitor velho marcado para substituição.');
    } finally { processandoCodigo = false; }
  }
  $('adicionar').onclick = () => receberCodigo($('codigo').value);
  $('codigo').onkeydown = e => { if(e.key === 'Enter') receberCodigo($('codigo').value); };
  $('salvar').onclick = async () => {
    const p = formulario(); p.cpu = p.cpu.trim();
    if (!p.cpu) return mensagem('Leia ou digite o patrimônio da CPU para identificar este levantamento.');
    if (p.cpu && atual().postos.some(x => x.id !== editando && x.cpu?.toLocaleUpperCase('pt-BR') === p.cpu.toLocaleUpperCase('pt-BR'))) return mensagem('Esta CPU já foi registrada neste setor. Edite o posto existente.');
    if (editando) { const anterior = atual().postos.find(x => x.id === editando); if (anterior?.usuario) p.usuario = anterior.usuario; }
    if (!quantidadesValidas(p) || $('quantidadeCompra').value === '') return mensagem('Informe quantidades inteiras de zero a duas telas no total.');
    p.id = editando || novoId();
    if (!alterar(s => { const i = s.postos.findIndex(x => x.id === p.id); if(i < 0) s.postos.push(p); else s.postos[i] = p; delete s.rascunho; })) return;
    await parar(); editando = null; preencher(); render(); mensagem('CPU finalizada e salva. Leia outra CPU ou finalize o setor abaixo.');
  };
  $('cancelar').onclick = async () => { await parar(); if(alterar(s => {delete s.rascunho;})) {editando = null; preencher(); mensagem('Formulário limpo.');} };
  $('voltar').onclick = async () => { await parar(); ativo = null; inicio(); mostrarTela('inicio'); };
  $('finalizarSetor').onclick = async () => {
    if (cameraIniciando) return;
    if ($('cpu').value.trim() || patrimonios.length || $('marca').value.trim() || $('codigo').value.trim()) {
      mensagem('Finalize a CPU antes de finalizar o setor. Se não quiser guardar este formulário, use LIMPAR / CANCELAR.');
      return;
    }
    await parar();
    if (!alterar(s => { delete s.rascunho; })) return;
    ativo = null; editando = null; $('setor').value = '';
    inicio(); mostrarTela('inicio'); mensagem('Setor finalizado. Os dados continuam em Setores salvos.');
    $('setor').focus();
  };
  async function abrirCamera(modo) {
    if(scanner || cameraIniciando) return;
    if (modo === 'velho' && ($('quantidadeCompra').value === '' || !quantidadesValidas({...formulario(), velhos:patrimonios.length+1}))) return mensagem('Informe a quantidade a comprar antes de ler os velhos.');
    modoCamera = modo; $('codigo').value = ''; mostrarTela('telaLeitura');
    $('tituloLeitura').textContent = modo === 'cpu' ? 'Ler CPU' : 'Ler monitor velho';
    $('ajudaLeitura').textContent = modo === 'cpu' ? 'Leia o patrimônio da CPU.' : `Leia o patrimônio do monitor velho${$('marca').value.trim() ? ' — ' + $('marca').value.trim() : ''}.`;
    $('statusLeitor').textContent = 'Preparando câmera…';
    if(!window.Html5Qrcode) { $('statusLeitor').textContent = 'Leitor indisponível. Digite o patrimônio abaixo.'; return; }
    cameraIniciando = true; $('parar').disabled = true; $('adicionar').disabled = true;
    try { scanner = new Html5Qrcode('reader'); await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:250,height:140}}, receberCodigo); $('statusLeitor').textContent = 'Aponte para o código. A leitura volta automaticamente ao formulário.'; }
    catch { cameraIniciando = false; await parar(); $('statusLeitor').textContent = 'Câmera indisponível. Digite o patrimônio abaixo.'; }
    finally { cameraIniciando = false; $('parar').disabled = false; $('adicionar').disabled = false; }
  };
  $('ler').onclick = () => abrirCamera('velho');
  $('lerCpu').onclick = () => abrirCamera('cpu');
  $('parar').onclick = async () => { if (cameraIniciando || processandoCodigo) return; await parar(); $('codigo').value = ''; mostrarTela('operacao'); };
  $('exportar').onclick = exportar;
}
iniciar();
