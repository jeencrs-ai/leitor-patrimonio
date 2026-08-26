(() => {
  function adicionarBotoesPostoVazio() {
    const lista = document.getElementById("listaPostos");
    if (!lista) return;

    lista.querySelectorAll(".posto-card").forEach(card => {
      const totalEl = card.querySelector(".posto-total");
      const acoes = card.querySelector(".posto-acoes");
      if (!totalEl || !acoes) return;

      const total = Number((totalEl.textContent || "").trim());
      if (total !== 0) return;
      if (acoes.querySelector(".resgate-posto-vazio")) return;

      const rotulo = card.querySelector(".rotulo");
      const numeroTexto = rotulo ? rotulo.textContent.replace(/\D/g, "") : "";
      const numero = Number(numeroTexto);

      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "resgate-posto-vazio";
      botao.textContent = "EXCLUIR POSTO VAZIO";

      botao.addEventListener("click", () => {
        const postoEncontrado = Array.isArray(conferencia?.postos)
          ? conferencia.postos.find(p => Number(p.numero) === numero)
          : null;

        if (!postoEncontrado || postoEncontrado.itens.length !== 0) {
          alert("Este posto não está vazio.");
          return;
        }

        if (!confirm(
          `Excluir o POSTO ${String(numero).padStart(2, "0")} vazio?\n\n` +
          "Nenhum patrimônio dos outros postos será alterado."
        )) return;

        // Usa a mesma função do aplicativo, preservando o localStorage atual.
        if (typeof excluirPostoVazio === "function") {
          excluirPostoVazio(postoEncontrado.id);
          return;
        }

        // Fallback de segurança caso a função não esteja disponível.
        conferencia.postos = conferencia.postos.filter(p => p.id !== postoEncontrado.id);
        conferencia.postos.forEach((p, i) => p.numero = i + 1);

        if (typeof salvarLocal === "function") salvarLocal();
        if (typeof renderConferencia === "function") renderConferencia();
      });

      acoes.appendChild(botao);
    });
  }

  // Renderização inicial.
  adicionarBotoesPostoVazio();

  // O aplicativo recria os cards quando a conferência é atualizada.
  // O observer recoloca o botão automaticamente, sem tocar nos dados.
  const lista = document.getElementById("listaPostos");
  if (lista) {
    new MutationObserver(adicionarBotoesPostoVazio).observe(lista, {
      childList: true,
      subtree: true
    });
  }

  // Pequena garantia para renderizações que ocorram fora do observer.
  setInterval(adicionarBotoesPostoVazio, 500);
})();
