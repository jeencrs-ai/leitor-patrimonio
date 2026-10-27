/* Regras de troca independentes da interface e do armazenamento. */
const TrocasCPU = (() => {
  const chave = v => String(v || '').trim().toLocaleUpperCase('pt-BR');
  function inventario(registros, trocas) {
    const cpus = new Map();
    registros.filter(r => r.movimento === 'ENTRADA' && r.cpu?.trim()).forEach(r => {
      cpus.set(chave(r.cpu), {patrimonio:r.cpu.trim(),marca:r.marcas?.cpu || '',setor:r.setor,registroId:r.id,postoId:chave(r.setor) === 'ESTOQUE' ? null : r.id,status:'ATIVA'});
    });
    trocas.forEach(t => {
      const antiga = cpus.get(chave(t.anterior.patrimonio));
      if (antiga) cpus.set(chave(antiga.patrimonio), {...antiga,setor:t.destinoSetor || t.destinoTipo,postoId:null,status:t.destinoTipo === 'BAIXA' || t.destinoTipo === 'DOACAO' ? t.destinoTipo : 'ATIVA'});
      const nova = cpus.get(chave(t.nova.patrimonio));
      cpus.set(chave(t.nova.patrimonio), {...nova,...t.nova,setor:t.setor,postoId:t.postoId,status:'ATIVA'});
    });
    return cpus;
  }
  function preparar(dados, registros, trocas) {
    const cpus = inventario(registros,trocas), antiga = cpus.get(chave(dados.cpuAtual));
    if (!antiga || antiga.status !== 'ATIVA' || chave(antiga.setor) !== chave(dados.setor)) throw Error('Selecione uma CPU ativa deste setor.');
    if (registros.filter(r => r.movimento === 'ENTRADA' && chave(r.cpu) === chave(antiga.patrimonio)).length > 1) throw Error('Há mais de um cadastro para esta CPU. Corrija a duplicidade antes de registrar a troca.');
    if (!['CADASTRADA','NOVA'].includes(dados.origemNova)) throw Error('Selecione a origem da CPU que entra.');
    const codigo = String(dados.cpuNova || '').trim();
    if (!codigo || chave(codigo) === chave(antiga.patrimonio)) throw Error('Informe uma CPU diferente da que está saindo.');
    const existente = cpus.get(chave(codigo));
    if (dados.origemNova === 'CADASTRADA') {
      if (!existente || existente.status !== 'ATIVA') throw Error('A CPU selecionada não está disponível.');
      if (existente.postoId || chave(existente.setor) !== 'ESTOQUE') throw Error('Escolha uma CPU disponível no Estoque. Uma CPU em uso em outro posto não pode ser retirada por esta troca.');
    } else {
      const usado = existente || registros.some(r => [r.cpu,r.monitor1,r.monitor2,r.patrimonio].some(p => p && chave(p) === chave(codigo))) || trocas.some(t => [t.anterior.patrimonio,t.nova.patrimonio].some(p => chave(p) === chave(codigo)));
      if (usado) throw Error(`Patrimônio ${codigo} já cadastrado. Use uma CPU do Estoque ou informe um patrimônio novo.`);
      if (!String(dados.marcaNova || '').trim()) throw Error('Informe a marca da CPU nova.');
    }
    if (!['ESTOQUE','OUTRO_SETOR','DOACAO','BAIXA'].includes(dados.destinoTipo)) throw Error('Selecione o destino da CPU que sai.');
    const destino = dados.destinoTipo === 'ESTOQUE' ? 'Estoque' : ['OUTRO_SETOR','DOACAO'].includes(dados.destinoTipo) ? String(dados.destinoSetor || '').trim() : '';
    if (['OUTRO_SETOR','DOACAO'].includes(dados.destinoTipo) && !destino) throw Error('Informe o setor de destino da CPU antiga.');
    if (destino && chave(destino) === chave(dados.setor)) throw Error('O destino da CPU antiga deve ser diferente do setor da troca.');
    const postoId = antiga.postoId || antiga.registroId;
    const posto = registros.find(r => r.id === postoId);
    return {setor:dados.setor,anterior:{patrimonio:antiga.patrimonio,marca:antiga.marca,registroId:antiga.registroId},nova:{patrimonio:existente?.patrimonio || codigo,marca:existente ? existente.marca : dados.marcaNova.trim(),registroId:existente?.registroId || null,cadastroNovo:!existente},postoId,destinoTipo:dados.destinoTipo,destinoSetor:destino,monitores:[posto?.monitor1,posto?.monitor2].filter(Boolean)};
  }
  function vinculado(id,trocas) { return trocas.some(t => t.postoId === id || t.anterior.registroId === id || t.nova.registroId === id); }
  function planejarEdicao(id,dados,registros,trocas) {
    const indice = trocas.findIndex(t => t.id === id);
    if (indice < 0) throw Error('Troca não encontrada.');
    const lista = trocas.slice(0,indice);
    for (let i=indice;i<trocas.length;i++) {
      const original = trocas[i];
      const formulario = i === indice ? dados : {setor:original.setor,cpuAtual:original.anterior.patrimonio,cpuNova:original.nova.patrimonio,origemNova:original.nova.cadastroNovo ? 'NOVA' : 'CADASTRADA',marcaNova:original.nova.marca,destinoTipo:original.destinoTipo,destinoSetor:original.destinoSetor};
      try { lista.push({...original,...preparar(formulario,registros,lista)}); }
      catch(erro) { throw Error(i === indice ? erro.message : `Esta alteração impediria uma troca posterior (${original.anterior.patrimonio} → ${original.nova.patrimonio}). ${erro.message}`); }
    }
    return {troca:lista[indice],lista};
  }
  return {inventario,preparar,vinculado,planejarEdicao};
})();
