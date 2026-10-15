const DB_NAME = "conferencia_troca_patrimonio";
const DB_VERSION = 1;
const LEGACY_KEYS = [
  "conferencia_patrimonial_v6",
  "conferencia_patrimonial_backup_v6",
  "conferencia_patrimonial_v5",
  "conferencia_patrimonial_backup_v5"
];

const $ = id => document.getElementById(id);
const telas = ["telaSetor", "telaOperacao", "telaLeitura", "telaConciliacao", "telaResumo", "telaFinal"];
let db;
let conferencia = null;
let modoLeitura = null;
let scanner = null;
let lendo = false;
let processandoLeitura = false;
let timerLeitura = null;
let limiteListaLeitura = 30;

const novoId = prefixo => `${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
const chaveCodigo = codigo => String(codigo || "").trim().toLocaleUpperCase("pt-BR");

function abrirBanco() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Este navegador não oferece armazenamento local IndexedDB."));
      return;
    }
    const requisicao = indexedDB.open(DB_NAME, DB_VERSION);
    requisicao.onupgradeneeded = () => {
      const banco = requisicao.result;
      if (!banco.objectStoreNames.contains("conferencias")) {
        banco.createObjectStore("conferencias", { keyPath: "id" });
      }
      if (!banco.objectStoreNames.contains("configuracoes")) {
        banco.createObjectStore("configuracoes", { keyPath: "chave" });
      }
    };
    requisicao.onsuccess = () => resolve(requisicao.result);
    requisicao.onerror = () => reject(requisicao.error || new Error("Não foi possível abrir o banco local."));
    requisicao.onblocked = () => reject(new Error("O banco local está ocupado por outra aba. Feche as outras abas e tente novamente."));
  });
}

function transacaoSalvar(dados, definirAtivo = false) {
  return new Promise((resolve, reject) => {
    const lojas = definirAtivo ? ["conferencias", "configuracoes"] : ["conferencias"];
    const transacao = db.transaction(lojas, "readwrite");
    transacao.objectStore("conferencias").put(dados);
    if (definirAtivo) {
      transacao.objectStore("configuracoes").put({ chave: "conferenciaAtiva", valor: dados.id });
    }
    transacao.oncomplete = () => resolve();
    transacao.onerror = () => reject(transacao.error || new Error("Falha ao salvar a conferência no celular."));
    transacao.onabort = () => reject(transacao.error || new Error("O salvamento local foi cancelado."));
  });
}

function obterAtiva() {
  return new Promise((resolve, reject) => {
    const transacao = db.transaction(["configuracoes", "conferencias"], "readonly");
    const requisicaoAtiva = transacao.objectStore("configuracoes").get("conferenciaAtiva");
    requisicaoAtiva.onsuccess = () => {
      const ativa = requisicaoAtiva.result;
      if (!ativa) {
        resolve(null);
        return;
      }
      const requisicaoConferencia = transacao.objectStore("conferencias").get(ativa.valor);
      requisicaoConferencia.onsuccess = () => resolve(requisicaoConferencia.result || null);
      requisicaoConferencia.onerror = () => reject(requisicaoConferencia.error || new Error("Não foi possível recuperar a conferência salva."));
    };
    requisicaoAtiva.onerror = () => reject(requisicaoAtiva.error || new Error("Não foi possível localizar a conferência salva."));
  });
}

function obterTodas() {
  return new Promise((resolve, reject) => {
    const transacao = db.transaction("conferencias", "readonly");
    const requisicao = transacao.objectStore("conferencias").getAll();
    requisicao.onsuccess = () => resolve(requisicao.result || []);
    requisicao.onerror = () => reject(requisicao.error || new Error("Não foi possível carregar os setores salvos."));
  });
}

function novaConferencia(setor) {
  const agora = new Date().toISOString();
  return {
    id: novoId("conferencia"),
    setor,
    criadaEm: agora,
    atualizadaEm: agora,
    status: "EM_ANDAMENTO",
    leiturasFinalizadas: { saida: false, entrada: false },
    saidas: [],
    entradas: []
  };
}

function gravarConferencia(definirAtiva = false) {
  if (!conferencia) return Promise.reject(new Error("Não há conferência ativa para salvar."));
  conferencia.atualizadaEm = new Date().toISOString();
  return transacaoSalvar(conferencia, definirAtiva);
}

function mostrarTela(id) {
  telas.forEach(tela => $(tela).classList.toggle("oculto", tela !== id));
  window.scrollTo(0, 0);
}

function mostrarErroSetor(mensagem) {
  $("erroSetor").textContent = mensagem;
}

function contarConferencia(dados) {
  const saidas = dados.saidas || [];
  const entradas = dados.entradas || [];
  const vinculadas = entradas.filter(item => item.saidaId || item.plaquetaAnteriorManual);
  const saidasUsadas = new Set(vinculadas.map(item => item.saidaId).filter(Boolean));
  const saidasDigitadas = vinculadas.filter(item => item.plaquetaAnteriorManual && !item.saidaId).length;
  return {
    vinculadas: vinculadas.length,
    paresLidos: vinculadas.filter(item => item.saidaId).length,
    semSaida: entradas.length - vinculadas.length,
    saidasSemEntrada: saidas.filter(item => !saidasUsadas.has(item.id)).length,
    digitadas: saidasDigitadas,
    divergencias: entradas.length - vinculadas.length +
      saidas.filter(item => !saidasUsadas.has(item.id)).length + saidasDigitadas
  };
}

function contagemConciliada() {
  return contarConferencia(conferencia);
}

function atualizarOperacao() {
  if (!conferencia) return;
  $("nomeSetor").textContent = conferencia.setor;
  $("totalSaidas").textContent = conferencia.saidas.length;
  $("totalEntradas").textContent = conferencia.entradas.length;
  $("statusSaida").textContent = conferencia.leiturasFinalizadas.saida
    ? "Leitura encerrada"
    : conferencia.saidas.length ? `${conferencia.saidas.length} plaqueta(s) lida(s)` : "Ainda não iniciada";
  $("statusEntrada").textContent = conferencia.leiturasFinalizadas.entrada
    ? "Leitura encerrada"
    : conferencia.entradas.length ? `${conferencia.entradas.length} plaqueta(s) lida(s)` : "Ainda não iniciada";
  const leiturasEncerradas = conferencia.leiturasFinalizadas.saida && conferencia.leiturasFinalizadas.entrada;
  $("btnConciliar").disabled = !leiturasEncerradas;
  $("ajudaConciliacao").textContent = leiturasEncerradas
    ? "Leituras encerradas. Escolha fazer os vínculos agora ou conferir o resumo com os itens sem par."
    : "Encerre as leituras de saída e entrada para liberar o vínculo automático ou manual.";
}

function mostrarRecuperacao() {
  if (!conferencia || conferencia.status !== "EM_ANDAMENTO") return;
  const resultado = contarConferencia(conferencia);
  $("recuperarInfo").textContent =
    `Setor ${conferencia.setor} · ${conferencia.saidas.length} saídas · ${conferencia.entradas.length} entradas · ${resultado.paresLidos} pares · ${resultado.divergencias} divergências.`;
  $("recuperarBox").classList.remove("oculto");
}

function criarIndicadorHistorico(rotulo, quantidade, tipo) {
  const indicador = document.createElement("div");
  indicador.className = `historico-indicador historico-indicador-${tipo}`;
  indicador.setAttribute("aria-label", `${rotulo}: ${quantidade}`);
  const numero = document.createElement("strong");
  numero.textContent = quantidade;
  const titulo = document.createElement("span");
  titulo.textContent = rotulo;
  indicador.append(numero, titulo);
  return indicador;
}

async function renderHistorico() {
  const lista = $("listaHistorico");
  lista.replaceChildren();
  try {
    const conferencias = (await obterTodas())
      .filter(dados => !(conferencia?.status === "EM_ANDAMENTO" && dados.id === conferencia.id))
      .sort((a, b) => new Date(b.atualizadaEm || b.criadaEm) - new Date(a.atualizadaEm || a.criadaEm));
    if (!conferencias.length) {
      const vazio = document.createElement("p");
      vazio.className = "historico-vazio";
      vazio.textContent = "Os setores anteriores aparecerão aqui.";
      lista.append(vazio);
      return;
    }
    conferencias.forEach(dados => {
      const linha = document.createElement("article");
      linha.className = "historico-item";
      const detalhes = document.createElement("div");
      detalhes.className = "historico-detalhes";
      const setor = document.createElement("strong");
      setor.textContent = dados.setor;
      const status = document.createElement("span");
      status.textContent = dados.status === "FINALIZADA" ? "Finalizada" : "Em andamento";
      detalhes.append(setor, status);
      const totais = document.createElement("span");
      totais.className = "historico-totais";
      const metricas = document.createElement("div");
      metricas.className = "historico-metricas";
      const contagem = contarConferencia(dados);
      metricas.append(
        criarIndicadorHistorico("Saíram", dados.saidas.length, "saida"),
        criarIndicadorHistorico("Entraram", dados.entradas.length, "entrada"),
        criarIndicadorHistorico("Pares", contagem.paresLidos, "pares"),
        criarIndicadorHistorico("Divergências", contagem.divergencias, contagem.divergencias ? "divergencia" : "ok")
      );
      totais.textContent = `Atualizado em ${new Date(dados.atualizadaEm || dados.criadaEm).toLocaleString("pt-BR")}`;
      const abrir = document.createElement("button");
      abrir.className = "botao botao-secundario";
      abrir.type = "button";
      abrir.textContent = dados.status === "FINALIZADA" ? "REABRIR PARA EDITAR" : "CONTINUAR";
      abrir.onclick = () => abrirHistorico(dados.id);
      linha.append(detalhes, metricas, totais, abrir);
      lista.append(linha);
    });
  } catch (erro) {
    const falha = document.createElement("p");
    falha.className = "historico-erro";
    falha.setAttribute("role", "alert");
    falha.textContent = `Não foi possível carregar os setores salvos: ${erro.message}`;
    lista.append(falha);
  }
}

async function abrirHistorico(id) {
  try {
    const dados = (await obterTodas()).find(item => item.id === id);
    if (!dados) {
      await renderHistorico();
      return;
    }
    const anterior = conferencia;
    conferencia = dados;
    if (conferencia.status === "FINALIZADA") {
      conferencia.status = "EM_ANDAMENTO";
      conferencia.reabertaEm = new Date().toISOString();
    }
    try {
      await gravarConferencia(true);
    } catch (erro) {
      conferencia = anterior;
      throw erro;
    }
    $("setor").value = "";
    $("recuperarBox").classList.add("oculto");
    mostrarErroSetor("");
    atualizarOperacao();
    mostrarTela("telaOperacao");
  } catch (erro) {
    mostrarErroSetor(`Não foi possível abrir a conferência salva: ${erro.message}`);
    await renderHistorico();
  }
}

async function iniciar() {
  const setor = $("setor").value.trim();
  if (!setor) {
    mostrarErroSetor("Informe o setor para continuar.");
    $("setor").focus();
    return;
  }
  if (conferencia?.status === "EM_ANDAMENTO") {
    mostrarRecuperacao();
    mostrarErroSetor("Já existe uma conferência em andamento neste celular. Continue a conferência salva.");
    return;
  }
  const anterior = conferencia;
  conferencia = novaConferencia(setor);
  try {
    await gravarConferencia(true);
    await renderHistorico();
    $("recuperarBox").classList.add("oculto");
    mostrarErroSetor("");
    atualizarOperacao();
    mostrarTela("telaOperacao");
  } catch (erro) {
    conferencia = anterior;
    mostrarErroSetor(`Não foi possível salvar o setor: ${erro.message}`);
  }
}

function continuar() {
  if (!conferencia) return;
  $("recuperarBox").classList.add("oculto");
  atualizarOperacao();
  mostrarTela("telaOperacao");
}

async function abrirLeitura(modo) {
  if (!conferencia) return;
  const estavaEncerrada = conferencia.leiturasFinalizadas[modo];
  conferencia.leiturasFinalizadas[modo] = false;
  try {
    await gravarConferencia();
  } catch (erro) {
    conferencia.leiturasFinalizadas[modo] = estavaEncerrada;
    $("statusOperacao").textContent = `Não foi possível reabrir a leitura: ${erro.message}`;
    atualizarOperacao();
    return;
  }
  modoLeitura = modo;
  limiteListaLeitura = 30;
  const saida = modo === "saida";
  $("rotuloLeitura").textContent = saida ? "SAÍDA" : "ENTRADA";
  $("tituloLeitura").textContent = saida ? "Ler plaquetas antigas" : "Ler plaquetas novas";
  $("ajudaLeitura").textContent = `Setor ${conferencia.setor}. Cada plaqueta válida será salva assim que for lida.`;
  const itens = saida ? conferencia.saidas : conferencia.entradas;
  const ultima = itens.at(-1);
  $("ultimaPlaqueta").textContent = ultima?.plaqueta || "—";
  $("confirmacaoLeitura").textContent = ultima ? "Última plaqueta já salva neste celular" : "";
  $("codigoManual").value = "";
  mostrarStatusLeitura(ultima
    ? `${itens.length} plaqueta(s) já salva(s). A próxima leitura será adicionada à lista.`
    : "As plaquetas serão exibidas aqui após serem salvas.", "neutro");
  renderListaLeitura();
  mostrarTela("telaLeitura");
  iniciarCamera();
}

function mostrarStatusLeitura(mensagem, tipo) {
  const status = $("statusCamera");
  status.className = `status status-leitura-${tipo}`;
  status.textContent = mensagem;
}

function renderListaLeitura() {
  const itens = modoLeitura === "saida" ? conferencia?.saidas || [] : conferencia?.entradas || [];
  const lista = $("listaLeituras");
  lista.replaceChildren();
  $("quantidadeListaLeitura").textContent = `${itens.length} ${itens.length === 1 ? "lida" : "lidas"}`;
  $("listaLeituraVazia").classList.toggle("oculto", itens.length > 0);
  const inicio = Math.max(0, itens.length - limiteListaLeitura);
  for (let indice = itens.length - 1; indice >= inicio; indice -= 1) {
    const item = itens[indice];
    const linha = document.createElement("li");
    const codigo = document.createElement("strong");
    codigo.textContent = item.plaqueta;
    const horario = document.createElement("time");
    horario.dateTime = item.dataHora;
    horario.textContent = new Date(item.dataHora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    linha.append(codigo, horario);
    lista.append(linha);
  }
  $("btnMaisLeituras").classList.toggle("oculto", inicio === 0);
  $("btnMaisLeituras").textContent = `CARREGAR MAIS ANTIGAS (${inicio})`;
}

async function iniciarCamera() {
  await fecharCamera();
  mostrarStatusLeitura("Abrindo câmera…", "neutro");
  if (typeof Html5Qrcode === "undefined") {
    mostrarStatusLeitura("Leitor de câmera indisponível. Digite cada código no campo abaixo.", "erro");
    return;
  }
  try {
    scanner = new Html5Qrcode("reader");
    await scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 260, height: 120 } },
      codigo => processarLeitura(codigo, true),
      () => {}
    );
    lendo = true;
    mostrarStatusLeitura("Câmera ativa. Aponte para uma plaqueta.", "neutro");
  } catch (erro) {
    scanner = null;
    lendo = false;
    mostrarStatusLeitura("Não foi possível abrir a câmera. Verifique a permissão ou digite o código.", "erro");
  }
}

async function fecharCamera() {
  lendo = false;
  if (timerLeitura) {
    clearTimeout(timerLeitura);
    timerLeitura = null;
  }
  if (scanner) {
    const atual = scanner;
    scanner = null;
    try {
      if (atual.isScanning) await atual.stop();
      atual.clear();
    } catch (erro) {
      $("statusCamera").textContent = `A câmera não encerrou corretamente: ${erro.message}`;
    }
  }
  if ($("reader")) $("reader").replaceChildren();
}

async function processarLeitura(valor, veioDaCamera = false) {
  const plaqueta = String(valor || "").trim();
  if (!plaqueta || processandoLeitura || !conferencia || !modoLeitura) return;
  processandoLeitura = true;
  lendo = false;
  const lista = modoLeitura === "saida" ? conferencia.saidas : conferencia.entradas;
  if (lista.some(item => chaveCodigo(item.plaqueta) === chaveCodigo(plaqueta))) {
    mostrarStatusLeitura(`Plaqueta ${plaqueta} já foi lida nesta etapa; não foi registrada novamente.`, "erro");
    liberarLeitura();
    return;
  }
  const item = { id: novoId(modoLeitura), plaqueta, dataHora: new Date().toISOString() };
  lista.push(item);
  mostrarStatusLeitura(`Salvando plaqueta ${plaqueta} neste celular…`, "neutro");
  try {
    await gravarConferencia();
    $("ultimaPlaqueta").textContent = plaqueta;
    $("confirmacaoLeitura").textContent = `${modoLeitura === "saida" ? "Saída" : "Entrada"} salva neste celular`;
    mostrarStatusLeitura(`${plaqueta} salva neste celular. Pode aproximar a próxima plaqueta.`, "sucesso");
    if (navigator.vibrate) navigator.vibrate(80);
    $("codigoManual").value = "";
    renderListaLeitura();
    atualizarOperacao();
  } catch (erro) {
    lista.pop();
    mostrarStatusLeitura(`Não foi possível salvar ${plaqueta}: ${erro.message}. Tente novamente.`, "erro");
  }
  if (veioDaCamera) liberarLeitura();
  else {
    processandoLeitura = false;
    if (scanner && $("telaLeitura").classList.contains("oculto") === false) lendo = true;
  }
}

function liberarLeitura() {
  if (timerLeitura) clearTimeout(timerLeitura);
  timerLeitura = setTimeout(() => {
    processandoLeitura = false;
    if (scanner && !$("telaLeitura").classList.contains("oculto")) lendo = true;
  }, 900);
}

async function encerrarLeitura() {
  if (!conferencia || !modoLeitura) return;
  const modo = modoLeitura;
  await fecharCamera();
  modoLeitura = null;
  conferencia.leiturasFinalizadas[modo] = true;
  try {
    await gravarConferencia();
    atualizarOperacao();
    mostrarTela("telaOperacao");
  } catch (erro) {
    conferencia.leiturasFinalizadas[modo] = false;
    $("statusOperacao").textContent = `Não foi possível encerrar a leitura: ${erro.message}`;
    atualizarOperacao();
    mostrarTela("telaOperacao");
  }
}

async function voltarDaLeitura() {
  await fecharCamera();
  modoLeitura = null;
  atualizarOperacao();
  mostrarTela("telaOperacao");
}

function criarCampoConciliacao(entrada) {
  const card = document.createElement("article");
  card.className = "item conciliacao-item";
  const rotulo = document.createElement("span");
  rotulo.className = "rotulo";
  rotulo.textContent = "PLAQUETA NOVA";
  const codigoNovo = document.createElement("strong");
  codigoNovo.className = "item-plaqueta";
  codigoNovo.textContent = entrada.plaqueta;
  const label = document.createElement("label");
  label.className = "campo-conciliacao-label";
  label.textContent = "Plaqueta antiga lida na saída";
  const select = document.createElement("select");
  select.className = "select-conciliacao";
  const vazio = document.createElement("option");
  vazio.value = "";
  vazio.textContent = "Escolha uma plaqueta de saída";
  select.append(vazio);
  const usadasPorOutrasEntradas = new Set(
    conferencia.entradas.filter(item => item.id !== entrada.id && item.saidaId).map(item => item.saidaId)
  );
  conferencia.saidas.forEach(saida => {
    if (usadasPorOutrasEntradas.has(saida.id)) return;
    const opcao = document.createElement("option");
    opcao.value = saida.id;
    opcao.textContent = saida.plaqueta;
    select.append(opcao);
  });
  select.value = entrada.saidaId || "";
  const manualLabel = document.createElement("label");
  manualLabel.className = "campo-conciliacao-label";
  manualLabel.textContent = "Ou digite a plaqueta antiga";
  const manualInput = document.createElement("input");
  manualInput.className = "input-manual-conciliacao";
  manualInput.type = "text";
  manualInput.autocomplete = "off";
  manualInput.placeholder = "Código antigo";
  manualInput.value = entrada.plaquetaAnteriorManual || "";
  const estado = document.createElement("small");
  estado.className = "estado-conciliacao";
  const salvarVinculo = document.createElement("button");
  salvarVinculo.className = "botao botao-secundario";
  salvarVinculo.type = "button";
  salvarVinculo.textContent = "SALVAR VÍNCULO";
  salvarVinculo.onclick = () => salvarConciliacao(entrada.id, select.value, manualInput.value, estado);
  select.onchange = () => {
    if (select.value) manualInput.value = "";
  };
  card.append(rotulo, codigoNovo, label, select, manualLabel, manualInput, salvarVinculo, estado);
  if (entrada.saidaId) {
    const saida = conferencia.saidas.find(item => item.id === entrada.saidaId);
    estado.textContent = saida ? `Vinculada à saída ${saida.plaqueta}.` : "A saída vinculada não está disponível.";
  } else if (entrada.plaquetaAnteriorManual) {
    estado.textContent = `Plaqueta antiga digitada: ${entrada.plaquetaAnteriorManual}. Será apontada como divergência se não constar nas saídas lidas.`;
  } else {
    estado.textContent = "Ainda sem vínculo.";
  }
  return card;
}

function renderConciliacao() {
  if (!conferencia.leiturasFinalizadas.saida || !conferencia.leiturasFinalizadas.entrada) {
    $("statusOperacao").textContent = "Encerre as duas etapas de leitura antes de relacionar as plaquetas.";
    atualizarOperacao();
    mostrarTela("telaOperacao");
    return;
  }
  const lista = $("listaConciliacao");
  lista.replaceChildren();
  $("conciliacaoVazia").classList.toggle("oculto", conferencia.entradas.length > 0);
  conferencia.entradas.forEach(entrada => lista.append(criarCampoConciliacao(entrada)));
  $("erroConciliacao").textContent = "";
  $("statusSequencia").textContent = "";
  mostrarTela("telaConciliacao");
}

async function vincularEmSequencia() {
  if (!conferencia.leiturasFinalizadas.saida || !conferencia.leiturasFinalizadas.entrada) {
    $("statusSequencia").textContent = "Encerre as leituras de saída e entrada antes de vincular em sequência.";
    return;
  }
  const saidasUsadas = new Set(conferencia.entradas.map(item => item.saidaId).filter(Boolean));
  const entradasLivres = conferencia.entradas.filter(item => !item.saidaId && !item.plaquetaAnteriorManual);
  const saidasLivres = conferencia.saidas.filter(item => !saidasUsadas.has(item.id));
  const quantidade = Math.min(entradasLivres.length, saidasLivres.length);
  if (!quantidade) {
    $("statusSequencia").textContent = "Não há entradas e saídas livres suficientes para criar novos pares.";
    return;
  }
  const anteriores = entradasLivres.map(item => ({ item, saidaId: item.saidaId }));
  entradasLivres.slice(0, quantidade).forEach((entrada, indice) => {
    entrada.saidaId = saidasLivres[indice].id;
  });
  try {
    await gravarConferencia();
    const semEntrada = saidasLivres.length - quantidade;
    const semSaida = entradasLivres.length - quantidade;
    $("statusSequencia").textContent =
      `${quantidade} par(es) vinculado(s) pela ordem das leituras.` +
      (semEntrada || semSaida ? ` Restam ${semEntrada} saída(s) e ${semSaida} entrada(s) sem par.` : "");
    renderConciliacao();
    $("statusSequencia").textContent =
      `${quantidade} par(es) vinculado(s) pela ordem das leituras.` +
      (semEntrada || semSaida ? ` Restam ${semEntrada} saída(s) e ${semSaida} entrada(s) sem par.` : "");
  } catch (erro) {
    anteriores.forEach(({ item, saidaId }) => { item.saidaId = saidaId; });
    $("statusSequencia").textContent = `Não foi possível salvar os vínculos em sequência: ${erro.message}`;
  }
}

async function salvarConciliacao(entradaId, saidaId, codigoManual, estado) {
  if (!conferencia.leiturasFinalizadas.saida || !conferencia.leiturasFinalizadas.entrada) {
    $("erroConciliacao").textContent = "Encerre as leituras de saída e entrada antes de salvar vínculos.";
    return;
  }
  const entrada = conferencia.entradas.find(item => item.id === entradaId);
  if (!entrada) return;
  const digitado = codigoManual.trim();
  let saida = saidaId ? conferencia.saidas.find(item => item.id === saidaId) : null;
  if (!saida && digitado) {
    saida = conferencia.saidas.find(item => chaveCodigo(item.plaqueta) === chaveCodigo(digitado)) || null;
  }
  if (saida) {
    const jaUsada = conferencia.entradas.some(item => item.id !== entradaId && item.saidaId === saida.id);
    if (jaUsada) {
      $("erroConciliacao").textContent = `A plaqueta de saída ${saida.plaqueta} já está vinculada a outra entrada.`;
      return;
    }
  }
  if (!saida && !digitado) {
    $("erroConciliacao").textContent = "Escolha uma saída lida ou digite a plaqueta antiga.";
    return;
  }
  const anterior = { saidaId: entrada.saidaId, plaquetaAnteriorManual: entrada.plaquetaAnteriorManual };
  entrada.saidaId = saida?.id || null;
  entrada.plaquetaAnteriorManual = saida ? "" : digitado;
  try {
    await gravarConferencia();
    $("erroConciliacao").textContent = "";
    estado.textContent = saida
      ? `Vinculada à saída ${saida.plaqueta}.`
      : `Plaqueta ${digitado} digitada, mas não foi lida na etapa de saída. Divergência registrada.`;
    estado.classList.toggle("estado-divergente", !saida);
  } catch (erro) {
    entrada.saidaId = anterior.saidaId;
    entrada.plaquetaAnteriorManual = anterior.plaquetaAnteriorManual;
    $("erroConciliacao").textContent = `Não foi possível salvar o vínculo: ${erro.message}`;
  }
}

function renderResumo() {
  if (!conferencia) return;
  const resultado = contagemConciliada();
  const divergencias = resultado.semSaida + resultado.saidasSemEntrada + resultado.digitadas;
  $("resumoSetor").textContent = conferencia.setor;
  $("resumoSaidas").textContent = conferencia.saidas.length;
  $("resumoEntradas").textContent = conferencia.entradas.length;
  $("resumoPares").textContent = resultado.paresLidos;
  $("resumoSemSaida").textContent = resultado.semSaida;
  $("resumoSobraSaida").textContent = resultado.saidasSemEntrada;
  $("resumoDigitadas").textContent = resultado.digitadas;
  $("alertaDivergencia").classList.toggle("oculto", divergencias === 0);
  $("alertaDivergencia").textContent = divergencias
    ? `A conferência tem ${divergencias} divergência(s). Você pode finalizar; elas serão destacadas na planilha.`
    : "";
  $("alertaSucesso").classList.toggle("oculto", divergencias !== 0);
  mostrarTela("telaResumo");
}

async function finalizar() {
  const estadoAnterior = conferencia.status;
  conferencia.status = "FINALIZADA";
  conferencia.finalizadaEm = new Date().toISOString();
  try {
    await gravarConferencia();
    await renderHistorico();
    const resultado = contagemConciliada();
    $("finalSetor").textContent = conferencia.setor;
    $("finalSaidas").textContent = conferencia.saidas.length;
    $("finalEntradas").textContent = conferencia.entradas.length;
    $("finalDivergencias").textContent = resultado.semSaida + resultado.saidasSemEntrada + resultado.digitadas;
    $("statusExportacao").textContent = "";
    mostrarTela("telaFinal");
  } catch (erro) {
    conferencia.status = estadoAnterior;
    $("alertaDivergencia").textContent = `Não foi possível finalizar porque o salvamento local falhou: ${erro.message}`;
    $("alertaDivergencia").classList.remove("oculto");
  }
}

function textoResumo() {
  const resultado = contagemConciliada();
  const divergencias = resultado.semSaida + resultado.saidasSemEntrada + resultado.digitadas;
  return [
    "CONFERÊNCIA DE TROCA DE PLAQUETAS",
    `Setor: ${conferencia.setor}`,
    `Saídas: ${conferencia.saidas.length}`,
    `Entradas: ${conferencia.entradas.length}`,
    `Pares lidos: ${resultado.paresLidos}`,
    `Entradas sem saída vinculada: ${resultado.semSaida}`,
    `Saídas sem entrada vinculada: ${resultado.saidasSemEntrada}`,
    `Plaquetas antigas digitadas e não lidas na saída: ${resultado.digitadas}`,
    `Divergências: ${divergencias}`
  ].join("\n");
}

function linhasPlanilha() {
  const resultado = contagemConciliada();
  const linhas = [
    ["CONFERÊNCIA DE TROCA DE PLAQUETAS"],
    ["Setor", conferencia.setor],
    ["Data de criação", new Date(conferencia.criadaEm).toLocaleString("pt-BR")],
    ["Saídas lidas", conferencia.saidas.length],
    ["Entradas lidas", conferencia.entradas.length],
    ["Pares relacionados por leitura", resultado.paresLidos],
    ["Entradas sem saída vinculada", resultado.semSaida],
    ["Saídas sem entrada vinculada", resultado.saidasSemEntrada],
    ["Plaquetas antigas digitadas e não lidas na saída", resultado.digitadas],
    [],
    ["Setor", "Tipo", "Plaqueta", "Plaqueta correspondente", "Situação", "Data/Hora"]
  ];
  const saidasUsadas = new Set();
  conferencia.entradas.forEach(entrada => {
    const saida = conferencia.saidas.find(item => item.id === entrada.saidaId);
    if (saida) saidasUsadas.add(saida.id);
    const antiga = saida?.plaqueta || entrada.plaquetaAnteriorManual || "";
    const situacao = saida ? "PAR" : entrada.plaquetaAnteriorManual ? "DIVERGÊNCIA: ANTIGA NÃO LIDA NA SAÍDA" : "DIVERGÊNCIA: SEM VÍNCULO";
    linhas.push([conferencia.setor, "ENTRADA", entrada.plaqueta, antiga, situacao, new Date(entrada.dataHora).toLocaleString("pt-BR")]);
  });
  conferencia.saidas.forEach(saida => {
    const entrada = conferencia.entradas.find(item => item.saidaId === saida.id);
    if (!entrada) {
      linhas.push([conferencia.setor, "SAÍDA", saida.plaqueta, "", "DIVERGÊNCIA: SEM ENTRADA", new Date(saida.dataHora).toLocaleString("pt-BR")]);
    }
  });
  return linhas;
}

function csvDe(linhas) {
  const proteger = valor => {
    let texto = String(valor ?? "");
    if (/^[=+\-@]/.test(texto)) texto = `'${texto}`;
    return `"${texto.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + linhas.map(linha => linha.map(proteger).join(";")).join("\r\n");
}

function baixarArquivo(conteudo, nome, tipo) {
  const arquivo = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportarLegado() {
  const chave = LEGACY_KEYS.find(nome => localStorage.getItem(nome));
  if (!chave) {
    $("erroSetor").textContent = "Não foram encontrados dados antigos para exportar.";
    return;
  }
  baixarArquivo(
    localStorage.getItem(chave),
    `backup_conferencia_antiga_${new Date().toISOString().slice(0, 10)}.json`,
    "application/json;charset=utf-8"
  );
}

function exportar() {
  const nomeSetor = conferencia.setor.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "setor";
  const data = new Date().toISOString().slice(0, 10);
  const nome = `troca_plaquetas_${nomeSetor}_${data}`;
  const linhas = linhasPlanilha();
  if (window.XLSX?.utils) {
    const planilha = XLSX.utils.aoa_to_sheet(linhas);
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, "Conferência");
    XLSX.writeFile(livro, `${nome}.xlsx`);
    $("statusExportacao").textContent = "Planilha Excel exportada.";
  } else {
    baixarArquivo(csvDe(linhas), `${nome}.csv`, "text/csv;charset=utf-8");
    $("statusExportacao").textContent = "Arquivo CSV exportado e compatível com Excel.";
  }
}

function iniciarNova() {
  conferencia = null;
  $("setor").value = "";
  $("recuperarBox").classList.add("oculto");
  mostrarErroSetor("");
  renderHistorico();
  mostrarTela("telaSetor");
  $("setor").focus();
}

function configurarEventos() {
  $("btnIniciar").onclick = iniciar;
  $("btnAtualizarHistorico")?.addEventListener("click", renderHistorico);
  $("btnContinuar").onclick = continuar;
  $("btnSaida").onclick = () => abrirLeitura("saida");
  $("btnEntrada").onclick = () => abrirLeitura("entrada");
  $("btnVoltarLeitura").onclick = voltarDaLeitura;
  $("btnEncerrarLeitura").onclick = encerrarLeitura;
  $("btnSalvarManual").onclick = () => processarLeitura($("codigoManual").value, false);
  $("btnMaisLeituras").onclick = () => {
    limiteListaLeitura += 30;
    renderListaLeitura();
  };
  $("codigoManual").onkeydown = evento => {
    if (evento.key === "Enter") processarLeitura($("codigoManual").value, false);
  };
  $("btnConciliar").onclick = renderConciliacao;
  $("btnVincularSequencia").onclick = vincularEmSequencia;
  $("btnVoltarConciliacao").onclick = () => {
    atualizarOperacao();
    mostrarTela("telaOperacao");
  };
  $("btnVoltarResumo").onclick = () => {
    atualizarOperacao();
    mostrarTela("telaOperacao");
  };
  $("btnResumo").onclick = renderResumo;
  $("btnFinalizar").onclick = finalizar;
  $("btnRevisar").onclick = renderConciliacao;
  $("btnExportar").onclick = exportar;
  $("btnWhatsApp").onclick = () => window.open(`https://wa.me/?text=${encodeURIComponent(textoResumo())}`, "_blank");
  $("btnNova").onclick = iniciarNova;
  $("btnExportarLegado").onclick = exportarLegado;
  $("btnTrocarSetor").onclick = iniciarNova;
  $("setor").onkeydown = evento => {
    if (evento.key === "Enter") iniciar();
  };
}

async function iniciarAplicacao() {
  configurarEventos();
  $("avisoLegado").classList.toggle("oculto", !LEGACY_KEYS.some(chave => localStorage.getItem(chave)));
  try {
    db = await abrirBanco();
    conferencia = await obterAtiva();
    await renderHistorico();
    if (conferencia?.status === "EM_ANDAMENTO") mostrarRecuperacao();
  } catch (erro) {
    mostrarErroSetor(`O armazenamento local não pôde ser iniciado: ${erro.message}`);
    $("btnIniciar").disabled = true;
  }
}

iniciarAplicacao();
