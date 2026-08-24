const CHAVE = "conferencia_patrimonial_v3";
const BACKUP_CHAVE = "conferencia_patrimonial_backup";

const $ = (id) => document.getElementById(id);

let conferencia = carregar();
let scanner = null;
let lendo = false;

function carregar() {
  try {
    const valor = localStorage.getItem(CHAVE);
    return valor ? JSON.parse(valor) : null;
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
  const telas = ["telaSetor", "telaSetorAtual", "telaCamera", "telaManual", "telaDados", "telaFinal"];
  telas.forEach((id) => $(id).classList.toggle("oculto", id !== nome));
  window.scrollTo(0, 0);
}

function entrarNoSetor() {
  if (conferencia && Array.isArray(conferencia.itens)) {
    $("erroSetor").textContent =
      "Existe uma conferência salva. Use 'Continuar conferência' ou finalize a atual antes de iniciar outra.";
    mostrarRecuperacao();
    return;
  }

  const setor = $("setor").value.trim();

  if (!setor) {
    $("erroSetor").textContent = "Informe o setor.";
    $("setor").focus();
    return;
  }

  conferencia = {
    setor,
    criadoEm: new Date().toISOString(),
    finalizadoEm: null,
    itens: []
  };

  persistir();
  renderizarLista();
  $("setorCamera").textContent = setor;
  tela("telaSetorAtual");
}

function renderizarLista() {
  $("nomeSetor").textContent = conferencia.setor;
  $("setorCamera").textContent = conferencia.setor;
  $("quantidade").textContent = conferencia.itens.length;

  const lista = $("lista");
  lista.innerHTML = "";

  $("listaVazia").classList.toggle("oculto", conferencia.itens.length !== 0);

  conferencia.itens.forEach((item, index) => {
    const div = document.createElement("article");
    div.className = "item";

    div.innerHTML = `
      <div class="item-numero">#${String(index + 1).padStart(2, "0")}</div>
      <div class="item-cabecalho">
        <div class="item-plaqueta">${escapar(item.plaqueta)}</div>
        <button class="editar-item" type="button" data-index="${index}">EDITAR</button>
      </div>
      ${item.descricao ? `<div class="item-descricao">${escapar(item.descricao)}</div>` : ""}
      ${item.nomeUsuario ? `<div class="item-cpf">Usuário: ${escapar(item.nomeUsuario)}</div>` : ""}
      ${item.cpf ? `<div class="item-cpf">CPF: ${escapar(item.cpf)}</div>` : ""}
      <div class="item-cpf">GLPI: ${item.glpi === "SIM" ? "Instalar" : "Não instalar"}</div>
      ${item.compartilha ? `<div class="item-cpf">2º usuário: ${escapar(item.nomeCompartilhado)} • CPF: ${escapar(item.cpfCompartilhado)}</div>` : ""}
    `;

    lista.appendChild(div);

    div.querySelector(".editar-item").addEventListener("click", () => {
      abrirEdicao(index);
    });
  });
}

function escapar(valor) {
  return String(valor)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function abrirCamera() {
  tela("telaCamera");
  $("statusCamera").textContent = "Abrindo câmera...";

  scanner = new Html5Qrcode("reader");

  try {
    await scanner.start(
      { facingMode: "environment" },
      {
        fps: 10,
        qrbox: { width: 300, height: 150 },
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
    $("statusCamera").textContent = "Aponte para a plaqueta.";
  } catch (erro) {
    console.error(erro);
    $("statusCamera").textContent =
      "Não foi possível abrir a câmera. Verifique a permissão.";
  }
}

async function fecharCamera() {
  if (!scanner) return;

  try {
    await scanner.stop();
  } catch {}

  try {
    scanner.clear();
  } catch {}

  scanner = null;
  lendo = false;
  $("reader").innerHTML = "";
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

function abrirFormulario(codigo) {
  $("plaquetaLida").textContent = codigo;
  $("descricao").value = "";
  $("nomeUsuario").value = "";
  $("cpf").value = "";
  $("glpi").value = "NAO";
  $("compartilha").checked = false;
  $("nomeCompartilhado").value = "";
  $("cpfCompartilhado").value = "";
  $("camposCompartilhado").classList.add("oculto");
  $("erroDados").textContent = "";
  delete $("btnSalvar").dataset.editIndex;
  $("btnSalvar").textContent = "SALVAR PATRIMÔNIO";

  tela("telaDados");
}

function abrirEdicao(index) {
  const item = conferencia.itens[index];
  if (!item) return;

  $("plaquetaLida").textContent = item.plaqueta;
  $("descricao").value = item.descricao || "";
  $("nomeUsuario").value = item.nomeUsuario || "";
  $("cpf").value = item.cpf || "";
  $("glpi").value = item.glpi || "NAO";
  $("compartilha").checked = !!item.compartilha;
  $("nomeCompartilhado").value = item.nomeCompartilhado || "";
  $("cpfCompartilhado").value = item.cpfCompartilhado || "";
  $("camposCompartilhado").classList.toggle("oculto", !item.compartilha);
  $("erroDados").textContent = "";

  $("btnSalvar").textContent = "SALVAR ALTERAÇÕES";
  $("btnSalvar").dataset.editIndex = String(index);

  tela("telaDados");
}

function salvarPatrimonio() {
  const plaqueta = $("plaquetaLida").textContent.trim();
  const descricao = $("descricao").value.trim();
  const nomeUsuario = $("nomeUsuario").value.trim();
  const cpf = $("cpf").value.trim();
  const glpi = $("glpi").value;
  const compartilha = $("compartilha").checked;
  const nomeCompartilhado = $("nomeCompartilhado").value.trim();
  const cpfCompartilhado = $("cpfCompartilhado").value.trim();

  if (!plaqueta || plaqueta === "—") {
    $("erroDados").textContent = "A plaqueta é obrigatória.";
    return;
  }

  if (compartilha && (!nomeCompartilhado || !cpfCompartilhado)) {
    $("erroDados").textContent =
      "Informe o nome e o CPF do segundo usuário.";
    if (!nomeCompartilhado) $("nomeCompartilhado").focus();
    else $("cpfCompartilhado").focus();
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

  const registro = {
    plaqueta,
    descricao,
    nomeUsuario,
    cpf,
    glpi,
    compartilha,
    nomeCompartilhado: compartilha ? nomeCompartilhado : "",
    cpfCompartilhado: compartilha ? cpfCompartilhado : "",
    dataHora: editando ? conferencia.itens[editIndex].dataHora : new Date().toISOString()
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
  if (!conferencia.itens.length) {
    alert("Nenhuma plaqueta foi registrada.");
    return;
  }

  conferencia.finalizadoEm = new Date().toISOString();
  persistir();

  $("finalSetor").textContent = conferencia.setor;
  $("finalQuantidade").textContent = conferencia.itens.length;
  $("statusCompartilhar").textContent = "";

  tela("telaFinal");
}

function nomeArquivo() {
  const setor = conferencia.setor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `conferencia_${setor || "setor"}_${new Date().toISOString().slice(0, 10)}.pdf`;
}

function criarPdf() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4"
  });

  const margem = 12;
  const agora = new Date().toLocaleString("pt-BR");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("CONFERÊNCIA PATRIMONIAL", margem, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Setor: ${conferencia.setor}`, margem, 22);
  doc.text(`Total de patrimônios: ${conferencia.itens.length}`, margem, 28);
  doc.text(`Gerado em: ${agora}`, margem, 34);

  const linhas = conferencia.itens.map((item, index) => [
    String(index + 1),
    item.plaqueta,
    item.descricao || "—",
    item.nomeUsuario || "—",
    item.cpf || "—",
    item.glpi === "SIM" ? "SIM" : "NÃO",
    item.compartilha ? "SIM" : "NÃO",
    item.nomeCompartilhado || "—",
    item.cpfCompartilhado || "—"
  ]);

  doc.autoTable({
    startY: 40,
    margin: { left: margem, right: margem },
    head: [[
      "#",
      "Plaqueta",
      "Descrição",
      "Usuário",
      "CPF",
      "GLPI",
      "Compart.",
      "2º Usuário",
      "CPF 2º"
    ]],
    body: linhas,
    styles: {
      font: "helvetica",
      fontSize: 8,
      cellPadding: 2.5,
      overflow: "linebreak",
      valign: "middle"
    },
    headStyles: {
      fontStyle: "bold"
    },
    columnStyles: {
      0: { cellWidth: 9 },
      1: { cellWidth: 23 },
      2: { cellWidth: 42 },
      3: { cellWidth: 42 },
      4: { cellWidth: 28 },
      5: { cellWidth: 18 },
      6: { cellWidth: 20 },
      7: { cellWidth: 42 },
      8: { cellWidth: 28 }
    }
  });

  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 50;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Responsável pela conferência: ________________________________________________", margem, finalY);

  return doc;
}

function criarArquivo() {
  const doc = criarPdf();
  const blob = doc.output("blob");

  return new File([blob], nomeArquivo(), {
    type: "application/pdf"
  });
}

async function compartilhar() {
  const arquivo = criarArquivo();

  try {
    if (
      navigator.share &&
      (!navigator.canShare || navigator.canShare({ files: [arquivo] }))
    ) {
      await navigator.share({
        title: "Conferência Patrimonial",
        text: `Conferência do setor ${conferencia.setor}`,
        files: [arquivo]
      });

      $("statusCompartilhar").textContent =
        "Compartilhamento do PDF aberto. Escolha o WhatsApp ou outro aplicativo.";
    } else {
      baixar(arquivo);
      $("statusCompartilhar").textContent =
        "O PDF foi baixado. Envie-o pelo WhatsApp.";
    }
  } catch (erro) {
    if (erro.name === "AbortError") {
      $("statusCompartilhar").textContent =
        "Compartilhamento cancelado. Os dados continuam salvos.";
      return;
    }

    baixar(arquivo);
    $("statusCompartilhar").textContent =
      "O compartilhamento não está disponível. O PDF foi baixado.";
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

  tela("telaSetor");
}

function continuarConferencia() {
  renderizarLista();
  tela("telaSetorAtual");
}


function textoConferencia() {
  const linhas = [
    "CONFERÊNCIA PATRIMONIAL",
    `Setor: ${conferencia.setor}`,
    `Total: ${conferencia.itens.length} patrimônio(s)`,
    "",
    ...conferencia.itens.map((item, index) => {
      const partes = [
        `${index + 1}. Plaqueta: ${item.plaqueta}`,
        `Descrição: ${item.descricao || "—"}`,
        `Usuário: ${item.nomeUsuario || "—"}`,
        `CPF: ${item.cpf || "—"}`,
        `GLPI: ${item.glpi === "SIM" ? "Instalar" : "Não instalar"}`,
        `Compartilhado: ${item.compartilha ? "Sim" : "Não"}`
      ];

      if (item.compartilha) {
        partes.push(`2º usuário: ${item.nomeCompartilhado || "—"}`);
        partes.push(`CPF 2º usuário: ${item.cpfCompartilhado || "—"}`);
      }

      return partes.join("\n");
    })
  ];

  return linhas.join("\n\n");
}

function enviarWhatsApp() {
  const texto = textoConferencia();
  const url = `https://wa.me/?text=${encodeURIComponent(texto)}`;

  window.open(url, "_blank");
}

$("btnEntrar").addEventListener("click", entrarNoSetor);
$("btnWhatsApp").addEventListener("click", enviarWhatsApp);
$("btnLer").addEventListener("click", abrirCamera);
$("btnDigitar").addEventListener("click", async () => {
  await fecharCamera();
  abrirDigitacaoManual();
});
$("btnContinuarManual").addEventListener("click", continuarDigitacaoManual);
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
$("btnFinalizar").addEventListener("click", finalizar);
$("btnCompartilhar").addEventListener("click", compartilhar);
$("btnNova").addEventListener("click", novaConferencia);
$("btnManter").addEventListener("click", continuarConferencia);

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

$("btnVoltarDados").addEventListener("click", () => {
  renderizarLista();
  tela("telaSetorAtual");
});

$("setor").addEventListener("keydown", (e) => {
  if (e.key === "Enter") entrarNoSetor();
});

$("cpf").addEventListener("input", () => {
  $("cpf").value = $("cpf").value.replace(/\D/g, "").slice(0, 11);
});

$("cpfCompartilhado").addEventListener("input", () => {
  $("cpfCompartilhado").value =
    $("cpfCompartilhado").value.replace(/\D/g, "").slice(0, 11);
});


$("compartilha").addEventListener("change", () => {
  const ativo = $("compartilha").checked;
  $("camposCompartilhado").classList.toggle("oculto", !ativo);

  if (ativo) {
    $("nomeCompartilhado").focus();
  } else {
    $("nomeCompartilhado").value = "";
    $("cpfCompartilhado").value = "";
  }
});

function mostrarRecuperacao() {
  const box = $("recuperarBox");

  if (!conferencia) {
    box.classList.add("oculto");
    return;
  }

  $("recuperarInfo").textContent =
    `Setor: ${conferencia.setor} • ${conferencia.itens.length} patrimônio(s)`;

  box.classList.remove("oculto");
}

function continuarSalva() {
  if (!conferencia) return;
  renderizarLista();
  tela("telaSetorAtual");
}

$("btnContinuarSalva").addEventListener("click", continuarSalva);

if (conferencia && conferencia.setor && Array.isArray(conferencia.itens)) {
  mostrarRecuperacao();
}
