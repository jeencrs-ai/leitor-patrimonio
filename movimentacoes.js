const $ = id => document.getElementById(id);
const CHAVE = 'patrimonio_movimentacoes_v1';
let banco, revisao = 0, gravando = false;
let trocas = [];
let setoresCadastrados = [];
let editandoId = null;
let retornoCadastro = 'operacao', retornoConfirmacao = 'operacao', ultimoSalvoId = null;
let registros = [], setor = '', modo = '', filtroSetor = '', retornoResumo = 'inicio', camera = null, cameraPendente = false, destinoCamera = null, indisponivel = false;
const msg = texto => $('status').textContent = texto;
const normalizar = texto => texto.trim().toLocaleUpperCase('pt-BR');
const chaveSetor = nome => nome.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleUpperCase('pt-BR');
function setorDuplicado(nome,atual = '') {
  return setoresCadastrados.find(s => s !== atual && chaveSetor(s) === chaveSetor(nome));
}
function avisarSetorDuplicado(campo,nome) {
  const aviso = `O setor "${nome}" já está cadastrado. Use o setor existente na lista.`;
  msg(aviso); campo.setCustomValidity(aviso);
  if (campo.id === 'nomeCadastroSetor') {
    renderCatalogoSetores();
    $('nomeSetorExistente').textContent = nome;
    $('usarSetorExistente').dataset.setor = nome;
    $('setorExistenteBox').hidden = false;
    $('usarSetorExistente').focus();
    $('setorExistenteBox').scrollIntoView({behavior:'smooth',block:'nearest'});
  } else campo.reportValidity();
}
const nomesCampos = {cpu:'CPU',monitor1:'Monitor 1',monitor2:'Monitor 2',patrimonio:'Patrimônio de saída'};
function tela(id) {
  ['inicio','operacao','cadastro','confirmacao','resumo','exclusao','consulta','trocaCpu','cadastroSetores'].forEach(x => $(x).hidden = x !== id);
  msg(''); window.scrollTo(0,0);
}
async function gravar(copia, trocasCopia = trocas, fazerBackup = false, catalogo = setoresCadastrados) {
  if (indisponivel || !banco) { msg('IndexedDB indisponível. Os dados anteriores foram preservados.'); return false; }
  if (gravando) return false;
  gravando = true;
  try {
    await new Promise((resolve,reject) => {
      const tx = banco.transaction(['estado','trocas','backups'],'readwrite'), store = tx.objectStore('estado');
      let conflito = false;
      const pedido = store.get('atual');
      pedido.onsuccess = () => {
        if ((pedido.result?.revisao || 0) !== revisao) { conflito = true; tx.abort(); return; }
        if (fazerBackup) tx.objectStore('backups').put({data:new Date().toISOString(),registros:pedido.result?.registros || copia,trocas:structuredClone(trocas),setores:pedido.result?.setores || catalogo},`antes_troca_${revisao}`);
        store.put({registros:copia,revisao:revisao+1,setores:catalogo},'atual');
        const destino = tx.objectStore('trocas'); destino.clear(); trocasCopia.forEach(t => destino.put(t));
      };
      tx.oncomplete = resolve;
      tx.onabort = () => reject(Error(conflito ? 'Os dados foram alterados em outra aba. Recarregue a página antes de salvar.' : 'A gravação foi cancelada.'));
      tx.onerror = () => {};
    });
    revisao++; registros = copia; trocas = trocasCopia; setoresCadastrados = catalogo; atualizarSetores(); return true;
  } catch(e) { msg(`Não foi possível salvar no IndexedDB. ${e.message}`); return false; }
  finally { gravando = false; }
}
function validarDuplicidade(r, lista) {
  const entrada = r.movimento === 'ENTRADA';
  if (!entrada && !['VELHO','BAIXA'].includes(r.tipo)) return '';
  const codigos = (entrada ? [r.cpu,r.monitor1,r.monitor2] : [r.patrimonio]).filter(v => v?.trim()).map(normalizar);
  if (new Set(codigos).size !== codigos.length) return `Patrimônio ${codigos.find((c,i) => codigos.indexOf(c) !== i)} repetido nesta entrada. CPU e monitores devem ter patrimônios diferentes.`;
  if (entrada) {
    const usado = trocas.find(t => t.nova.cadastroNovo && codigos.includes(normalizar(t.nova.patrimonio)));
    if (usado) return `Patrim\u00f4nio ${usado.nova.patrimonio} j\u00e1 cadastrado na troca de CPU do setor ${usado.setor}.`;
  }
  for (const outro of lista) {
    if (outro.id === r.id) continue;
    if (entrada ? outro.movimento !== 'ENTRADA' : outro.movimento !== 'SAÍDA' || !['VELHO','BAIXA'].includes(outro.tipo)) continue;
    const usados = (entrada ? [outro.cpu,outro.monitor1,outro.monitor2] : [outro.patrimonio]).filter(v => v?.trim()).map(normalizar);
    const repetido = codigos.find(c => usados.includes(c));
    if (repetido) return `Patrimônio ${repetido} já registrado em ${entrada ? 'entrada de novo' : 'saída de velho'} no setor ${outro.setor}. Edite o registro existente.`;
  }
  return '';
}
let campoDuplicado = null;
function alertarDuplicidade(erro,campo) {
  msg(erro);
  campoDuplicado = campo || ['cpu','monitor1','monitor2','patrimonio'].map($).find(c => !c.disabled && c.value.trim() && erro.includes(normalizar(c.value)));
  $('mensagemDuplicidade').textContent = erro;
  if (!$('alertaDuplicidade').open) $('alertaDuplicidade').showModal();
  $('corrigirDuplicidade').focus();
}
function verificarCamposDigitados(campo) {
  if (!['cpu','monitor1','monitor2','patrimonio'].includes(campo.id) || !campo.value.trim()) return true;
  const candidato = {id:editandoId,movimento:modo,tipo:document.querySelector('input[name=tipo]:checked')?.value};
  ['cpu','monitor1','monitor2','patrimonio'].forEach(id => { candidato[id] = $(id).value.trim(); });
  const erro = validarDuplicidade(candidato,registros);
  if (!erro) return true;
  alertarDuplicidade(erro,campo); return false;
}
function atualizarSetores() {
  const selecionado = $('setor').value;
  $('setores').replaceChildren(); $('renomear').replaceChildren(); $('setor').replaceChildren();
  const vazio = document.createElement('option'); vazio.value = ''; vazio.textContent = 'Selecione um setor cadastrado'; $('setor').append(vazio);
  setoresCadastrados.slice().sort((a,b) => a.localeCompare(b,'pt-BR')).forEach(nome => {
    const opcao = document.createElement('option'); opcao.value = nome; $('setores').append(opcao);
    const escolha = document.createElement('option'); escolha.value = nome; escolha.textContent = nome; $('renomear').append(escolha);
    const item = document.createElement('option'); item.value = nome; item.textContent = nome; $('setor').append(item);
  });
  $('setor').value = setoresCadastrados.includes(selecionado) ? selecionado : '';
  if (filtroSetor) $('renomear').value = filtroSetor;
  renderSetoresSalvos();
  renderCatalogoSetores();
  ['destino','destinoSetorTroca'].forEach(id => {
    const campo = $(id), valor = campo.value; campo.replaceChildren();
    const inicial = document.createElement('option'); inicial.value = ''; inicial.textContent = 'Selecione um setor cadastrado'; campo.append(inicial);
    setoresCadastrados.slice().sort((a,b) => a.localeCompare(b,'pt-BR')).forEach(nome => { const opcao = document.createElement('option'); opcao.value = nome; opcao.textContent = nome; campo.append(opcao); });
    campo.value = valor;
  });
}
function renderCatalogoSetores() {
  $('listaCadastroSetores').replaceChildren();
  const busca = chaveSetor($('nomeCadastroSetor').value);
  const nomes = setoresCadastrados.filter(nome => !busca || chaveSetor(nome).includes(busca)).sort((a,b) => a.localeCompare(b,'pt-BR'));
  $('totalCadastroSetores').textContent = `${nomes.length} setor(es) encontrado(s) de ${setoresCadastrados.length} cadastrado(s).`;
  nomes.forEach(nome => {
    const card = document.createElement('article'); card.className = 'registro';
    const titulo = document.createElement('h3'); titulo.textContent = nome;
    const usar = document.createElement('button'); usar.className = 'secundario'; usar.textContent = 'Usar este setor'; usar.onclick = () => abrirSetorSalvo(nome);
    const editar = document.createElement('button'); editar.className = 'voltar'; editar.textContent = 'Corrigir nome'; editar.onclick = () => corrigirSetor(nome);
    card.append(titulo,usar,editar); $('listaCadastroSetores').append(card);
  });
  if (!nomes.length) $('listaCadastroSetores').textContent = setoresCadastrados.length ? 'Nenhum setor encontrado com este nome.' : 'Nenhum setor cadastrado. Cadastre o primeiro acima.';
}
$('abrirCadastroSetores').onclick = () => { $('nomeCadastroSetor').value = ''; $('nomeCadastroSetor').setCustomValidity(''); $('setorExistenteBox').hidden = true; renderCatalogoSetores(); tela('cadastroSetores'); };
$('usarSetorExistente').onclick = () => {
  const nome = $('usarSetorExistente').dataset.setor;
  if (!setoresCadastrados.includes(nome)) return msg('Setor indisponível. Atualize a lista para consultar novamente.');
  $('nomeCadastroSetor').value = ''; $('nomeCadastroSetor').setCustomValidity(''); $('setorExistenteBox').hidden = true;
  abrirSetorSalvo(nome);
};
$('limparBuscaSetores').onclick = () => { $('nomeCadastroSetor').value = ''; $('nomeCadastroSetor').setCustomValidity(''); $('setorExistenteBox').hidden = true; renderCatalogoSetores(); };
$('voltarCadastroSetores').onclick = () => tela('inicio');
$('formCadastroSetor').onsubmit = async e => {
  e.preventDefault(); const nome = $('nomeCadastroSetor').value.trim().replace(/\s+/g,' ');
  if (!nome) return msg('Informe o nome do setor.');
  const existente = setorDuplicado(nome);
  if (existente) return avisarSetorDuplicado($('nomeCadastroSetor'),existente);
  if (!await gravar(registros,trocas,false,[...setoresCadastrados,nome])) return;
  $('nomeCadastroSetor').value = ''; $('setor').value = nome; $('setorExistenteBox').hidden = true; renderCatalogoSetores(); msg(`Setor ${nome} cadastrado. Agora ele está disponível na lista.`);
};
['nomeCadastroSetor','novoNome'].forEach(id => { $(id).addEventListener('input',() => $(id).setCustomValidity('')); });
$('nomeCadastroSetor').addEventListener('input',() => { $('setorExistenteBox').hidden = true; renderCatalogoSetores(); });
function abrirSetorSalvo(nome) {
  setor = nome; $('setor').value = nome; $('nomeSetor').textContent = nome;
  editandoId = null; atualizarSetores(); tela('operacao');
}
function corrigirSetor(nome) {
  abrirResumo(nome,'inicio'); $('renomear').value = nome; $('novoNome').value = nome;
  $('configSetor').open = true; $('novoNome').focus();
}
let mostrarTodosSetores = false;
function renderSetoresSalvos() {
  const lista = $('setoresSalvos'); lista.replaceChildren();
  const recentes = new Map();
  [...registros,...trocas].forEach(r => {
    const chave = normalizar(r.setor), data = Date.parse(r.editadaEm || r.atualizadoEm || r.data || '') || 0;
    recentes.set(chave,Math.max(recentes.get(chave) || 0,data));
  });
  const grupos = gruposResumo(registros).sort((a,b) => (recentes.get(normalizar(b.setor)) || 0) - (recentes.get(normalizar(a.setor)) || 0) || a.setor.localeCompare(b.setor,'pt-BR'));
  const verMais = $('verMaisSetores');
  verMais.hidden = grupos.length <= 5;
  verMais.textContent = mostrarTodosSetores ? 'Mostrar apenas os 5 mais recentes' : `Ver mais (${Math.max(0,grupos.length-5)} setores)`;
  verMais.setAttribute('aria-expanded',String(mostrarTodosSetores));
  (mostrarTodosSetores ? grupos : grupos.slice(0,5)).forEach(g => {
    const card = document.createElement('article'); card.className = 'registro';
    const titulo = document.createElement('h3'); titulo.textContent = g.setor;
    const info = document.createElement('p'); info.textContent = `${g.novos} novos · ${g.velhos} velhos · ${g.doacoes} doações · ${trocas.filter(t => normalizar(t.setor) === normalizar(g.setor)).length} trocas de CPU`;
    const abrir = document.createElement('button'); abrir.className = 'primario'; abrir.textContent = 'Abrir setor / adicionar item'; abrir.onclick = () => abrirSetorSalvo(g.setor);
    const editar = document.createElement('button'); editar.className = 'secundario'; editar.textContent = 'Ver e editar dados'; editar.onclick = () => abrirResumo(g.setor,'inicio');
    const nome = document.createElement('button'); nome.className = 'voltar'; nome.textContent = 'Corrigir nome do setor'; nome.onclick = () => corrigirSetor(g.setor);
    const zap = document.createElement('button'); zap.className = 'secundario'; zap.textContent = 'Resumo do setor para WhatsApp'; zap.onclick = () => abrirRelatorioMonitores(registros.filter(r => normalizar(r.setor) === normalizar(g.setor)));
    card.append(titulo,info,abrir,editar,zap,nome); lista.append(card);
  });
  if (!lista.children.length) lista.textContent = 'Os setores com registros salvos aparecerão aqui.';
}
$('verMaisSetores').onclick = () => { mostrarTodosSetores = !mostrarTodosSetores; renderSetoresSalvos(); };
function campo(id,container) {
  $(`ler_${id}`).onclick = () => abrirCamera(id);
  document.querySelectorAll(`input[name="marca_${id}"]`).forEach(c => { c.onchange = atualizarMarcas; });
}
function atualizarMarcas() {
  ['cpu','monitor1','monitor2','patrimonio'].forEach(id => {
    const entrada = id === 'patrimonio' ? modo === 'SAÍDA' : modo === 'ENTRADA';
    const tipo = document.querySelector('input[name=tipo]:checked')?.value;
    const ordem = tipo === 'VELHO' ? ['HP','BenQ','Lenovo'] : ['AOC','Lenovo','Positivo','Outros'];
    document.querySelectorAll(`input[name="marca_${id}"]`).forEach(c => {
      const permitido = id !== 'patrimonio' || (!!tipo && ordem.includes(c.value));
      c.disabled = !entrada || !permitido; c.required = id === 'patrimonio' && entrada && permitido;
      if (id === 'patrimonio') {
        c.closest('label').hidden = !permitido;
        c.closest('label').style.order = ordem.indexOf(c.value);
        if (!permitido) c.checked = false;
      }
    });
    const outros = entrada && document.querySelector(`input[name="marca_${id}"]:checked`)?.value === 'Outros';
    $(`outraMarcaBox_${id}`).hidden = !outros;
    $(`outraMarca_${id}`).disabled = !outros; $(`outraMarca_${id}`).required = outros;
  });
}
function lerMarcas() {
  return Object.fromEntries(['cpu','monitor1','monitor2'].map(id => {
    const valor = document.querySelector(`input[name="marca_${id}"]:checked`)?.value || '';
    return [id,valor === 'Outros' ? $(`outraMarca_${id}`).value.trim() : valor];
  }));
}
function focarProximo(elemento) {
  if (!elemento || elemento.disabled) return;
  elemento.focus();
  elemento.closest('.campo-patrimonio')?.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function proximoEquipamento(id) {
  if (id === 'patrimonio') { focarProximo($('salvar')); return; }
  const campos = ['cpu','monitor1','monitor2'];
  focarProximo($(campos[campos.indexOf(id)+1] || 'salvar'));
}
function avancarCampo(campo) {
  if (!verificarCamposDigitados(campo)) return;
  if (['cpu','monitor1','monitor2'].includes(campo.id)) {
    focarProximo(document.querySelector(`input[name="marca_${campo.id}"]:checked`) || document.querySelector(`input[name="marca_${campo.id}"]`));
  } else if (campo.name?.startsWith('marca_')) {
    campo.checked = true;
    const id = campo.name.slice(6);
    atualizarMarcas();
    if (campo.value === 'Outros') focarProximo($(`outraMarca_${id}`));
    else proximoEquipamento(id);
  } else if (campo.id?.startsWith('outraMarca_')) {
    if (!campo.reportValidity()) return;
    proximoEquipamento(campo.id.slice(11));
  } else if (campo.name === 'tipo') {
    campo.checked = true;
    atualizarOrigem(); focarProximo($(campo.value === 'SEMINOVO' ? 'destino' : 'patrimonio'));
  } else if (['origem','destino'].includes(campo.id)) {
    if (campo.reportValidity()) focarProximo($('patrimonio'));
  } else if (campo.id === 'patrimonio') {
    if (campo.reportValidity()) {
      const tipo = document.querySelector('input[name=tipo]:checked')?.value;
      focarProximo(document.querySelector('input[name=marca_patrimonio]:checked') || document.querySelector(`input[name=marca_patrimonio][value="${tipo === 'VELHO' ? 'HP' : 'AOC'}"]`));
    }
  }
}
function configurarModo(novoModo, voltar = 'operacao') {
  retornoCadastro = voltar;
  $('voltarCadastro').textContent = voltar === 'resumo' ? '← Voltar aos registros' : voltar === 'confirmacao' ? '← Voltar à confirmação' : '← Movimentações';
  editandoId = null; $('salvar').textContent = 'Salvar registro';
  modo = novoModo; $('formMovimento').reset();
  const entrada = modo === 'ENTRADA';
  $('tiposSaida').hidden = entrada; $('camposEntrada').hidden = !entrada; $('camposSaida').hidden = entrada;
  document.querySelectorAll('input[name=tipo]').forEach(r => { r.required = !entrada; r.disabled = entrada; });
  ['cpu','monitor1','monitor2'].forEach(id => { $(id).disabled = !entrada; $(id).required = false; });
  $('patrimonio').disabled = entrada; $('patrimonio').required = !entrada;
  atualizarOrigem();
  $('rotuloFormulario').textContent = setor;
  $('tituloFormulario').textContent = entrada ? 'Entrada · Computador novo' : 'Saída · Velho ou Seminovo';
  tela('cadastro');
  focarProximo(entrada ? $('cpu') : document.querySelector('input[name=tipo]'));
}
function atualizarOrigem() {
  atualizarMarcas();
  const doacao = modo === 'SAÍDA' && document.querySelector('input[name=tipo]:checked')?.value === 'DOAÇÃO';
  const seminovo = modo === 'SAÍDA' && document.querySelector('input[name=tipo]:checked')?.value === 'SEMINOVO';
  $('destinoBox').hidden = !seminovo; $('destino').required = seminovo; $('destino').disabled = !seminovo;
  $('origemBox').hidden = !doacao; $('origem').required = doacao; $('origem').disabled = !doacao;
}
function preenchido() {
  return ['cpu','monitor1','monitor2','patrimonio','origem','destino'].some(id => !$(id).disabled && $(id).value.trim()) || !!document.querySelector('input[name=tipo]:checked') || (modo === 'ENTRADA' && Object.values(lerMarcas()).some(Boolean));
}
function detalhes(r) {
  return r.movimento === 'ENTRADA' ? ['cpu','monitor1','monitor2'].map(id => `${nomesCampos[id]}: ${r[id] || 'Não informado'}`).join('\n') : `Patrimônio: ${r.patrimonio}\n${r.tipo === 'DOAÇÃO' ? 'Setor de origem: ' + r.origem : r.tipo === 'SEMINOVO' ? 'Setor de destino: ' + r.destino : r.tipo === 'VELHO' ? 'Equipamento velho' : 'Retirada por baixa'}`;
}
async function salvar(evento) {
  evento.preventDefault();
  if (gravando || indisponivel || !banco) return;
  if (!$('formMovimento').reportValidity()) return;
  const anterior = registros.find(r => r.id === editandoId);
  const r = {...anterior,id:editandoId || crypto.randomUUID(),setor,movimento:modo,data:anterior?.data || new Date().toISOString()};
  if (anterior) r.atualizadoEm = new Date().toISOString();
  if (modo === 'ENTRADA') {
    r.marcas = lerMarcas();
    ['cpu','monitor1','monitor2'].forEach(id => r[id] = $(id).value.trim());
  } else {
    const marcaSaida = document.querySelector('input[name=marca_patrimonio]:checked')?.value;
    r.marca = marcaSaida === 'Outros' ? $('outraMarca_patrimonio').value.trim() : marcaSaida || '';
    if (!r.marca) return msg('Selecione a marca do equipamento de saída.');
    r.tipo = document.querySelector('input[name=tipo]:checked')?.value;
    r.destino = r.tipo === 'SEMINOVO' ? $('destino').value.trim() : '';
    r.patrimonio = $('patrimonio').value.trim(); r.origem = r.tipo === 'DOAÇÃO' ? $('origem').value.trim() : anterior?.origem || '';
    if (!['VELHO','SEMINOVO','BAIXA','DOAÇÃO'].includes(r.tipo) || !r.patrimonio || (r.tipo === 'SEMINOVO' && !r.destino) || (r.tipo === 'DOAÇÃO' && !r.origem)) return msg('Preencha o patrimônio e a condição. Para seminovo, informe o setor de destino.');
  }
  const erroDuplicidade = validarDuplicidade(r,registros);
  if (erroDuplicidade) return alertarDuplicidade(erroDuplicidade);
  if (anterior && TrocasCPU.vinculado(anterior.id,trocas) && (normalizar(r.cpu || '') !== normalizar(anterior.cpu || '') || (r.marcas?.cpu || '') !== (anterior.marcas?.cpu || ''))) return msg('CPU vinculada a uma troca. Preserve a plaqueta e marca; registre outra troca para mudar a CPU. Monitores continuam edit\u00e1veis.');
  if (!await gravar(editandoId ? registros.map(x => x.id === editandoId ? r : x) : [...registros,r])) return;
  ultimoSalvoId = r.id;
  if (retornoCadastro !== 'confirmacao') retornoConfirmacao = retornoCadastro === 'resumo' ? 'resumo' : 'operacao';
  $('voltarConfirmacao').textContent = retornoConfirmacao === 'resumo' ? '← Voltar aos registros' : '← Movimentações';
  editandoId = null;
  $('formMovimento').reset(); atualizarOrigem();
  $('tituloConfirmacao').textContent = r.movimento === 'ENTRADA' ? 'Entrada registrada' : (r.tipo === 'DOAÇÃO' ? 'Doação registrada' : r.tipo === 'SEMINOVO' ? 'Saída de seminovo registrada' : 'Saída registrada');
  $('detalheConfirmacao').replaceChildren(dadosRegistro(r)); tela('confirmacao');
}
function dadosRegistro(r) {
  const dl = document.createElement('dl'); dl.className = 'dados-registro';
  const campos = [['Setor',r.setor],['Movimentação',r.movimento]];
  if (r.movimento === 'ENTRADA') ['cpu','monitor1','monitor2'].forEach(id => { campos.push([nomesCampos[id],r[id] || 'Não informado']); if (r.marcas?.[id]) campos.push([`Marca de ${nomesCampos[id]}`,r.marcas[id]]); });
  else {
    campos.push(['Condição / motivo',r.tipo],['Patrimônio',r.patrimonio],['Marca',r.marca || 'Não informada']);
    if (r.destino) campos.push(['Setor de destino',r.destino]);
    if (r.origem) campos.push(['Setor de origem',r.origem]);
  }
  campos.forEach(([nome,valor]) => { const linha = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = nome; dd.textContent = valor; linha.append(dt,dd); dl.append(linha); });
  return dl;
}
function abrirResumo(filtro,voltar) { filtroSetor = filtro; retornoResumo = voltar; $('busca').value = ''; atualizarSetores(); renderResumo(); tela('resumo'); }
function contarResumo(lista) {
  const entradas = lista.filter(r => r.movimento === 'ENTRADA');
  return {novos:entradas.length,velhos:lista.filter(r => r.movimento !== 'ENTRADA' && ['VELHO','BAIXA'].includes(r.tipo)).length,doacoes:lista.filter(r => r.movimento !== 'ENTRADA' && ['SEMINOVO','DOA\u00c7\u00c3O'].includes(r.tipo)).length,cpus:entradas.filter(r => r.cpu?.trim()).length,monitores:entradas.reduce((n,r) => n + Number(!!r.monitor1?.trim()) + Number(!!r.monitor2?.trim()),0)};
}
function gruposResumo(lista) {
  const grupos = new Map();
  if (lista === registros) trocas.flatMap(t => [t.setor,...(t.destinoTipo === 'OUTRO_SETOR' || t.destinoTipo === 'ESTOQUE' ? [t.destinoSetor] : [])]).filter(Boolean).forEach(nome => grupos.set(normalizar(nome),{setor:nome,registros:[]}));
  lista.forEach(r => { const chave = normalizar(r.setor); if (!grupos.has(chave)) grupos.set(chave,{setor:r.setor,registros:[]}); grupos.get(chave).registros.push(r); });
  return [...grupos.values()].map(g => ({setor:g.setor,...contarResumo(g.registros)})).sort((a,b) => a.setor.localeCompare(b.setor,'pt-BR'));
}
function renderResumo() {
  if (typeof renderHistoricoTrocas === 'function') renderHistoricoTrocas();
  const lista = registros.filter(r => !filtroSetor || normalizar(r.setor) === normalizar(filtroSetor));
  $('escopoResumo').textContent = filtroSetor ? `Setor: ${filtroSetor}` : 'Todos os setores salvos neste aparelho';
  $('totais').replaceChildren();
  const t = contarResumo(lista);
  [['Computadores novos',t.novos],['Velhos',t.velhos],['Doa\u00e7\u00f5es',t.doacoes]].forEach(([nome,total]) => {
    const d = document.createElement('div'); d.className = 'metrica'; const n = document.createElement('strong'), texto = document.createElement('small'); n.textContent = total; texto.textContent = nome; d.append(n,texto); $('totais').append(d);
  });
  $('resumoPorSetor').replaceChildren();
  gruposResumo(lista).forEach(g => {
    const card = document.createElement('article'); card.className = 'registro';
    const titulo = document.createElement('h3'); titulo.textContent = g.setor;
    const dl = document.createElement('dl'); dl.className = 'dados-registro';
    [['Computadores novos',g.novos],['Velhos',g.velhos],['Doa\u00e7\u00f5es',g.doacoes],['CPUs novas informadas',g.cpus],['Monitores novos informados',g.monitores]].forEach(([nome,total]) => {
      const linha = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = nome; dd.textContent = total; linha.append(dt,dd); dl.append(linha);
    });
    const abrir = document.createElement('button'); abrir.className = 'secundario'; abrir.textContent = 'Abrir setor / adicionar item'; abrir.onclick = () => abrirSetorSalvo(g.setor);
    card.append(titulo,dl,abrir); $('resumoPorSetor').append(card);
  });
  if (!lista.length) $('resumoPorSetor').textContent = 'Nenhum registro salvo.';
  $('registros').replaceChildren();
  const busca = normalizar($('busca').value);
  lista.filter(r => normalizar([r.setor,r.destino || '',r.origem || '',r.cpu || '',r.monitor1 || '',r.monitor2 || '',r.patrimonio || ''].join(' ')).includes(busca)).slice().reverse().forEach(r => {
    const card = document.createElement('article'); card.className = 'registro';
    const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = r.tipo || 'ENTRADA';
    const titulo = document.createElement('h3'); titulo.textContent = r.setor;
    const data = document.createElement('small'); data.className = 'data-registro'; data.textContent = new Date(r.data).toLocaleString('pt-BR');
    const editar = document.createElement('button'); editar.className = 'secundario'; editar.textContent = 'Editar patrimônios / registro'; editar.onclick = () => editarRegistro(r.id);
    card.append(badge,titulo,dadosRegistro(r),data,editar); $('registros').append(card);
  });
  if (!$('registros').children.length) $('registros').textContent = 'Nenhum registro encontrado.';
}
function editarRegistro(id, voltar = 'resumo') {
  const r = registros.find(x => x.id === id); if (!r) return;
  setor = r.setor; $('nomeSetor').textContent = setor; configurarModo(r.movimento, voltar); editandoId = id;
  ['cpu','monitor1','monitor2','patrimonio','origem','destino'].forEach(c => { $(c).value = r[c] || ''; });
  const tipo = r.tipo === 'BAIXA' ? 'VELHO' : r.tipo === 'DOAÇÃO' ? 'SEMINOVO' : r.tipo;
  document.querySelectorAll('input[name=tipo]').forEach(c => { c.checked = c.value === tipo; });
  atualizarOrigem();
  ['cpu','monitor1','monitor2','patrimonio'].forEach(id => {
    const marca = (id === 'patrimonio' ? r.marca : r.marcas?.[id]) || '', padrao = (id === 'patrimonio' ? ['HP','BenQ','Positivo','AOC','Lenovo'] : ['Positivo','AOC','Lenovo']).includes(marca);
    document.querySelectorAll(`input[name="marca_${id}"]`).forEach(c => { c.checked = !!marca && c.value === (padrao ? marca : 'Outros'); });
    $(`outraMarca_${id}`).value = padrao ? '' : marca;
  });
  atualizarOrigem(); $('salvar').textContent = 'Salvar alterações';
  msg('Corrija os campos e salve as alterações. A exclusão fica na seção Gerenciar exclusões.');
}
function renderExclusao() {
  const lista = $('resultadosExclusao'), termo = normalizar($('buscaExclusao').value); lista.replaceChildren();
  if (!termo) { lista.textContent = 'Digite um patrimônio ou setor para localizar o registro.'; return; }
  registros.filter(r => normalizar([r.setor,r.cpu,r.monitor1,r.monitor2,r.patrimonio].filter(Boolean).join(' ')).includes(termo)).forEach(r => {
    const card = document.createElement('article'); card.className = 'registro'; card.append(dadosRegistro(r));
    const excluir = document.createElement('button'); excluir.className = 'excluir'; excluir.textContent = 'Revisar exclusão';
    excluir.onclick = () => { $('registroExcluir').replaceChildren(dadosRegistro(r)); $('confirmarExclusaoTexto').value = ''; $('executarExclusao').disabled = true; $('executarExclusao').dataset.id = r.id; $('confirmarExclusao').showModal(); };
    card.append(excluir); lista.append(card);
  });
  if (!lista.children.length) lista.textContent = 'Nenhum registro encontrado.';
}
$('abrirExclusao').onclick = () => { $('buscaExclusao').value = ''; renderExclusao(); tela('exclusao'); };
$('voltarExclusao').onclick = () => { renderResumo(); tela('resumo'); };
$('buscaExclusao').oninput = renderExclusao;
$('confirmarExclusaoTexto').oninput = () => { $('executarExclusao').disabled = normalizar($('confirmarExclusaoTexto').value) !== 'EXCLUIR'; };
$('cancelarExclusao').onclick = () => $('confirmarExclusao').close();
$('executarExclusao').onclick = async () => {
  if (normalizar($('confirmarExclusaoTexto').value) !== 'EXCLUIR') return;
  const id = $('executarExclusao').dataset.id;
  if (!registros.some(r => r.id === id)) return;
  if (TrocasCPU.vinculado(id,trocas)) { $('confirmarExclusao').close(); msg('Registro vinculado a uma troca de CPU. Preserve-o para manter o hist\u00f3rico.'); return; }
  if (!await gravar(registros.filter(r => r.id !== id))) { $('confirmarExclusao').close(); return; }
  $('confirmarExclusao').close(); renderExclusao(); msg('Registro excluído.');
};
function consultarPatrimonio(codigo,lista) {
  const chave = normalizar(codigo);
  if (!chave) return [];
  const resultados = [];
  lista.forEach(r => {
    const campos = r.movimento === 'ENTRADA' ? ['cpu','monitor1','monitor2'] : ['patrimonio'];
    campos.forEach(campo => {
      if (!r[campo]?.trim() || normalizar(r[campo]) !== chave) return;
      resultados.push({patrimonio:r[campo].trim(),marca:r.marcas?.[campo] || (campo === 'patrimonio' ? r.marca : '') || 'Não informada',setor:r.setor,equipamento:nomesCampos[campo],movimento:r.movimento,tipo:r.tipo,destino:r.destino,data:r.data});
    });
  });
  trocas.forEach(t => {
    const antiga = normalizar(t.anterior.patrimonio) === chave, nova = normalizar(t.nova.patrimonio) === chave;
    if (antiga || nova) {
      const cpu = nova ? t.nova : t.anterior;
      resultados.push({patrimonio:cpu.patrimonio,marca:cpu.marca || 'N\u00e3o informada',setor:nova ? t.setor : t.destinoSetor || t.destinoTipo,equipamento:'CPU',movimento:'TROCA DE CPU',tipo:nova ? 'ENTRADA NA TROCA' : `SA\u00cdDA PARA ${t.destinoTipo}`,destino:antiga ? t.destinoSetor : '',data:t.data});
    }
  });
  return resultados.sort((a,b) => (b.data || '').localeCompare(a.data || ''));
}
function relatorioMonitores(lista) {
  const grupos = new Map();
  lista.forEach(r => {
    const chave = normalizar(r.setor);
    if (!grupos.has(chave)) grupos.set(chave,{setor:r.setor,novos:[],velhos:[],doacoes:[]});
    const g = grupos.get(chave);
    if (r.movimento === 'ENTRADA') {
      ['monitor1','monitor2'].filter(id => r[id]?.trim()).forEach(id => g.novos.push({patrimonio:r[id].trim(),marca:r.marcas?.[id]}));
    } else if (r.patrimonio?.trim() && r.tipoEquipamento !== 'CPU') {
      const grupo = ['VELHO','BAIXA'].includes(r.tipo) ? g.velhos : g.doacoes;
      grupo.push({patrimonio:r.patrimonio.trim(),marca:r.marca,destino:r.destino});
    }
  });
  const setores = [...grupos.values()].filter(g => g.novos.length+g.velhos.length+g.doacoes.length).sort((a,b) => a.setor.localeCompare(b.setor,'pt-BR'));
  if (!setores.length) return '';
  const totais = setores.reduce((t,g) => ({novos:t.novos+g.novos.length,velhos:t.velhos+g.velhos.length,doacoes:t.doacoes+g.doacoes.length}),{novos:0,velhos:0,doacoes:0});
  const linhas = ['*RESUMO DE MONITORES*',`Novos: ${totais.novos} | Sa\u00eddas velhos: ${totais.velhos} | Doa\u00e7\u00f5es/seminovos: ${totais.doacoes}`,''];
  setores.forEach(g => {
    linhas.push(`*Setor: ${g.setor}*`);
    [['Novos',g.novos],['Sa\u00eddas - velhos',g.velhos],['Sa\u00eddas - doa\u00e7\u00f5es/seminovos',g.doacoes]].forEach(([nome,itens]) => {
      linhas.push(`${nome}: ${itens.length}`);
      itens.forEach(m => linhas.push(`Monitor: ${m.patrimonio} | Marca: ${m.marca || 'N\u00e3o informada'}${m.destino ? ' | Destino: '+m.destino : ''}`));
    });
    linhas.push('');
  });
  return linhas.join('\n').trim();
}
function abrirRelatorioMonitores(lista) {
  const texto = relatorioMonitores(lista);
  if (!texto) return msg('N\u00e3o h\u00e1 patrim\u00f4nios de monitores informados neste resumo.');
  $('textoRelatorioMonitores').value = texto;
  $('whatsappMonitores').href = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  $('statusRelatorioMonitores').textContent = '';
  $('relatorioMonitores').showModal();
}
$('abrirRelatorioMonitores').onclick = () => abrirRelatorioMonitores(registros.filter(r => !filtroSetor || normalizar(r.setor) === normalizar(filtroSetor)));
$('fecharRelatorioMonitores').onclick = () => $('relatorioMonitores').close();
$('copiarRelatorioMonitores').onclick = async () => {
  try { await navigator.clipboard.writeText($('textoRelatorioMonitores').value); $('statusRelatorioMonitores').textContent = 'Resumo copiado. Cole na conversa do WhatsApp.'; }
  catch { $('textoRelatorioMonitores').focus(); $('textoRelatorioMonitores').select(); $('statusRelatorioMonitores').textContent = 'Texto selecionado. Use Copiar e cole no WhatsApp.'; }
};
function exportar() {
  if (!registros.length) return msg('Nenhum registro salvo para exportar.');
  if (!window.XLSX?.utils) return msg('O Excel não carregou. Conecte-se à internet e recarregue para exportar.');
  try {
    const cabecalho = ['Setor','Movimentação','Condição / motivo da saída','CPU','Monitor 1','Monitor 2','Patrimônio de saída','Setor de origem (anterior)','Setor de destino','Data e hora','Marca CPU','Marca Monitor 1','Marca Monitor 2','Marca saída'];
    const linhas = registros.map(r => [r.setor,r.movimento,r.tipo || '',r.cpu || '',r.monitor1 || '',r.monitor2 || '',r.patrimonio || '',r.origem || '',r.destino || '',new Date(r.data).toLocaleString('pt-BR'),r.marcas?.cpu || '',r.marcas?.monitor1 || '',r.marcas?.monitor2 || '',r.marca || '']);
    const resumo = [['Setor','Computadores novos','Velhos','Doa\u00e7\u00f5es','CPUs novas informadas','Monitores novos informados']];
    gruposResumo(registros).forEach(g => resumo.push([g.setor,g.novos,g.velhos,g.doacoes,g.cpus,g.monitores]));
    const total = contarResumo(registros); resumo.push(['TOTAL GERAL',total.novos,total.velhos,total.doacoes,total.cpus,total.monitores]);
    const tabelaTrocas = [['Setor','CPU que sai','Marca antiga','CPU que entra','Marca que entra','Destino','Setor de destino','Monitores mantidos','Data e hora'],...trocas.map(t => [t.setor,t.anterior.patrimonio,t.anterior.marca,t.nova.patrimonio,t.nova.marca,t.destinoTipo,t.destinoSetor,t.monitores.join(', '),new Date(t.data).toLocaleString('pt-BR')])];
    resumo[0].push('Trocas de CPU');
    resumo.slice(1,-1).forEach(l => l.push(trocas.filter(t => normalizar(t.setor) === normalizar(l[0])).length)); resumo.at(-1).push(trocas.length);
    const livro = XLSX.utils.book_new();
    [['Trocas de CPU',tabelaTrocas],['Resumo',resumo],['Movimentações',[cabecalho,...linhas]],['Entradas',[cabecalho,...linhas.filter(l => l[1] === 'ENTRADA')]],['Saídas',[cabecalho,...linhas.filter(l => l[1] === 'SAÍDA')]]].forEach(([nome,tabela]) => {
      const folha = XLSX.utils.aoa_to_sheet(tabela); folha['!cols'] = tabela[0].map(() => ({wch:25})); folha['!autofilter'] = {ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:tabela.length-1,c:tabela[0].length-1}})}; XLSX.utils.book_append_sheet(livro,folha,nome);
    });
    XLSX.writeFile(livro,`patrimonio_movimentacoes_${new Date().toLocaleDateString('sv-SE')}.xlsx`); msg('Relatório completo exportado com todos os novos registros deste aparelho.');
  } catch(e) { msg(`Falha ao exportar: ${e.message}`); }
}
async function abrirCamera(id) {
  if (cameraPendente || camera) return;
  destinoCamera = id; $('plaquetaManual').value = $(id).value; $('camera').showModal(); $('statusCamera').textContent = 'Abrindo câmera…';
  if (!window.Html5Qrcode) { $('statusCamera').textContent = 'Leitor indisponível. Feche e digite o patrimônio no formulário.'; return; }
  cameraPendente = true;
  try {
    camera = new Html5Qrcode('reader');
    await camera.start({facingMode:'environment'},{fps:10,qrbox:{width:230,height:120}}, codigo => {
      if (cameraPendente || !camera || !$('camera').open) return;
      $(destinoCamera).value = codigo; fecharCamera();
    });
    $('statusCamera').textContent = 'Aponte para o código do patrimônio.';
  } catch { $('statusCamera').textContent = 'Câmera indisponível ou sem permissão. Feche e digite o patrimônio no formulário.'; if (camera) { try { await camera.clear(); } catch {} camera = null; } }
  finally { cameraPendente = false; if (!$('camera').open) await fecharCamera(); }
}
async function fecharCamera() {
  $('camera').close();
  if (cameraPendente) return;
  if (camera) { const atual = camera; camera = null; try { await atual.stop(); } catch {} try { await atual.clear(); } catch {} }
  $('reader').replaceChildren(); if (destinoCamera) $(destinoCamera).focus();
}
['cpu','monitor1','monitor2'].forEach(id => campo(id,'camposEntrada')); campo('patrimonio','camposSaida');
$('formSetor').onsubmit = e => { e.preventDefault(); const nome = $('setor').value.trim(); if (!nome) return msg('Informe o setor.'); abrirSetorSalvo(registros.find(r => normalizar(r.setor) === normalizar(nome))?.setor || nome); };
$('entradaCard').onclick = () => configurarModo('ENTRADA'); $('saidaCard').onclick = () => configurarModo('SAÍDA');
$('formMovimento').onsubmit = salvar;
function fecharAlertaDuplicidade() {
  $('alertaDuplicidade').close();
  if (campoDuplicado) { campoDuplicado.focus(); campoDuplicado.select(); }
}
$('corrigirDuplicidade').onclick = fecharAlertaDuplicidade;
$('alertaDuplicidade').addEventListener('cancel',e => { e.preventDefault(); fecharAlertaDuplicidade(); });
$('formMovimento').addEventListener('keydown',e => {
  if (e.key !== 'Enter' || e.isComposing || e.target.tagName !== 'INPUT') return;
  e.preventDefault(); avancarCampo(e.target);
});
document.querySelectorAll('#formMovimento input[type=radio]').forEach(campo => {
  campo.addEventListener('click',() => avancarCampo(campo));
});
['cpu','monitor1','monitor2','outraMarca_cpu','outraMarca_monitor1','outraMarca_monitor2','outraMarca_patrimonio','origem','destino','patrimonio'].forEach(id => {
  $(id).enterKeyHint = 'next';
});
document.querySelectorAll('input[name=tipo]').forEach(r => r.onchange = atualizarOrigem);
$('limpar').onclick = () => { if (!preenchido() || confirm('Limpar os campos ainda não salvos?')) { $('formMovimento').reset(); atualizarOrigem(); msg('Campos limpos.'); } };
$('voltarCadastro').onclick = () => { if (!preenchido() || confirm('Voltar sem salvar as alterações deste formulário?')) { $('formMovimento').reset(); editandoId = null; if (retornoCadastro === 'resumo') renderResumo(); tela(retornoCadastro); } };
$('voltarConfirmacao').onclick = () => { if (retornoConfirmacao === 'resumo') renderResumo(); tela(retornoConfirmacao); };
$('editarSalvo').onclick = () => editarRegistro(ultimoSalvoId,'confirmacao');
document.querySelectorAll('[data-inicio]').forEach(b => b.onclick = () => tela('inicio'));
$('novoRegistro').onclick = () => configurarModo(modo); $('outraMovimentacao').onclick = () => tela('operacao');
$('resumoInicio').onclick = () => abrirResumo('','inicio'); $('resumoSetor').onclick = () => abrirResumo(setor,'operacao'); $('voltarResumo').onclick = () => tela(retornoResumo);
$('busca').oninput = renderResumo;
$('salvarNome').onclick = async () => {
  const anterior = $('renomear').value, nome = $('novoNome').value.trim().replace(/\s+/g,' ');
  if (!anterior || !nome) return msg('Selecione o setor e informe o novo nome.');
  const existente = setorDuplicado(nome,anterior);
  if (existente) return avisarSetorDuplicado($('novoNome'),existente);
  $('novoNome').setCustomValidity('');
  if (!await gravar(registros.map(r => ({...r,destino:r.destino && normalizar(r.destino) === normalizar(anterior) ? nome : r.destino,setor:normalizar(r.setor) === normalizar(anterior) ? nome : r.setor,origem:r.origem && normalizar(r.origem) === normalizar(anterior) ? nome : r.origem})),trocas.map(t => ({...t,setor:normalizar(t.setor) === normalizar(anterior) ? nome : t.setor,destinoSetor:t.destinoSetor && normalizar(t.destinoSetor) === normalizar(anterior) ? nome : t.destinoSetor})),false,[...new Map(setoresCadastrados.map(s => normalizar(s) === normalizar(anterior) ? nome : s).map(s => [normalizar(s),s])).values()])) return;
  if (normalizar(setor) === normalizar(anterior)) { setor = nome; $('nomeSetor').textContent = nome; $('setor').value = nome; }
  if (filtroSetor && normalizar(filtroSetor) === normalizar(anterior)) filtroSetor = nome;
  $('novoNome').value = ''; atualizarSetores(); renderResumo(); msg('Nome do setor atualizado.');
};
$('excel').onclick = $('excelResumo').onclick = exportar;
$('fecharCamera').onclick = fecharCamera; $('camera').addEventListener('cancel',e => { e.preventDefault(); fecharCamera(); });
$('confirmarManual').onclick = () => { const valor = $('plaquetaManual').value.trim(); if (!valor) { $('statusCamera').textContent = 'Digite a plaqueta para confirmar.'; return; } $(destinoCamera).value = valor; fecharCamera(); };
$('plaquetaManual').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('confirmarManual').onclick(); } };
window.addEventListener('beforeunload',e => { if (!$('cadastro').hidden && preenchido()) { e.preventDefault(); e.returnValue = ''; } });
async function iniciarBanco() {
  $('salvar').disabled = true;
  try {
    banco = await new Promise((resolve,reject) => {
      const pedido = indexedDB.open('patrimonio_monitor',2);
      pedido.onupgradeneeded = () => {
        const db = pedido.result;
        if (!db.objectStoreNames.contains('estado')) db.createObjectStore('estado');
        if (!db.objectStoreNames.contains('trocas')) db.createObjectStore('trocas',{keyPath:'id'});
        if (!db.objectStoreNames.contains('backups')) db.createObjectStore('backups');
        const leitura = pedido.transaction.objectStore('estado').get('atual');
        leitura.onsuccess = () => { if (leitura.result) pedido.transaction.objectStore('backups').put({data:new Date().toISOString(),...leitura.result,trocas:[]},'antes_versao_2'); };
      };
      pedido.onsuccess = () => resolve(pedido.result);
      pedido.onerror = () => reject(pedido.error);
      pedido.onblocked = () => msg('Feche outras abas do aplicativo para abrir o banco.');
    });
    banco.onversionchange = () => { banco.close(); indisponivel = true; $('salvar').disabled = true; msg('Banco atualizado em outra aba. Recarregue a página.'); };
    const estado = await new Promise((resolve,reject) => {
      const pedido = banco.transaction('estado','readonly').objectStore('estado').get('atual');
      pedido.onsuccess = () => resolve(pedido.result); pedido.onerror = () => reject(pedido.error);
    });
    trocas = await new Promise((resolve,reject) => {
      const pedido = banco.transaction('trocas','readonly').objectStore('trocas').getAll();
      pedido.onsuccess = () => resolve(pedido.result.sort((a,b) => a.sequencia-b.sequencia)); pedido.onerror = () => reject(pedido.error);
    });
    const salvos = estado ? estado.registros : JSON.parse(localStorage.getItem(CHAVE) || '[]');
    if (!Array.isArray(salvos) || salvos.some(r => !r || typeof r.id !== 'string' || typeof r.setor !== 'string' || !['ENTRADA','SAÍDA'].includes(r.movimento))) throw Error('Registros inválidos.');
    revisao = estado?.revisao || 0;
    if (estado?.setores && (!Array.isArray(estado.setores) || estado.setores.some(s => typeof s !== 'string' || !s.trim()))) throw Error('Cat\u00e1logo de setores inv\u00e1lido.');
    setoresCadastrados = [...new Map([...(estado?.setores || []),...salvos.flatMap(r => [r.setor,r.destino,r.origem].filter(Boolean)),...trocas.flatMap(t => [t.setor,...(['ESTOQUE','OUTRO_SETOR'].includes(t.destinoTipo) ? [t.destinoSetor] : [])])].filter(Boolean).map(s => [normalizar(s),s.trim()])).values()];
    if ((!estado || !Array.isArray(estado.setores)) && !await gravar(salvos,trocas,true)) throw Error('Migração não concluída.');
    registros = salvos; atualizarSetores(); $('salvar').disabled = false;
    msg(estado ? '' : 'IndexedDB pronto. Registros anteriores migrados; a cópia antiga foi preservada.');
  } catch(e) { indisponivel = true; msg(`Não foi possível abrir o IndexedDB. Os dados anteriores foram preservados. ${e.message}`); }
}
iniciarBanco();
