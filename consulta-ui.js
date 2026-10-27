let retornoConsulta = 'inicio';
const rotulosEquipamento = {CPU:'CPU',MONITOR:'Monitor',NAO_IDENTIFICADO:'Tipo não informado'};
const rotulosSituacao = {ATIVA:'Em uso / estoque',BAIXA:'Baixa',DOACAO:'Doação'};
function baseConsulta() { return $('visaoConsulta').value === 'HISTORICO' ? ConsultaPatrimonio.historico(registros,trocas) : ConsultaPatrimonio.listar(registros,trocas); }
function opcoesFiltroConsulta(id,valores) {
  const campo = $(id), atual = campo.value; campo.replaceChildren();
  const todas = document.createElement('option'); todas.value = ''; todas.textContent = 'Todos'; campo.append(todas);
  const distintos = [...new Map(valores.filter(Boolean).map(v => [ConsultaPatrimonio.chave(v),v])).values()].sort((a,b) => a.localeCompare(b,'pt-BR'));
  distintos.forEach(nome => { const o = document.createElement('option'); o.value = nome; o.textContent = nome; campo.append(o); });
  campo.value = distintos.includes(atual) ? atual : '';
}
function atualizarFiltrosConsulta() {
  const base = baseConsulta(); opcoesFiltroConsulta('marcaConsulta',base.map(r => r.marca)); opcoesFiltroConsulta('setorConsulta',base.map(r => r.setor));
}
function abrirConsulta(voltar) {
  retornoConsulta = voltar; $('formConsulta').reset(); atualizarFiltrosConsulta(); tela('consulta'); renderConsulta();
}
function renderConsulta() {
  $('resultadoConsulta').replaceChildren(); $('totaisConsulta').replaceChildren();
  if (!banco || indisponivel || $('salvar').disabled) { $('statusConsulta').textContent = 'Aguarde o IndexedDB ficar disponível e clique em Consultar.'; return; }
  const historico = $('visaoConsulta').value === 'HISTORICO';
  const resultados = ConsultaPatrimonio.filtrar(baseConsulta(),{patrimonio:$('patrimonioConsulta').value.trim(),tipo:$('tipoConsulta').value,marca:$('marcaConsulta').value,setor:$('setorConsulta').value,status:$('situacaoConsulta').value});
  const unicos = new Set(resultados.map(r => ConsultaPatrimonio.chave(r.patrimonio))).size;
  $('statusConsulta').textContent = historico ? `${resultados.length} ocorrência(s) · ${unicos} patrimônio(s) distintos.` : `${resultados.length} equipamento(s) encontrado(s). Posição atual conforme os registros e trocas salvos.`;
  [['Resultados',resultados.length],['CPUs',resultados.filter(r => r.tipoEquipamento === 'CPU').length],['Monitores',resultados.filter(r => r.tipoEquipamento === 'MONITOR').length]].forEach(([nome,total]) => {
    const d = document.createElement('div'); d.className = 'metrica'; const n = document.createElement('strong'), texto = document.createElement('small'); n.textContent = total; texto.textContent = nome; d.append(n,texto); $('totaisConsulta').append(d);
  });
  resultados.forEach(r => {
    const card = document.createElement('article'); card.className = 'registro';
    const titulo = document.createElement('h3'); titulo.textContent = `${rotulosEquipamento[r.tipoEquipamento] || r.tipoEquipamento} · ${r.patrimonio}`;
    const dl = document.createElement('dl'); dl.className = 'dados-registro';
    const campos = [['Patrimônio',r.patrimonio],['Marca',r.marca],['Setor',r.setor],['Situação',rotulosSituacao[r.status] || r.status]];
    if (historico) campos.push(['Movimentação',r.movimento],['Data',r.data ? new Date(r.data).toLocaleString('pt-BR') : 'Não informada']);
    if (r.destino) campos.push(['Destino',r.destino]);
    campos.forEach(([nome,valor]) => { const linha = document.createElement('div'),dt = document.createElement('dt'),dd = document.createElement('dd'); dt.textContent = nome; dd.textContent = valor; linha.append(dt,dd); dl.append(linha); });
    card.append(titulo,dl); $('resultadoConsulta').append(card);
  });
  if (!resultados.length) $('resultadoConsulta').textContent = 'Nenhum patrimônio corresponde aos filtros selecionados.';
}
$('consultarInicio').onclick = () => abrirConsulta('inicio');
$('consultarSetor').onclick = () => abrirConsulta('operacao');
$('voltarConsulta').onclick = () => tela(retornoConsulta);
$('formConsulta').onsubmit = e => { e.preventDefault(); renderConsulta(); };
['tipoConsulta','marcaConsulta','setorConsulta','situacaoConsulta'].forEach(id => { $(id).onchange = renderConsulta; });
$('visaoConsulta').onchange = () => { if ($('visaoConsulta').value === 'HISTORICO') $('situacaoConsulta').value = ''; atualizarFiltrosConsulta(); renderConsulta(); };
$('patrimonioConsulta').oninput = renderConsulta;
$('limparConsulta').onclick = () => { $('formConsulta').reset(); atualizarFiltrosConsulta(); renderConsulta(); };
