'use strict';
const $ = id => document.getElementById(id), CHAVE = 'monitores_movimentacoes_v2';
const chave = t => t.trim().toLocaleUpperCase('pt-BR');
const mensagem = t => { $('status').textContent = t; };
const rotulo = tipo => ({saida:'Saída',entrada:'Entrada',transferencia:'Transferência',anterior:'Sem classificação'})[tipo];
let editando = null, leituraCamera = false;
let dados = {setores:[],registros:[]}, setorAtivo = null, scanner, iniciando = false, recebendo = false, armazenamentoOk = true;
try {
  const salvo = localStorage.getItem(CHAVE);
  if (salvo) dados = JSON.parse(salvo);
  else {
    const antigos = JSON.parse(localStorage.getItem('leitura_simples_patrimonio_v1') || '[]');
    if (!Array.isArray(antigos)) throw new Error();
    dados.registros = antigos.map(r => ({...r,tipo:'anterior'}));
    dados.setores = [...new Map(antigos.map(r => [chave(r.setor),r.setor])).values()];
  }
  dados.registros = dados.registros.map(r => ({...r, marca:r.marca || '', observacao:r.observacao || ''}));
  if (!Array.isArray(dados.setores) || dados.setores.some(s => typeof s !== 'string' || !s.trim()) || !Array.isArray(dados.registros) || dados.registros.some(r => !r || typeof r.setor !== 'string' || typeof r.patrimonio !== 'string' || typeof r.data !== 'string' || !rotulo(r.tipo) || (r.tipo === 'transferencia' && (typeof r.destino !== 'string' || !dados.setores.some(s => chave(s) === chave(r.destino)))) || !dados.setores.some(s => chave(s) === chave(r.setor)))) throw new Error();
} catch { dados = {setores:[],registros:[]}; armazenamentoOk = false; mensagem('Não foi possível carregar os dados. Reabra a página antes de salvar.'); }
function gravar(copia) {
  if (!armazenamentoOk) { mensagem('Reabra a página para recuperar os dados antes de salvar.'); return false; }
  try { localStorage.setItem(CHAVE,JSON.stringify(copia)); dados = copia; return true; }
  catch { mensagem('Não foi possível salvar neste aparelho. Exporte os registros antes de continuar.'); return false; }
}
function mostrarTela(id) { ['inicioSetor','leitura','resumo'].forEach(t => $(t).classList.toggle('oculto',t !== id)); }
function relacionados(r,setor) { return chave(r.setor) === chave(setor) || (r.tipo === 'transferencia' && chave(r.destino) === chave(setor)); }
function grupos() {
  return dados.setores.map(setor => {
    const lista = dados.registros.filter(r => relacionados(r,setor));
    return {setor,saida:lista.filter(r => r.tipo === 'saida').length,entrada:lista.filter(r => r.tipo === 'entrada').length,
      enviadas:lista.filter(r => r.tipo === 'transferencia' && chave(r.setor) === chave(setor)).length,
      recebidas:lista.filter(r => r.tipo === 'transferencia' && chave(r.destino) === chave(setor)).length,
      anterior:lista.filter(r => r.tipo === 'anterior').length};
  }).sort((a,b) => a.setor.localeCompare(b.setor,'pt-BR'));
}
const resumoGrupo = g => g.setor + ' · Saídas: ' + g.saida + ' · Entradas: ' + g.entrada + ' · Transferências enviadas: ' + g.enviadas + ' · Recebidas: ' + g.recebidas + (g.anterior ? ' · Sem classificação: ' + g.anterior : '');
function botao(texto,fn) { const b = document.createElement('button'); b.type = 'button'; b.className = 'texto-botao'; b.textContent = texto; b.onclick = fn; return b; }
function atualizarDestino() { const transferencia = $('movimento').value === 'transferencia'; $('campoDestino').classList.toggle('oculto',!transferencia); $('destino').required = transferencia; }
function limpar() {
  editando = null; leituraCamera = false;
  ['patrimonio','marca','observacao','destino'].forEach(id => $(id).value = '');
  $('salvar').textContent = 'SALVAR'; $('cancelarEdicao').classList.add('oculto'); atualizarDestino();
}
function abrirSetor(setor) {
  setorAtivo = setor; $('nomeSetor').textContent = setor; $('editarNome').value = setor; $('movimento').value = 'saida';
  limpar(); render(); mostrarTela('leitura'); mensagem('');
}
function descricao(r) { return rotulo(r.tipo) + ' · ' + r.patrimonio + (r.marca ? ' · ' + r.marca : '') + (r.tipo === 'transferencia' ? ' · ' + r.setor + ' → ' + r.destino : '') + (r.observacao ? ' · ' + r.observacao : ''); }
function render() {
  const setores = grupos();
  $('total').textContent = setores.length + ' setor(es) · ' + dados.registros.length + ' leitura(s)';
  ['setores','listaSetores','resumoSetores','registros'].forEach(id => $(id).replaceChildren());
  setores.forEach(g => {
    const opcao = document.createElement('option'); opcao.value = g.setor; $('setores').append(opcao);
    const card = document.createElement('div'); card.className = 'item'; card.append(botao(g.setor,() => abrirSetor(g.setor))); $('listaSetores').append(card);
    const resumo = document.createElement('div'); resumo.className = 'item'; resumo.textContent = resumoGrupo(g);
    const lista = document.createElement('details'), titulo = document.createElement('summary'); titulo.textContent = 'Monitores'; lista.append(titulo);
    dados.registros.filter(r => relacionados(r,g.setor)).forEach(r => { const p = document.createElement('p'); p.textContent = descricao(r); lista.append(p); });
    resumo.append(lista); $('resumoSetores').append(resumo);
  });
  if (!setores.length) { $('listaSetores').textContent = 'Nenhum setor salvo.'; $('resumoSetores').textContent = 'Nenhum setor salvo.'; }
  const atuais = dados.registros.filter(r => setorAtivo && relacionados(r,setorAtivo));
  $('contador').textContent = atuais.length + ' leitura(s) neste setor';
  [...atuais].reverse().forEach(r => {
    const linha = document.createElement('div'); linha.className = 'item';
    const p = document.createElement('p'); p.textContent = descricao(r) + ' · ' + new Date(r.data).toLocaleString('pt-BR');
    linha.append(p,botao('EDITAR',async () => {
      if (iniciando) return;
      if (($('patrimonio').value || $('observacao').value || $('marca').value) && !confirm('Descartar o formulário atual e editar esta leitura?')) return;
      await parar(); setorAtivo = r.setor; $('nomeSetor').textContent = r.setor; $('editarNome').value = r.setor;
      editando = r; leituraCamera = true; $('patrimonio').value = r.patrimonio; $('marca').value = r.marca || ''; $('observacao').value = r.observacao || ''; $('movimento').value = r.tipo === 'anterior' ? 'saida' : r.tipo; $('destino').value = r.destino || '';
      atualizarDestino(); $('salvar').textContent = 'SALVAR ALTERAÇÕES'; $('cancelarEdicao').classList.remove('oculto'); render();
    }),botao('EXCLUIR',() => {
      if (confirm('Excluir a leitura do monitor ' + r.patrimonio + '?') && gravar({...dados,registros:dados.registros.filter(x => x !== r)})) { if (editando === r) limpar(); render(); mensagem('Leitura excluída.'); }
    }));
    $('registros').append(linha);
  });
}
$('movimento').onchange = atualizarDestino;
$('cancelarEdicao').onclick = async () => { if (iniciando) return; await parar(); limpar(); mensagem(''); };
$('renomear').onclick = () => {
  const novo = $('editarNome').value.trim();
  if (!novo) return mensagem('Informe o nome do setor.');
  if (dados.setores.some(s => chave(s) !== chave(setorAtivo) && chave(s) === chave(novo))) return mensagem('Já existe um setor com esse nome.');
  if (editando || $('patrimonio').value || $('marca').value || $('observacao').value) return mensagem('Salve ou cancele o formulário antes de alterar o setor.');
  const copia = structuredClone(dados);
  copia.setores = copia.setores.map(s => chave(s) === chave(setorAtivo) ? novo : s);
  copia.registros.forEach(r => { if (chave(r.setor) === chave(setorAtivo)) r.setor = novo; if (r.destino && chave(r.destino) === chave(setorAtivo)) r.destino = novo; });
  if (gravar(copia)) { setorAtivo = novo; $('nomeSetor').textContent = novo; render(); mensagem('Nome atualizado.'); }
};
$('excluirSetor').onclick = async () => {
  if (iniciando) return;
  if (!confirm('Excluir o setor ' + setorAtivo + ' e todas as leituras vinculadas, incluindo transferências de entrada e saída?')) return;
  await parar();
  const copia = structuredClone(dados); copia.setores = copia.setores.filter(s => chave(s) !== chave(setorAtivo)); copia.registros = copia.registros.filter(r => !relacionados(r,setorAtivo));
  if (gravar(copia)) { setorAtivo = null; limpar(); render(); mostrarTela('inicioSetor'); mensagem('Setor excluído.'); }
};
async function voltar() {
  if (iniciando) return;
  if ((editando || $('patrimonio').value || $('marca').value || $('observacao').value || $('destino').value) && !confirm('Descartar as alterações não salvas?')) return;
  await parar(); limpar(); setorAtivo = null; render(); mostrarTela('inicioSetor'); mensagem('');
}
$('voltarSetores').onclick = voltar;
$('formSetor').onsubmit = event => {
  event.preventDefault(); const nome = $('setor').value.trim();
  if (!nome) { mensagem('Informe o nome do setor.'); return; }
  const existente = dados.setores.find(s => chave(s) === chave(nome));
  if (!existente && !gravar({...dados,setores:[...dados.setores,nome]})) return;
  abrirSetor(existente || nome);
};
$('formulario').onsubmit = event => {
  event.preventDefault();
  const patrimonio = $('patrimonio').value.trim(), tipo = $('movimento').value, marca = $('marca').value.trim(), observacao = $('observacao').value.trim();
  if (iniciando || scanner) return mensagem('Conclua ou feche a câmera antes de salvar.');
  if (!setorAtivo || !patrimonio || !leituraCamera) return mensagem('Leia o patrimônio pela câmera.');
  if (!marca) return mensagem('Informe a marca do monitor.');
  if (!['saida','entrada','transferencia'].includes(tipo)) return mensagem('Escolha a movimentação.');
  let destino = tipo === 'transferencia' ? $('destino').value.trim() : '';
  if (tipo === 'transferencia' && (!destino || chave(destino) === chave(setorAtivo))) return mensagem('Informe um setor de destino diferente da origem.');
  destino = dados.setores.find(s => chave(s) === chave(destino)) || destino;
  if (dados.registros.some(r => r !== editando && chave(r.setor) === chave(setorAtivo) && chave(r.patrimonio) === chave(patrimonio) && r.tipo === tipo && (tipo !== 'transferencia' || chave(r.destino) === chave(destino)))) return mensagem('Este monitor já está registrado nesta movimentação.');
  const registro = {...editando,setor:setorAtivo,patrimonio,tipo,marca,observacao,data:editando?.data || new Date().toISOString()};
  if (destino) registro.destino = destino; else delete registro.destino;
  const copia = {...dados,setores:[...dados.setores],registros:editando ? dados.registros.map(r => r === editando ? registro : r) : [...dados.registros,registro]};
  if (destino && !copia.setores.some(s => chave(s) === chave(destino))) copia.setores.push(destino);
  if (gravar(copia)) { limpar(); render(); mensagem('Monitor salvo.'); }
};
async function parar() {
  if (iniciando) return;
  const atual = scanner; scanner = null;
  if (atual) { try { await atual.stop(); } catch {} try { await atual.clear(); } catch {} }
  $('camera').classList.add('oculto');
}
$('ler').onclick = async () => {
  if (scanner || iniciando || !setorAtivo) return;
  if (!window.Html5Qrcode) { mensagem('Leitor indisponível. Recarregue a página para usar a câmera.'); return; }
  iniciando = true; $('ler').disabled = true; $('parar').disabled = true; $('finalizar').disabled = true; $('movimento').disabled = true; $('camera').classList.remove('oculto'); mensagem('Abrindo câmera…');
  try {
    scanner = new Html5Qrcode('reader');
    await scanner.start({facingMode:'environment'},{fps:10,qrbox:{width:250,height:140}},async codigo => {
      if (iniciando || recebendo || !scanner) return;
      recebendo = true;
      try { if (!String(codigo).trim()) return; $('patrimonio').value = String(codigo).trim(); leituraCamera = true; await parar(); mensagem('Monitor lido. Toque em SALVAR MONITOR.'); $('patrimonio').focus(); }
      finally { recebendo = false; }
    });
    mensagem('Aponte a câmera para o código do monitor.');
  } catch { iniciando = false; await parar(); mensagem('Não foi possível abrir a câmera. Verifique a permissão da câmera e use HTTPS ou localhost.'); }
  finally { iniciando = false; ['ler','parar','finalizar','movimento'].forEach(id => $(id).disabled = false); }
};
$('parar').onclick = parar;
$('finalizar').onclick = async () => {
  if (iniciando) return;
  if (editando || $('patrimonio').value.trim() || $('marca').value.trim() || $('observacao').value.trim() || $('destino').value.trim()) { mensagem('Salve o monitor informado antes de finalizar.'); return; }
  await parar(); render(); mostrarTela('resumo'); mensagem('Leituras salvas. Você pode retornar ao setor para registrar as entradas depois.');
};
$('verResumo').onclick = () => { render(); mostrarTela('resumo'); mensagem(''); };
$('continuar').onclick = voltar;
function textoResumo() {
  const lista = grupos();
  return ['MONITORES — RESUMO POR SETOR',...lista.map(resumoGrupo),'TOTAL: ' + dados.registros.filter(r => r.tipo === 'saida').length + ' saída(s), ' + dados.registros.filter(r => r.tipo === 'entrada').length + ' entrada(s), ' + dados.registros.filter(r => r.tipo === 'transferencia').length + ' transferência(s).'].join('\n');
}
$('whatsapp').onclick = () => {
  if (!dados.setores.length) { mensagem('Cadastre um setor antes de compartilhar.'); return; }
  window.open(`https://wa.me/?text=${encodeURIComponent(textoResumo())}`,'_blank','noopener,noreferrer');
};
$('exportar').onclick = () => {
  if (!dados.setores.length) { mensagem('Cadastre um setor antes de exportar.'); return; }
  const lista = grupos();
  const resumo = [['Departamento / Setor','Saídas','Entradas','Transferências enviadas','Transferências recebidas','Sem classificação'],...lista.map(g => [g.setor,g.saida,g.entrada,g.enviadas,g.recebidas,g.anterior]),['TOTAL',...['saida','entrada','enviadas','recebidas','anterior'].map(k => lista.reduce((n,g) => n+g[k],0))]];
  const linhas = [['Departamento / Setor de origem','Movimentação','Setor de destino','Patrimônio do monitor','Marca','Observação','Data/Hora'],...dados.registros.map(r => [r.setor,rotulo(r.tipo),r.destino || '',r.patrimonio,r.marca || '',r.observacao || '',new Date(r.data).toLocaleString('pt-BR')])];
  const nome = `monitores_${new Date().toLocaleDateString('sv-SE')}`;
  try {
    if (window.XLSX?.utils) {
      const livro = XLSX.utils.book_new();
      for (const [titulo,tabela] of [['Resumo por setor',resumo],['Monitores',linhas]]) {
        const folha = XLSX.utils.aoa_to_sheet(tabela); folha['!cols'] = [32,24,32,28,22,45,24].map(wch => ({wch}));
        if (titulo === 'Monitores') folha['!autofilter'] = {ref:`A1:G${linhas.length}`};
        XLSX.utils.book_append_sheet(livro,folha,titulo);
      }
      XLSX.writeFile(livro,`${nome}.xlsx`);
    } else {
      const celula = v => '"' + String(v).replace(/^[=+@\-\t\r\n]/,"'$&").replaceAll('"','""') + '"';
      const csv = '\uFEFF' + [...resumo,[],...linhas].map(l => l.map(celula).join(';')).join('\r\n');
      const url = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})), a = document.createElement('a');
      a.href = url; a.download = `${nome}.csv`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
    }
    mensagem('Relatório exportado com lista dos monitores e resumo de saída e entrada por setor.');
  } catch { mensagem('Não foi possível exportar. Tente novamente.'); }
};
render();
