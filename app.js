const CHAVE = "conferencia_patrimonial_v5";
const BACKUP_CHAVE = "conferencia_patrimonial_backup_v5";

const $ = (id) => document.getElementById(id);

let conferencia = carregar();
let scanner = null;
let lendo = false;

function carregar() {
  try {
    const valor = localStorage.getItem(CHAVE) || localStorage.getItem(BACKUP_CHAVE);
    if (!valor) return null;

    const dados = JSON.parse(valor);
    if (!dados || !dados.setor || !Array.isArray(dados.itens)) return null;

    if (!dados.responsavel) dados.responsavel = { nome: "", cpf: "" };
    return dados;
  } catch {
    return null;
  }
}

function persistir() {
  if (!conferencia) return;

  const texto = JSON.stringify(conferencia);
  localStorage.setItem(CHAVE, texto);
  localStorage.setItem(BACKUP_CHAVE, texto);
}

function tela(nome) {
  const telas = [
    "telaSetor",
    "telaSetorAtual",
    "telaResponsavel",
    "telaCamera",
    "telaManual",
    "telaDados",
    "telaFinal"
  ];

  telas.forEach((id) => {
    const elemento = $(id);
    if (elemento) elemento.classList.toggle("oculto", id !== nome);
  });

  window.scrollTo(0, 0);
}

function entrarNoSetor() {
  const setor = $("setor").value.trim();

  if (!setor) {
    $("erroSetor").textContent = "Informe o setor.";
    $("setor").focus();
    return;
  }

  // Evita apagar uma conferência que já está em andamento.
  if (conferencia && conferencia.itens.length > 0) {
    $("erroSetor").textContent =
      `Existe uma conferência salva do setor "${conferencia.setor}". Continue ou finalize antes de iniciar outra.`;
    mostrarRecuperacao();
    return;
  }

  conferencia = {
    setor,
    responsavel: { nome: "", cpf: "" },
    criadoEm: new Date().toISOString(),
    finalizadoEm: null,
    itens: []
  };

  persistir();
  renderizarLista();
  tela("telaSetorAtual");
}

function mostrarRecuperacao() {
  const box = $("recuperarBox");
  if (!box || !conferencia) return;

  $("recuperarInfo").textContent =
    `Setor: ${conferencia.setor} • ${conferencia.itens.length} patrimônio(s)`;

  box.classList.remove("oculto");
}

function continuarConferencia() {
  if (!conferencia) return;

  renderizarLista();
  tela("telaSetorAtual");
}

function abrirResponsavel() {
  if (!conferencia) return;

  const r = conferencia.responsavel || { nome: "", cpf: "" };

  $("nomeResponsavel").value = r.nome || "";
  $("cpfResponsavel").value = r.cpf || "";
  $("erroResponsavel").textContent = "";

  tela("telaResponsavel");
}

function salvarResponsavel() {
  if (!conferencia) return;

  const nome = $("nomeResponsavel").value.trim();
  const cpf = $("cpfResponsavel").value.replace(/\D/g, "").slice(0, 11);

  if (!nome || !cpf) {
    $("erroResponsavel").textContent = "Informe nome e CPF do usuário.";
    return;
  }

  conferencia.responsavel = { nome, cpf };
  persistir();
  renderizarLista();
  tela("telaSetorAtual");
}

function renderizarLista() {
  if (!conferencia) return;

  $("nomeSetor").textContent = conferencia.setor;
  $("setorCamera").textContent = conferencia.setor;
  $("quantidade").textContent = conferencia.itens.length;

  const r = conferencia.responsavel || { nome: "", cpf: "" };
  $("responsavelAtual").textContent = r.nome || "Não informado";
  $("cpfResponsavelAtual").textContent = r.cpf ? `CPF: ${r.cpf}` : "";

  const lista = $("lista");
  lista.innerHTML = "";

  $("listaVazia").classList.toggle(
    "oculto",
    conferencia.itens.length !== 0
  );

  // Mais recente primeiro.
  [...conferencia.itens].reverse().forEach((item, reverseIndex) => {
    const index = conferencia.itens.length - 1 - reverseIndex;

    const div = document.createElement("article");
    div.className = "item";

    div.innerHTML = `
      <div class="item-cabecalho">
        <div>
          <div class="item-numero">#${String(index + 1).padStart(2, "0")}</div>
          <div class="item-plaqueta">${escapar(item.plaqueta)}</div>
        </div>
        <button class="editar-item" type="button">EDITAR</button>
      </div>

      <div class="item-cpf">
        Tipo: ${escapar(item.tipoEquipamento || "CPU")}
      </div>

      ${
        item.descricao
          ? `<div class="item-descricao">${escapar(item.descricao)}</div>`
          : ""
      }

      ${
        item.compartilha
          ? `<div class="item-cpf">Compartilhado com: ${escapar(
              item.nomeCompartilhado || "—"
            )} • CPF: ${escapar(item.cpfCompartilhado || "—")}</div>`
          : ""
      }
    `;

    div.querySelector(".editar-item").addEventListener("click", () => {
      abrirEdicao(index);
    });

    lista.appendChild(div);
  });
}

function escapar(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function abrirCamera() {
  await fecharCamera();

  tela("telaCamera");
  $("statusCamera").textContent = "Abrindo câmera...";

  try {
    scanner = new Html5Qrcode("reader");

    await scanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 280, height: 120 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E
        ]
      },
      async (codigo) => {
        if (!lendo) return;

        lendo = false;
        await fecharCamera();
        abrirFormulario(codigo);
      },
      () => {}
    );

    lendo = true;
    $("statusCamera").textContent =
      "Aponte para o código de barras ou digite o código.";
  } catch (erro) {
    console.error(erro);
    scanner = null;
    lendo = false;

    $("statusCamera").textContent =
      "Não foi possível abrir a câmera. Você pode digitar o código manualmente.";
  }
}

async function fecharCamera() {
  lendo = false;

  if (!scanner) {
    const reader = $("reader");
    if (reader) reader.innerHTML = "";
    return;
  }

  try {
    await scanner.stop();
  } catch {}

  try {
    scanner.clear();
  } catch {}

  scanner = null;

  const reader = $("reader");
  if (reader) reader.innerHTML = "";
}

function abrirDigitacaoManual() {
  $("codigoManual").value = "";
  $("erroManual").textContent = "";
  tela("telaManual");

  setTimeout(() => $("codigoManual").focus(), 100);
}

function continuarDigitacaoManual() {
  const codigo = $("codigoManual").value.trim();

  if (!codigo) {
    $("erroManual").textContent = "Digite o código da plaqueta.";
    $("codigoManual").focus();
    return;
  }

  abrirFormulario(codigo);
}

function abrirEdicao(index) {
  const item = conferencia.itens[index];
  if (!item) return;

  $("plaquetaLida").textContent = item.plaqueta;
  $("descricao").value = item.descricao || "";
  $("tipoEquipamento").value = item.tipoEquipamento || "CPU";

  $("compartilha").checked = !!item.compartilha;
  $("nomeCompartilhado").value = item.nomeCompartilhado || "";
  $("cpfCompartilhado").value = item.cpfCompartilhado || "";

  $("camposCompartilhado").classList.toggle(
    "oculto",
    !item.compartilha
  );

  $("erroDados").textContent = "";
  $("btnSalvar").dataset.editIndex = String(index);
  $("btnSalvar").textContent = "SALVAR ALTERAÇÕES";

  tela("telaDados");
}

function abrirFormulario(codigo) {
  const valor = String(codigo || "").trim();

  $("plaquetaLida").textContent = valor || "—";
  $("descricao").value = "";
  $("tipoEquipamento").value = "CPU";

  $("compartilha").checked = false;
  $("nomeCompartilhado").value = "";
  $("cpfCompartilhado").value = "";
  $("camposCompartilhado").classList.add("oculto");

  $("erroDados").textContent = "";

  delete $("btnSalvar").dataset.editIndex;
  $("btnSalvar").textContent = "SALVAR PATRIMÔNIO";

  tela("telaDados");
}

function salvarPatrimonio() {
  if (!conferencia) return;

  const plaqueta = $("plaquetaLida").textContent.trim();
  const descricao = $("descricao").value.trim();
  const tipoEquipamento = $("tipoEquipamento").value;
  const compartilha = $("compartilha").checked;
  const nomeCompartilhado = $("nomeCompartilhado").value.trim();
  const cpfCompartilhado = $("cpfCompartilhado").value
    .replace(/\D/g, "")
    .slice(0, 11);

  if (!plaqueta || plaqueta === "—") {
    $("erroDados").textContent = "A plaqueta é obrigatória.";
    return;
  }

  if (
    compartilha &&
    (!nomeCompartilhado || !cpfCompartilhado)
  ) {
    $("erroDados").textContent =
      "Informe nome e CPF do segundo usuário.";
    return;
  }

  const editIndexRaw = $("btnSalvar").dataset.editIndex;
  const editando = editIndexRaw !== undefined;
  const editIndex = editando ? Number(editIndexRaw) : -1;

  const duplicada = conferencia.itens.some(
    (item, index) =>
      index !== editIndex &&
      item.plaqueta.toLowerCase() === plaqueta.toLowerCase()
  );

  if (duplicada) {
    $("erroDados").textContent =
      `A plaqueta ${plaqueta} já foi registrada neste setor.`;
    return;
  }

  const r = conferencia.responsavel || { nome: "", cpf: "" };

  const registro = {
    plaqueta,
    descricao,
    tipoEquipamento,
    nomeUsuario: r.nome || "",
    cpf: r.cpf || "",
    compartilha,
    nomeCompartilhado: compartilha ? nomeCompartilhado : "",
    cpfCompartilhado: compartilha ? cpfCompartilhado : "",
    dataHora: editando
      ? conferencia.itens[editIndex].dataHora
      : new Date().toISOString()
  };

  if (editando) {
    conferencia.itens[editIndex] = registro;
    delete $("btnSalvar").dataset.editIndex;
    $("btnSalvar").textContent = "SALVAR PATRIMÔNIO";
  } else {
    conferencia.itens.push(registro);
  }

  persistir();
  renderizarLista();
  tela("telaSetorAtual");
}

function finalizar() {
  if (!conferencia || !conferencia.itens.length) {
    alert("Nenhuma plaqueta foi registrada.");
    return;
  }

  conferencia.finalizadoEm = new Date().toISOString();
  persistir();

  $("finalSetor").textContent = conferencia.setor;
  $("finalResponsavel").textContent =
    (conferencia.responsavel && conferencia.responsavel.nome) ||
    "Não informado";
  $("finalQuantidade").textContent = conferencia.itens.length;
  $("statusCompartilhar").textContent = "";

  tela("telaFinal");
}

function textoConferencia() {
  const r = conferencia.responsavel || { nome: "", cpf: "" };

  return [
    "CONFERÊNCIA PATRIMONIAL",
    `Setor: ${conferencia.setor}`,
    `Responsável: ${r.nome || "Não informado"}`,
    `CPF: ${r.cpf || "Não informado"}`,
    `Total: ${conferencia.itens.length} patrimônio(s)`,
    "",
    ...[...conferencia.itens].reverse().map((item, reverseIndex) => {
      const numero = conferencia.itens.length - reverseIndex;

      const partes = [
        `${numero}. Plaqueta: ${item.plaqueta}`,
        `Tipo: ${item.tipoEquipamento || "CPU"}`,
        `Descrição: ${item.descricao || "—"}`,
        `Compartilhado: ${item.compartilha ? "Sim" : "Não"}`
      ];

      if (item.compartilha) {
        partes.push(
          `2º usuário: ${item.nomeCompartilhado || "—"}`,
          `CPF 2º usuário: ${item.cpfCompartilhado || "—"}`
        );
      }

      return partes.join("\n");
    })
  ].join("\n\n");
}

function enviarWhatsApp() {
  const texto = textoConferencia();
  const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;
  window.open(url, "_blank");
}

function nomeArquivo() {
  const setor = conferencia.setor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `conferencia_${setor || "setor"}_${new Date()
    .toISOString()
    .slice(0, 10)}.xlsx`;
}

function criarArquivoExcel() {
  const r = conferencia.responsavel || { nome: "", cpf: "" };

  const linhas = [
    ["CONFERÊNCIA PATRIMONIAL"],
    ["Setor", conferencia.setor],
    ["Responsável", r.nome || "—"],
    ["CPF", r.cpf || "—"],
    ["Total", conferencia.itens.length],
    [],
    [
      "#",
      "Plaqueta",
      "Tipo",
      "Descrição",
      "Compartilhado",
      "2º Usuário",
      "CPF 2º Usuário",
      "Data/Hora"
    ],
    ...conferencia.itens.map((item, index) => [
      index + 1,
      item.plaqueta,
      item.tipoEquipamento || "CPU",
      item.descricao || "",
      item.compartilha ? "SIM" : "NÃO",
      item.nomeCompartilhado || "",
      item.cpfCompartilhado || "",
      new Date(item.dataHora).toLocaleString("pt-BR")
    ])
  ];

  const ws = XLSX.utils.aoa_to_sheet(linhas);

  ws["!cols"] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 14 },
    { wch: 30 },
    { wch: 18 },
    { wch: 28 },
    { wch: 20 },
    { wch: 20 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Conferência");

  const bytes = XLSX.write(wb, {
    bookType: "xlsx",
    type: "array"
  });

  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });

  return new File([blob], nomeArquivo(), {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
}

async function compartilhar() {
  const arquivo = criarArquivoExcel();

  try {
    if (
      navigator.share &&
      (!navigator.canShare ||
        navigator.canShare({ files: [arquivo] }))
    ) {
      await navigator.share({
        title: "Conferência Patrimonial",
        text: `Conferência do setor ${conferencia.setor}`,
        files: [arquivo]
      });

      $("statusCompartilhar").textContent =
        "Compartilhamento aberto.";
    } else {
      baixar(arquivo);
      $("statusCompartilhar").textContent =
        "O Excel foi baixado.";
    }
  } catch (erro) {
    if (erro.name === "AbortError") {
      $("statusCompartilhar").textContent =
        "Compartilhamento cancelado. Os dados continuam salvos.";
      return;
    }

    baixar(arquivo);
    $("statusCompartilhar").textContent =
      "Não foi possível compartilhar. O Excel foi baixado.";
  }
}

function baixar(arquivo) {
  const url = URL.createObjectURL(arquivo);
  const a = document.createElement("a");

  a.href = url;
  a.download = arquivo.name;
  document.body.appendChild(a);
  a.click();
  a.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function novaConferencia() {
  const confirmou = confirm(
    "A conferência atual será apagada deste celular. Você já enviou o arquivo?"
  );

  if (!confirmou) return;

  localStorage.removeItem(CHAVE);
  localStorage.removeItem(BACKUP_CHAVE);

  conferencia = null;

  $("setor").value = "";
  $("erroSetor").textContent = "";
  $("recuperarBox").classList.add("oculto");

  tela("telaSetor");
}

// Eventos
$("btnEntrar").addEventListener("click", entrarNoSetor);

$("btnContinuarSalva").addEventListener("click", continuarConferencia);

$("btnTrocarResponsavel").addEventListener(
  "click",
  abrirResponsavel
);

$("btnSalvarResponsavel").addEventListener(
  "click",
  salvarResponsavel
);

$("btnVoltarResponsavel").addEventListener("click", () => {
  renderizarLista();
  tela("telaSetorAtual");
});

$("cpfResponsavel").addEventListener("input", () => {
  $("cpfResponsavel").value = $("cpfResponsavel").value
    .replace(/\D/g, "")
    .slice(0, 11);
});

$("btnLer").addEventListener("click", abrirCamera);

$("btnDigitar").addEventListener("click", async () => {
  await fecharCamera();
  abrirDigitacaoManual();
});

$("btnVoltarCamera").addEventListener("click", async () => {
  await fecharCamera();
  renderizarLista();
  tela("telaSetorAtual");
});

$("btnCancelarCamera").addEventListener("click", async () => {
  await fecharCamera();
  renderizarLista();
  tela("telaSetorAtual");
});

$("btnContinuarManual").addEventListener(
  "click",
  continuarDigitacaoManual
);

$("btnVoltarManual").addEventListener("click", () => {
  $("codigoManual").value = "";
  $("erroManual").textContent = "";
  renderizarLista();
  tela("telaSetorAtual");
});

$("codigoManual").addEventListener("keydown", (e) => {
  if (e.key === "Enter") continuarDigitacaoManual();
});

$("btnSalvar").addEventListener("click", salvarPatrimonio);

$("btnVoltarDados").addEventListener("click", () => {
  renderizarLista();
  tela("telaSetorAtual");
});

$("compartilha").addEventListener("change", () => {
  const ativo = $("compartilha").checked;

  $("camposCompartilhado").classList.toggle(
    "oculto",
    !ativo
  );

  if (ativo) {
    $("nomeCompartilhado").focus();
  } else {
    $("nomeCompartilhado").value = "";
    $("cpfCompartilhado").value = "";
  }
});

$("cpfCompartilhado").addEventListener("input", () => {
  $("cpfCompartilhado").value = $("cpfCompartilhado").value
    .replace(/\D/g, "")
    .slice(0, 11);
});

$("btnFinalizar").addEventListener("click", finalizar);
$("btnWhatsApp").addEventListener("click", enviarWhatsApp);
$("btnCompartilhar").addEventListener("click", compartilhar);
$("btnNova").addEventListener("click", novaConferencia);

$("setor").addEventListener("keydown", (e) => {
  if (e.key === "Enter") entrarNoSetor();
});

// Recuperação automática.
// Não apaga nada ao atualizar a página.
if (conferencia) {
  mostrarRecuperacao();
}
