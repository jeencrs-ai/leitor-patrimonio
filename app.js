const CHAVE = "conferencia_patrimonial_v2";

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
  localStorage.setItem(CHAVE, JSON.stringify(conferencia));
}

function tela(nome) {
  const telas = ["telaSetor", "telaSetorAtual", "telaCamera", "telaDados", "telaFinal"];
  telas.forEach((id) => $(id).classList.toggle("oculto", id !== nome));
  window.scrollTo(0, 0);
}

function entrarNoSetor() {
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
      <div class="item-plaqueta">${escapar(item.plaqueta)}</div>
      ${item.descricao ? `<div class="item-descricao">${escapar(item.descricao)}</div>` : ""}
      ${item.cpf ? `<div class="item-cpf">CPF: ${escapar(item.cpf)}</div>` : ""}
      <div class="item-cpf">GLPI: ${item.glpi === "SIM" ? "Instalar" : "Não instalar"}</div>
      ${item.compartilha ? `<div class="item-cpf">Compartilhado • CPF: ${escapar(item.cpfCompartilhado)}</div>` : ""}
    `;

    lista.appendChild(div);
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

function abrirFormulario(codigo) {
  $("plaquetaLida").textContent = codigo;
  $("descricao").value = "";
  $("cpf").value = "";
  $("glpi").value = "NAO";
  $("compartilha").checked = false;
  $("cpfCompartilhado").value = "";
  $("campoCpfCompartilhado").classList.add("oculto");
  $("erroDados").textContent = "";

  tela("telaDados");
}

function salvarPatrimonio() {
  const plaqueta = $("plaquetaLida").textContent.trim();
  const descricao = $("descricao").value.trim();
  const cpf = $("cpf").value.trim();
  const glpi = $("glpi").value;
  const compartilha = $("compartilha").checked;
  const cpfCompartilhado = $("cpfCompartilhado").value.trim();

  if (!plaqueta || plaqueta === "—") {
    $("erroDados").textContent = "A plaqueta é obrigatória.";
    return;
  }

  if (compartilha && !cpfCompartilhado) {
    $("erroDados").textContent = "Informe o CPF do usuário que compartilha o computador.";
    $("cpfCompartilhado").focus();
    return;
  }

  const duplicada = conferencia.itens.some(
    (item) => item.plaqueta.toLowerCase() === plaqueta.toLowerCase()
  );

  if (duplicada) {
    $("erroDados").textContent =
      `A plaqueta ${plaqueta} já foi registrada neste setor.`;
    return;
  }

  conferencia.itens.push({
    plaqueta,
    descricao,
    cpf,
    glpi,
    compartilha,
    cpfCompartilhado: compartilha ? cpfCompartilhado : "",
    dataHora: new Date().toISOString()
  });

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

function csv() {
  const linhas = [
    ["Setor", "Plaqueta", "Descrição", "CPF", "Instalar GLPI", "Computador Compartilhado", "CPF Compartilhado", "Data/Hora"],
    ...conferencia.itens.map((item) => [
      conferencia.setor,
      item.plaqueta,
      item.descricao,
      item.cpf,
      item.glpi === "SIM" ? "SIM" : "NAO",
      item.compartilha ? "SIM" : "NAO",
      item.cpfCompartilhado || "",
      new Date(item.dataHora).toLocaleString("pt-BR")
    ])
  ];

  return linhas
    .map((linha) =>
      linha.map((valor) => `"${String(valor ?? "").replaceAll('"', '""')}"`).join(";")
    )
    .join("\r\n");
}

function arquivoCsv() {
  const texto = "\ufeff" + csv();
  const blob = new Blob([texto], { type: "text/csv;charset=utf-8" });

  return new File(
    [blob],
    nomeArquivo(),
    { type: "text/csv;charset=utf-8" }
  );
}

function nomeArquivo() {
  const setor = conferencia.setor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `conferencia_${setor}_${new Date().toISOString().slice(0, 10)}.csv`;
}

async function compartilhar() {
  const arquivo = arquivoCsv();

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
        "Compartilhamento aberto. Escolha o WhatsApp ou outro aplicativo.";
    } else {
      baixar(arquivo);
      $("statusCompartilhar").textContent =
        "O arquivo foi baixado. Envie-o pelo WhatsApp.";
    }
  } catch (erro) {
    if (erro.name === "AbortError") {
      $("statusCompartilhar").textContent =
        "Compartilhamento cancelado. Os dados continuam salvos.";
      return;
    }

    baixar(arquivo);
    $("statusCompartilhar").textContent =
      "O compartilhamento não está disponível. O arquivo foi baixado.";
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
  conferencia = null;

  $("setor").value = "";
  $("erroSetor").textContent = "";

  tela("telaSetor");
}

function continuarConferencia() {
  renderizarLista();
  tela("telaSetorAtual");
}

$("btnEntrar").addEventListener("click", entrarNoSetor);
$("btnLer").addEventListener("click", abrirCamera);
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

$("compartilha").addEventListener("change", () => {
  const ativo = $("compartilha").checked;
  $("campoCpfCompartilhado").classList.toggle("oculto", !ativo);

  if (ativo) {
    $("cpfCompartilhado").focus();
  } else {
    $("cpfCompartilhado").value = "";
  }
});

$("cpfCompartilhado").addEventListener("input", () => {
  $("cpfCompartilhado").value =
    $("cpfCompartilhado").value.replace(/\D/g, "").slice(0, 11);
});

if (conferencia && conferencia.setor && Array.isArray(conferencia.itens)) {
  const continuar = confirm(
    `Existe uma conferência do setor "${conferencia.setor}" com ${conferencia.itens.length} patrimônio(s).\\n\\nOK = continuar\\nCancelar = iniciar nova`
  );

  if (continuar) {
    continuarConferencia();
  } else {
    localStorage.removeItem(CHAVE);
    conferencia = null;
  }
}
