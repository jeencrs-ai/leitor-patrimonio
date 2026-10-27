const ConsultaPatrimonio = (() => {
  const chave = valor => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,' ').toLocaleUpperCase('pt-BR');
  function listar(registros,trocas) {
    const itens = new Map();
    TrocasCPU.inventario(registros,trocas).forEach(cpu => itens.set(`CPU:${chave(cpu.patrimonio)}`,{...cpu,tipoEquipamento:'CPU',marca:cpu.marca || 'Não informada'}));
    registros.filter(r => r.movimento === 'ENTRADA').forEach(r => {
      ['monitor1','monitor2'].filter(id => r[id]?.trim()).forEach(id => itens.set(`MONITOR:${chave(r[id])}`,{patrimonio:r[id].trim(),marca:r.marcas?.[id] || 'Não informada',setor:r.setor,tipoEquipamento:'MONITOR',status:'ATIVA'}));
    });
    registros.filter(r => r.movimento !== 'ENTRADA' && r.patrimonio?.trim()).slice().sort((a,b) => (a.data || '').localeCompare(b.data || '')).forEach(r => {
      const codigo = chave(r.patrimonio);
      const tipo = r.tipoEquipamento || (itens.has(`CPU:${codigo}`) ? 'CPU' : itens.has(`MONITOR:${codigo}`) ? 'MONITOR' : 'NAO_IDENTIFICADO');
      const id = `${tipo}:${codigo}`, anterior = itens.get(id);
      // Trocas de CPU determinam sua posição atual; a saída anterior continua no histórico.
      if (tipo === 'CPU' && trocas.some(t => [t.anterior.patrimonio,t.nova.patrimonio].some(p => chave(p) === codigo) && (t.data || '') >= (r.data || ''))) return;
      const status = ['VELHO','BAIXA'].includes(r.tipo) ? 'BAIXA' : 'DOACAO';
      itens.set(id,{...anterior,patrimonio:r.patrimonio.trim(),marca:r.marca || anterior?.marca || 'Não informada',setor:r.destino || r.setor,tipoEquipamento:tipo,status});
    });
    return [...itens.values()].sort((a,b) => a.setor.localeCompare(b.setor,'pt-BR') || a.patrimonio.localeCompare(b.patrimonio,'pt-BR',{numeric:true}));
  }
  function filtrar(itens,filtros) {
    return itens.filter(r => (!filtros.patrimonio || chave(r.patrimonio).includes(chave(filtros.patrimonio))) && (!filtros.tipo || r.tipoEquipamento === filtros.tipo) && (!filtros.marca || chave(r.marca) === chave(filtros.marca)) && (!filtros.setor || chave(r.setor) === chave(filtros.setor)) && (!filtros.status || r.status === filtros.status));
  }
  function historico(registros,trocas) {
    const itens = [], cpus = new Set([...TrocasCPU.inventario(registros,trocas).keys()].map(chave));
    const monitores = new Set(registros.flatMap(r => [r.monitor1,r.monitor2]).filter(Boolean).map(chave));
    registros.forEach(r => {
      if (r.movimento === 'ENTRADA') ['cpu','monitor1','monitor2'].filter(id => r[id]?.trim()).forEach(id => itens.push({patrimonio:r[id].trim(),marca:r.marcas?.[id] || 'Não informada',setor:r.setor,tipoEquipamento:id === 'cpu' ? 'CPU' : 'MONITOR',movimento:'ENTRADA',status:'ATIVA',data:r.data}));
      else if (r.patrimonio?.trim()) itens.push({patrimonio:r.patrimonio.trim(),marca:r.marca || 'Não informada',setor:r.setor,tipoEquipamento:r.tipoEquipamento || (cpus.has(chave(r.patrimonio)) ? 'CPU' : monitores.has(chave(r.patrimonio)) ? 'MONITOR' : 'NAO_IDENTIFICADO'),movimento:`SAÍDA · ${r.tipo}`,status:['VELHO','BAIXA'].includes(r.tipo) ? 'BAIXA' : 'DOACAO',destino:r.destino,data:r.data});
    });
    trocas.forEach(t => {
      itens.push({patrimonio:t.anterior.patrimonio,marca:t.anterior.marca || 'Não informada',setor:t.setor,tipoEquipamento:'CPU',movimento:'SAÍDA EM TROCA',status:['BAIXA','DOACAO'].includes(t.destinoTipo) ? t.destinoTipo : 'ATIVA',destino:t.destinoSetor,data:t.data});
      itens.push({patrimonio:t.nova.patrimonio,marca:t.nova.marca || 'Não informada',setor:t.setor,tipoEquipamento:'CPU',movimento:'ENTRADA EM TROCA',status:'ATIVA',data:t.data});
    });
    return itens.sort((a,b) => (b.data || '').localeCompare(a.data || ''));
  }
  return {listar,filtrar,chave,historico};
})();
