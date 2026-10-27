let trocaEmRevisao = null;
let editandoTrocaId = null, retornoTrocaCpu = 'operacao';
function contextoEdicaoTroca() { return editandoTrocaId ? trocas.slice(0,trocas.findIndex(t => t.id === editandoTrocaId)) : trocas; }
function planejarTrocaFormulario() {
  if (editandoTrocaId) return TrocasCPU.planejarEdicao(editandoTrocaId,dadosFormTroca(),registros,trocas);
  return {troca:TrocasCPU.preparar(dadosFormTroca(),registros,trocas)};
}
const rotulosDestinoCpu = {ESTOQUE:'Estoque',OUTRO_SETOR:'Outro setor',DOACAO:'Doação',BAIXA:'Baixa'};
function detalhesTrocaCpu(t) {
  const dl = document.createElement('dl'); dl.className = 'dados-registro';
  const linhas = [['Setor',t.setor],['CPU que sai',`${t.anterior.patrimonio} · ${t.anterior.marca || 'Marca não informada'}`],['CPU que entra',`${t.nova.patrimonio} · ${t.nova.marca || 'Marca não informada'}`],['Destino da antiga',`${rotulosDestinoCpu[t.destinoTipo]}${t.destinoSetor ? ' · '+t.destinoSetor : ''}`],['Monitores mantidos',t.monitores.join(', ') || 'Nenhum informado']];
  linhas.forEach(([nome,valor]) => { const div = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = nome; dd.textContent = valor; div.append(dt,dd); dl.append(div); });
  return dl;
}
function opcoesCpu(id,cpus,vazio) {
  const select = $(id); select.replaceChildren();
  const inicial = document.createElement('option'); inicial.value = ''; inicial.textContent = vazio; select.append(inicial);
  cpus.forEach(cpu => { const o = document.createElement('option'); o.value = cpu.patrimonio; o.textContent = `${cpu.patrimonio} · ${cpu.marca || 'Marca não informada'}`; select.append(o); });
}
function inventarioCpuAtual() { return TrocasCPU.inventario(registros,trocas); }
function atualizarFormTroca() {
  const nova = $('origemCpuNova').value === 'NOVA';
  $('cpuEstoqueBox').hidden = nova; $('cpuNovaBox').hidden = !nova;
  $('cpuEstoqueTroca').disabled = nova; $('cpuEstoqueTroca').required = !nova;
  ['patrimonioCpuTroca','marcaCpuTroca'].forEach(id => { $(id).disabled = !nova; $(id).required = nova; });
  const outra = nova && $('marcaCpuTroca').value === 'Outros';
  $('marcaOutraTrocaBox').hidden = !outra; $('marcaOutraTroca').disabled = !outra; $('marcaOutraTroca').required = outra;
  const destino = ['OUTRO_SETOR','DOACAO'].includes($('destinoTipoTroca').value);
  $('destinoTrocaBox').hidden = !destino; $('destinoSetorTroca').disabled = !destino; $('destinoSetorTroca').required = destino;
}
function abrirTrocaCpu(id = null) {
  if (!banco || indisponivel || gravando) { msg('Aguarde o banco ficar disponível para registrar a troca.'); return; }
  const original = id ? trocas.find(t => t.id === id) : null;
  if (id && !original) return msg('Troca não encontrada.');
  editandoTrocaId = id; retornoTrocaCpu = id ? 'resumo' : 'operacao';
  if (original) { setor = original.setor; $('nomeSetor').textContent = setor; }
  $('formTrocaCpu').reset(); trocaEmRevisao = null; $('statusTrocaCpu').textContent = '';
  const cpus = [...TrocasCPU.inventario(registros,contextoEdicaoTroca()).values()];
  opcoesCpu('cpuAtualTroca',cpus.filter(c => c.status === 'ATIVA' && normalizar(c.setor) === normalizar(setor)),'Selecione a CPU atual');
  opcoesCpu('cpuEstoqueTroca',cpus.filter(c => c.status === 'ATIVA' && !c.postoId && normalizar(c.setor) === 'ESTOQUE'),'Selecione uma CPU do Estoque');
  $('setorTrocaCpu').textContent = setor;
  $('tituloTelaTrocaCpu').textContent = id ? 'Editar troca de CPU' : 'Troca de CPU';
  $('salvarTrocaCpu').textContent = id ? 'Confirmar e salvar alterações' : 'Confirmar e salvar troca';
  if (original) {
    $('cpuAtualTroca').value = original.anterior.patrimonio;
    $('origemCpuNova').value = original.nova.cadastroNovo ? 'NOVA' : 'CADASTRADA';
    $('cpuEstoqueTroca').value = original.nova.patrimonio; $('patrimonioCpuTroca').value = original.nova.patrimonio;
    const marca = original.nova.marca, padrao = ['Positivo','Lenovo','HP'].includes(marca);
    $('marcaCpuTroca').value = padrao ? marca : 'Outros'; $('marcaOutraTroca').value = padrao ? '' : marca;
    $('destinoTipoTroca').value = original.destinoTipo; $('destinoSetorTroca').value = original.destinoSetor;
  }
  $('detalheCpuAtual').replaceChildren(); atualizarFormTroca(); tela('trocaCpu');
  if (!cpus.some(c => c.status === 'ATIVA' && normalizar(c.setor) === normalizar(setor))) $('statusTrocaCpu').textContent = 'Nenhuma CPU ativa cadastrada neste setor. Cadastre sua CPU em Entrada antes de registrar uma troca.';
}
function dadosFormTroca() {
  return {setor,cpuAtual:$('cpuAtualTroca').value,origemNova:$('origemCpuNova').value,cpuNova:$('origemCpuNova').value === 'NOVA' ? $('patrimonioCpuTroca').value : $('cpuEstoqueTroca').value,marcaNova:$('marcaCpuTroca').value === 'Outros' ? $('marcaOutraTroca').value : $('marcaCpuTroca').value,destinoTipo:$('destinoTipoTroca').value,destinoSetor:$('destinoSetorTroca').value};
}
function trocaNaoSalva() { return !!$('cpuAtualTroca').value || !!$('cpuEstoqueTroca').value || !!$('patrimonioCpuTroca').value.trim(); }
$('trocarCpu').onclick = () => abrirTrocaCpu();
$('voltarTrocaCpu').onclick = () => { if (gravando) return; if (!trocaNaoSalva() || confirm('Voltar sem salvar esta troca?')) { $('formTrocaCpu').reset(); if (retornoTrocaCpu === 'resumo') renderResumo(); tela(retornoTrocaCpu); } };
['origemCpuNova','marcaCpuTroca','destinoTipoTroca'].forEach(id => { $(id).onchange = atualizarFormTroca; });
$('cpuAtualTroca').onchange = () => {
  const c = TrocasCPU.inventario(registros,contextoEdicaoTroca()).get(normalizar($('cpuAtualTroca').value));
  const p = document.createElement('p'); p.textContent = c ? `Marca: ${c.marca || 'Não informada'} · Setor atual: ${c.setor}` : '';
  $('detalheCpuAtual').replaceChildren(p);
};
$('formTrocaCpu').onsubmit = e => {
  e.preventDefault(); if (gravando || !$('formTrocaCpu').reportValidity()) return;
  try {
    trocaEmRevisao = planejarTrocaFormulario().troca;
    $('revisaoTrocaCpu').replaceChildren(detalhesTrocaCpu(trocaEmRevisao)); $('confirmarTrocaCpu').showModal();
  } catch(erro) { $('statusTrocaCpu').textContent = erro.message; }
};
$('cancelarTrocaCpu').onclick = () => { if (!gravando) $('confirmarTrocaCpu').close(); };
$('confirmarTrocaCpu').addEventListener('cancel',e => { if (gravando) e.preventDefault(); });
$('salvarTrocaCpu').onclick = async () => {
  if (!trocaEmRevisao || gravando || indisponivel || !banco) return;
  $('salvarTrocaCpu').disabled = true;
  try {
    const plano = planejarTrocaFormulario(), validada = plano.troca;
    if (JSON.stringify(validada) !== JSON.stringify(trocaEmRevisao)) throw Error('Os dados mudaram. Revise a troca novamente.');
    const agora = new Date().toISOString();
    const t = {...validada,id:crypto.randomUUID(),sequencia:revisao+1,data:agora};
    const atualizadas = editandoTrocaId ? plano.lista.map(nova => {
      const antiga = trocas.find(t => t.id === nova.id);
      if (JSON.stringify(nova) === JSON.stringify(antiga)) return antiga;
      const {versoes,...snapshot} = antiga;
      return {...nova,editadaEm:agora,versoes:[...(versoes || []),{...snapshot,substituidaEm:agora}]};
    }) : [...trocas,t];
    if (!await gravar(structuredClone(registros),atualizadas,true)) { $('confirmarTrocaCpu').close(); $('statusTrocaCpu').textContent = $('status').textContent; return; }
    $('confirmarTrocaCpu').close(); $('formTrocaCpu').reset(); trocaEmRevisao = null;
    const editada = !!editandoTrocaId; editandoTrocaId = null;
    if (editada) { renderResumo(); tela('resumo'); } else abrirResumo(setor,'operacao');
    msg('Troca de CPU salva. Histórico e monitores preservados; backup interno criado.');
  } catch(erro) { $('confirmarTrocaCpu').close(); $('statusTrocaCpu').textContent = erro.message; }
  finally { $('salvarTrocaCpu').disabled = false; }
};
function renderHistoricoTrocas() {
  const lista = trocas.filter(t => !filtroSetor || normalizar(t.setor) === normalizar(filtroSetor));
  $('totalTrocasCpu').textContent = `${lista.length} troca(s) de CPU. Contagem separada dos computadores novos recebidos.`;
  $('historicoTrocasCpu').replaceChildren();
  lista.slice().reverse().forEach(t => {
    const card = document.createElement('article'); card.className = 'registro';
    const data = document.createElement('small'); data.className = 'data-registro'; data.textContent = new Date(t.data).toLocaleString('pt-BR');
    const editar = document.createElement('button'); editar.className = 'secundario'; editar.textContent = 'Editar troca de CPU'; editar.onclick = () => abrirTrocaCpu(t.id);
    card.append(detalhesTrocaCpu(t),data,editar);
    if (t.versoes?.length) {
      const historico = document.createElement('details'), titulo = document.createElement('summary'); titulo.textContent = `${t.versoes.length} versão(ões) anterior(es)`; historico.append(titulo);
      t.versoes.slice().reverse().forEach(v => { const p = document.createElement('p'); p.textContent = `Alterada em ${new Date(v.substituidaEm).toLocaleString('pt-BR')}`; historico.append(p,detalhesTrocaCpu(v)); });
      card.append(historico);
    }
    $('historicoTrocasCpu').append(card);
  });
}
$('backupCompleto').onclick = () => {
  if (!banco || indisponivel || gravando) return msg('Aguarde o banco estar disponível.');
  const url = URL.createObjectURL(new Blob([JSON.stringify({formato:'patrimonio_monitor_backup_v2',data:new Date().toISOString(),revisao,registros,trocas,setores:setoresCadastrados},null,2)],{type:'application/json;charset=utf-8'}));
  const link = document.createElement('a'); link.href = url; link.download = `backup_patrimonio_${new Date().toLocaleDateString('sv-SE')}.json`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
  msg('Backup completo baixado com registros e trocas de CPU.');
};
window.addEventListener('beforeunload',e => { if (!$('trocaCpu').hidden && trocaNaoSalva()) { e.preventDefault(); e.returnValue = ''; } });
