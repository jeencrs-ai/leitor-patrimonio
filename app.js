const CHAVE="conferencia_patrimonial_v6",BACKUP="conferencia_patrimonial_backup_v6";
const $=id=>document.getElementById(id);let conferencia=carregar(),postoAtualId=null,scanner=null,lendo=false;
const novoId=p=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
function normalizar(d){if(!d||!d.setor)return null;if(!Array.isArray(d.postos)){const r=d.responsavel||{nome:"",cpf:""};d.postos=[{id:novoId("posto"),numero:1,responsavel:r,criadoEm:d.criadoEm||new Date().toISOString(),finalizadoEm:null,itens:Array.isArray(d.itens)?d.itens:[]}]}
d.postos.forEach((p,i)=>{p.id=p.id||novoId("posto");p.numero=p.numero||i+1;p.responsavel=p.responsavel||{nome:"",cpf:""};p.responsavel.nome=p.responsavel.nome||"";p.responsavel.cpf=p.responsavel.cpf||"";p.itens=Array.isArray(p.itens)?p.itens:[];p.itens.forEach(x=>{x.id=x.id||novoId("pat");x.tipoEquipamento=x.tipoEquipamento||"CPU"})});return d}
function carregar(){try{let s=localStorage.getItem(CHAVE)||localStorage.getItem(BACKUP)||localStorage.getItem("conferencia_patrimonial_v5")||localStorage.getItem("conferencia_patrimonial_backup_v5");return s?normalizar(JSON.parse(s)):null}catch{return null}}
function salvarLocal(){if(!conferencia)return;const s=JSON.stringify(conferencia);localStorage.setItem(CHAVE,s);localStorage.setItem(BACKUP,s)}
function tela(n){["telaSetor","telaConferencia","telaPosto","telaPostoAtual","telaCamera","telaManual","telaDados","telaFinalPosto","telaFinal"].forEach(x=>$(x)?.classList.toggle("oculto",x!==n));scrollTo(0,0)}
function total(){return conferencia?conferencia.postos.reduce((a,p)=>a+p.itens.length,0):0}
function entrar(){const s=$("setor").value.trim();if(!s){$("erroSetor").textContent="Informe o setor.";return}if(conferencia){mostrarRecuperacao();$("erroSetor").textContent=`Existe uma conferência salva do setor "${conferencia.setor}".`;return}conferencia={id:novoId("conf"),setor:s,criadoEm:new Date().toISOString(),status:"EM_ANDAMENTO",finalizadoEm:null,postos:[]};salvarLocal();renderConferencia();tela("telaConferencia")}
function mostrarRecuperacao(){if(!conferencia)return;$("recuperarInfo").textContent=`Setor: ${conferencia.setor} • ${conferencia.postos.length} posto(s) • ${total()} patrimônio(s) registrado(s).`;$("recuperarBox").classList.remove("oculto")}
function renderConferencia(){if(!conferencia)return;$("nomeSetor").textContent=conferencia.setor;$("quantidadeTotal").textContent=total();$("quantidadeTotalResumo").textContent=total();$("quantidadePostos").textContent=conferencia.postos.length;const l=$("listaPostos");l.innerHTML="";$("postosVazio").classList.toggle("oculto",conferencia.postos.length!==0);[...conferencia.postos].reverse().forEach(p=>{const cpu=p.itens.filter(x=>x.tipoEquipamento==="CPU").length,mon=p.itens.filter(x=>x.tipoEquipamento==="MONITOR").length,d=document.createElement("article");d.className="posto-card";d.innerHTML=`<div class="posto-cabecalho"><div><span class="rotulo">POSTO ${String(p.numero).padStart(2,"0")}</span><h3>${esc(p.responsavel.nome||"Sem responsável")}</h3><small>${p.responsavel.cpf?`CPF: ${esc(p.responsavel.cpf)}`:"CPF não informado"}</small></div><strong class="posto-total">${p.itens.length}</strong></div><div class="posto-resumo"><span>CPU: ${cpu}</span><span>MONITORES: ${mon}</span></div><div class="posto-acoes">
  <button class="botao botao-secundario abrir-posto" type="button">${p.finalizadoEm?"VISUALIZAR POSTO":"ABRIR POSTO"}</button>
  ${p.finalizadoEm?'<button class="botao botao-editar-posto" type="button">EDITAR POSTO</button>':""}${!p.itens.length?'<button class="botao botao-remover-posto" type="button" data-posto-vazio="' + p.id + '">EXCLUIR POSTO VAZIO</button>':""}
  ${!p.itens.length?'<button class="botao botao-remover-posto" type="button">EXCLUIR POSTO VAZIO</button>':""}
</div>`; 
d.querySelector(".abrir-posto").onclick=()=>visualizarPosto(p.id);
const editarBtn=d.querySelector(".botao-editar-posto");
if(editarBtn) editarBtn.onclick=()=>abrirPosto(p.id);
const removerBtn=d.querySelector(".botao-remover-posto");
if(removerBtn) removerBtn.onclick=()=>excluirPostoVazio(p.id);
const removerBtn=d.querySelector(".botao-remover-posto");
if(removerBtn) removerBtn.onclick=()=>excluirPostoVazio(p.id);l.appendChild(d)})}
function novoPosto(){ $("numeroPosto").textContent=`POSTO ${String(conferencia.postos.length+1).padStart(2,"0")}`;$("nomeResponsavel").value="";$("cpfResponsavel").value="";$("erroPosto").textContent="";tela("telaPosto");setTimeout(()=>$("nomeResponsavel").focus(),80)}
function iniciarPosto(){const nome=$("nomeResponsavel").value.trim(),cpf=$("cpfResponsavel").value.replace(/\D/g,"").slice(0,11);if(!nome){$("erroPosto").textContent="Informe o nome do responsável.";return}const p={id:novoId("posto"),numero:conferencia.postos.length+1,responsavel:{nome,cpf},criadoEm:new Date().toISOString(),finalizadoEm:null,itens:[]};conferencia.postos.push(p);postoAtualId=p.id;salvarLocal();renderPosto();tela("telaPostoAtual")}
function excluirPostoVazio(id){
  const p=conferencia.postos.find(x=>x.id===id);
  if(!p || p.itens.length)return;
  if(!confirm(`Excluir o POSTO ${String(p.numero).padStart(2,"0")} vazio?\n\nNenhum patrimônio dos outros postos será alterado.`))return;
  conferencia.postos=conferencia.postos.filter(x=>x.id!==id);
  conferencia.postos.forEach((x,i)=>x.numero=i+1);
  salvarLocal();
  renderConferencia();
}

function visualizarPosto(id){
  const p=conferencia.postos.find(x=>x.id===id);
  if(!p)return;
  $("finalPosto").textContent=`POSTO ${String(p.numero).padStart(2,"0")}`;
  $("finalPostoResponsavel").textContent=p.responsavel.nome||"—";
  $("finalPostoCpf").textContent=p.responsavel.cpf||"Não informado";
  $("finalPostoCpu").textContent=p.itens.filter(x=>x.tipoEquipamento==="CPU").length;
  $("finalPostoMonitores").textContent=p.itens.filter(x=>x.tipoEquipamento==="MONITOR").length;
  $("finalPostoTotal").textContent=p.itens.length;
  const lista=$("listaFinalPosto");
  lista.innerHTML="";
  p.itens.forEach((x,i)=>{
    const d=document.createElement("article");d.className="item";
    d.innerHTML=`<div class="item-cabecalho"><div><div class="item-numero">#${String(i+1).padStart(2,"0")}</div><div class="item-plaqueta">${esc(x.plaqueta)}</div></div></div><div class="item-cpf">Tipo: ${esc(x.tipoEquipamento||"CPU")}</div>${x.descricao?`<div class="item-descricao">${esc(x.descricao)}</div>`:""}${x.compartilha?`<div class="item-cpf">Compartilhado com: ${esc(x.nomeCompartilhado||"—")}${x.cpfCompartilhado?` • CPF: ${esc(x.cpfCompartilhado)}`:""}</div>`:""}`;
    lista.appendChild(d);
  });
  $("btnNovoPostoDepois").classList.add("oculto");$("btnVoltarConferencia").textContent="VOLTAR PARA A CONFERÊNCIA";tela("telaFinalPosto");
}

function abrirPosto(id){
  const p=conferencia.postos.find(x=>x.id===id);
  if(!p)return;
  if(p.finalizadoEm){
    const ok=confirm(`O POSTO ${String(p.numero).padStart(2,"0")} já foi finalizado.\n\nDeseja reabrir este posto para edição?`);
    if(!ok)return;
    p.finalizadoEm=null;
    p.status="EM_EDICAO";
    conferencia.status="EM_ANDAMENTO";
    salvarLocal();
  }
  postoAtualId=id;
  renderPosto();
  tela("telaPostoAtual");
}
function posto(){return conferencia?.postos.find(x=>x.id===postoAtualId)||null}
function renderPosto(){const p=posto();if(!p)return;$("rotuloPosto").textContent=`POSTO ${String(p.numero).padStart(2,"0")}`;$("nomePostoResponsavel").textContent=p.responsavel.nome;$("cpfPostoResponsavel").textContent=p.responsavel.cpf?`CPF: ${p.responsavel.cpf}`:"CPF não informado";$("quantidadePosto").textContent=p.itens.length;const l=$("listaPatrimonios");l.innerHTML="";$("patrimoniosVazio").classList.toggle("oculto",!p.itens.length);[...p.itens].reverse().forEach((x,r)=>{const i=p.itens.length-1-r,d=document.createElement("article");d.className="item";d.innerHTML=`<div class="item-cabecalho"><div><div class="item-numero">#${String(i+1).padStart(2,"0")}</div><div class="item-plaqueta">${esc(x.plaqueta)}</div></div><button class="editar-item" type="button">EDITAR</button></div><div class="item-cpf">Tipo: ${esc(x.tipoEquipamento)}</div>${x.descricao?`<div class="item-descricao">${esc(x.descricao)}</div>`:""}${x.compartilha?`<div class="item-cpf">Compartilhado com: ${esc(x.nomeCompartilhado)}${x.cpfCompartilhado?` • CPF: ${esc(x.cpfCompartilhado)}`:""}</div>`:""}`;d.querySelector("button").onclick=()=>editar(i);l.appendChild(d)})}
function esc(v){return String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
async function abrirCamera(){await fecharCamera();tela("telaCamera");$("setorCamera").textContent=conferencia.setor;$("statusCamera").textContent="Abrindo câmera...";try{scanner=new Html5Qrcode("reader");await scanner.start({facingMode:"environment"},{fps:10,qrbox:{width:280,height:120}},async c=>{if(!lendo)return;lendo=false;await fecharCamera();formulario(c)},()=>{});lendo=true;$("statusCamera").textContent="Aponte para o código de barras ou digite o código."}catch(e){scanner=null;lendo=false;$("statusCamera").textContent="Não foi possível abrir a câmera. Digite o código manualmente."}}
async function fecharCamera(){lendo=false;if(scanner){try{await scanner.stop()}catch{}try{scanner.clear()}catch{}scanner=null}if($("reader"))$("reader").innerHTML=""}
function manual(){ $("codigoManual").value="";$("erroManual").textContent="";tela("telaManual");setTimeout(()=>$("codigoManual").focus(),80)}
function continuarManual(){const c=$("codigoManual").value.trim();if(!c){$("erroManual").textContent="Digite o código da plaqueta.";return}formulario(c)}
function tipo(t){$("tipoEquipamento").value=t;$("tipoCpu").classList.toggle("selecionado",t==="CPU");$("tipoMonitor").classList.toggle("selecionado",t==="MONITOR")}
function formulario(c){$("plaquetaLida").textContent=String(c).trim()||"—";$("plaquetaEditavel").value=String(c).trim();$("plaquetaLida").classList.remove("oculto");$("plaquetaEditavel").classList.add("oculto");$("descricao").value="";tipo("CPU");$("compartilha").checked=false;$("nomeCompartilhado").value="";$("cpfCompartilhado").value="";$("camposCompartilhado").classList.add("oculto");mostrarErroDados("");delete $("btnSalvar").dataset.editIndex;$("btnSalvar").textContent="SALVAR PATRIMÔNIO";tela("telaDados")}
function editar(i){const p=posto(),x=p?.itens[i];if(!x)return;$("plaquetaLida").textContent=x.plaqueta;$("plaquetaEditavel").value=x.plaqueta;$("plaquetaLida").classList.add("oculto");$("plaquetaEditavel").classList.remove("oculto");$("descricao").value=x.descricao||"";tipo(x.tipoEquipamento||"CPU");$("compartilha").checked=!!x.compartilha;$("nomeCompartilhado").value=x.nomeCompartilhado||"";$("cpfCompartilhado").value=x.cpfCompartilhado||"";$("camposCompartilhado").classList.toggle("oculto",!x.compartilha);mostrarErroDados("");$("btnSalvar").dataset.editIndex=i;$("btnSalvar").textContent="SALVAR ALTERAÇÕES";tela("telaDados")}
function mostrarErroDados(mensagem){
  const box=$("erroDados");
  if(!box)return;
  const texto=$("erroDadosTexto");
  if(texto)texto.textContent=mensagem;
  box.classList.toggle("oculto",!mensagem);
}
function salvarPatrimonio(){const p=posto();if(!p)return;const editando=$("btnSalvar").dataset.editIndex!==undefined;const pl=(editando?$("plaquetaEditavel").value:$("plaquetaLida").textContent).trim(),desc=$("descricao").value.trim(),t=$("tipoEquipamento").value,comp=$("compartilha").checked,nome2=$("nomeCompartilhado").value.trim(),cpf2=$("cpfCompartilhado").value.replace(/\D/g,"").slice(0,11);if(!pl||pl==="—"){mostrarErroDados("A plaqueta é obrigatória.");return}if(comp&&!nome2){mostrarErroDados("Informe o nome do segundo usuário.");return}const raw=$("btnSalvar").dataset.editIndex,edit=raw!==undefined,i=edit?Number(raw):-1;if(p.itens.some((x,n)=>n!==i&&x.plaqueta.toLowerCase()===pl.toLowerCase())){mostrarErroDados(`A plaqueta ${pl} já foi registrada neste posto.`);return}const cpf=(p.responsavel.cpf||"").replace(/\D/g,"");if(t==="CPU"&&cpf){const outra=p.itens.find((x,n)=>n!==i&&x.tipoEquipamento==="CPU"&&(x.cpf||"").replace(/\D/g,"")===cpf);if(outra){mostrarErroDados(`Este CPF já possui uma CPU neste posto: ${outra.plaqueta}.`);return}}const x={id:edit?p.itens[i].id:novoId("pat"),plaqueta:pl,descricao:desc,tipoEquipamento:t,responsavelNome:p.responsavel.nome,cpf,compartilha:comp,nomeCompartilhado:comp?nome2:"",cpfCompartilhado:comp?cpf2:"",dataHora:edit?p.itens[i].dataHora:new Date().toISOString()};if(edit)p.itens[i]=x;else p.itens.push(x);delete $("btnSalvar").dataset.editIndex;$("btnSalvar").textContent="SALVAR PATRIMÔNIO";$("plaquetaLida").classList.remove("oculto");$("plaquetaEditavel").classList.add("oculto");salvarLocal();renderPosto();tela("telaPostoAtual")}
function finalizarPosto(){
  $("btnNovoPostoDepois").classList.remove("oculto");
const p=posto();if(!p)return;if(!p.itens.length){alert("Nenhuma plaqueta foi registrada neste posto.");return}if(!p.itens.some(x=>x.tipoEquipamento==="CPU")&&!confirm("Este posto não possui CPU. Deseja finalizá-lo mesmo assim?"))return;p.finalizadoEm=new Date().toISOString();salvarLocal();$("finalPosto").textContent=`POSTO ${String(p.numero).padStart(2,"0")}`;$("finalPostoResponsavel").textContent=p.responsavel.nome;$("finalPostoCpf").textContent=p.responsavel.cpf||"Não informado";$("finalPostoCpu").textContent=p.itens.filter(x=>x.tipoEquipamento==="CPU").length;$("finalPostoMonitores").textContent=p.itens.filter(x=>x.tipoEquipamento==="MONITOR").length;$("finalPostoTotal").textContent=p.itens.length;tela("telaFinalPosto")}
function finalizar(){if(!conferencia.postos.length){alert("Nenhum posto foi criado.");return}const vazios=conferencia.postos.filter(p=>!p.itens.length);
if(vazios.length){
  const nomes=vazios.map(p=>`POSTO ${String(p.numero).padStart(2,"0")}`).join(", ");
  const ok=confirm(`${nomes} ${vazios.length===1?"está":"estão"} sem patrimônio.\n\nDeseja excluir ${vazios.length===1?"este posto vazio":"estes postos vazios"} e finalizar a conferência?`);
  if(!ok)return;
  conferencia.postos=conferencia.postos.filter(p=>p.itens.length);
  conferencia.postos.forEach((p,i)=>p.numero=i+1);
  if(!conferencia.postos.length){alert("Não há nenhum posto com patrimônio para finalizar.");salvarLocal();renderConferencia();return;}
  salvarLocal();
}conferencia.status="FINALIZADA";conferencia.finalizadoEm=new Date().toISOString();salvarLocal();$("finalSetor").textContent=conferencia.setor;$("finalPostos").textContent=conferencia.postos.length;$("finalQuantidade").textContent=total();tela("telaFinal")}
function texto(){const a=["CONFERÊNCIA PATRIMONIAL",`Setor: ${conferencia.setor}`,`Postos: ${conferencia.postos.length}`,`Total: ${total()}`,""];conferencia.postos.forEach(p=>{a.push(`POSTO ${String(p.numero).padStart(2,"0")}`,`Responsável: ${p.responsavel.nome}`,`CPF: ${p.responsavel.cpf||"Não informado"}`,"");p.itens.forEach((x,i)=>{a.push(`${i+1}. Plaqueta: ${x.plaqueta}`,`Tipo: ${x.tipoEquipamento}`,`Descrição: ${x.descricao||"—"}`);if(x.compartilha)a.push(`Compartilhado com: ${x.nomeCompartilhado}`,`CPF: ${x.cpfCompartilhado||"Não informado"}`);a.push("")})});return a.join("\n")}
function whatsapp(){open(`https://wa.me/?text=${encodeURIComponent(texto())}`,"_blank")}
function excel(){const s=conferencia.setor.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9]+/g,"_").replace(/^_+|_+$/g,""),rows=[["CONFERÊNCIA PATRIMONIAL"],["Setor",conferencia.setor],["Postos",conferencia.postos.length],["Total",total()],[],["Posto","Responsável","CPF","Plaqueta","Tipo","Descrição","Compartilhado","2º Usuário","CPF 2º Usuário","Data/Hora"]];conferencia.postos.forEach(p=>p.itens.forEach(x=>rows.push([String(p.numero).padStart(2,"0"),p.responsavel.nome,p.responsavel.cpf,x.plaqueta,x.tipoEquipamento,x.descricao||"",x.compartilha?"SIM":"NÃO",x.nomeCompartilhado||"",x.cpfCompartilhado||"",new Date(x.dataHora).toLocaleString("pt-BR")])));const ws=XLSX.utils.aoa_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Conferência");const b=new Blob([XLSX.write(wb,{bookType:"xlsx",type:"array"})],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),f=new File([b],`conferencia_${s||"setor"}_${new Date().toISOString().slice(0,10)}.xlsx`,{type:b.type});return f}
async function compartilhar(){const f=excel();try{if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[f]}))){await navigator.share({title:"Conferência Patrimonial",files:[f]})}else{baixar(f)}}catch(e){if(e.name!=="AbortError")baixar(f)}}
function baixar(f){const u=URL.createObjectURL(f),a=document.createElement("a");a.href=u;a.download=f.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)}
function nova(){if(!confirm("A conferência atual será apagada deste celular. Você já enviou o arquivo?"))return;localStorage.removeItem(CHAVE);localStorage.removeItem(BACKUP);localStorage.removeItem("conferencia_patrimonial_v5");localStorage.removeItem("conferencia_patrimonial_backup_v5");conferencia=null;postoAtualId=null;tela("telaSetor")}
$("btnEntrar").onclick=entrar;$("btnContinuarSalva").onclick=()=>{renderConferencia();tela("telaConferencia")};$("btnNovoPosto").onclick=novoPosto;$("btnVoltarPosto").onclick=()=>{renderConferencia();tela("telaConferencia")};$("btnIniciarPosto").onclick=iniciarPosto;$("cpfResponsavel").oninput=()=>$("cpfResponsavel").value=$("cpfResponsavel").value.replace(/\D/g,"").slice(0,11);$("btnLer").onclick=abrirCamera;$("btnDigitarPosto").onclick=manual;$("btnDigitar").onclick=async()=>{await fecharCamera();manual()};$("btnVoltarCamera").onclick=async()=>{await fecharCamera();renderPosto();tela("telaPostoAtual")};$("btnCancelarCamera").onclick=async()=>{await fecharCamera();renderPosto();tela("telaPostoAtual")};$("btnContinuarManual").onclick=continuarManual;$("btnVoltarManual").onclick=()=>{renderPosto();tela("telaPostoAtual")};$("codigoManual").onkeydown=e=>{if(e.key==="Enter")continuarManual()};$("tipoCpu").onclick=()=>tipo("CPU");$("tipoMonitor").onclick=()=>tipo("MONITOR");$("btnSalvar").onclick=salvarPatrimonio;$("btnVoltarDados").onclick=()=>{delete $("btnSalvar").dataset.editIndex;$("plaquetaLida").classList.remove("oculto");$("plaquetaEditavel").classList.add("oculto");renderPosto();tela("telaPostoAtual")};$("compartilha").onchange=()=>{$("camposCompartilhado").classList.toggle("oculto",!$("compartilha").checked)};$("cpfCompartilhado").oninput=()=>$("cpfCompartilhado").value=$("cpfCompartilhado").value.replace(/\D/g,"").slice(0,11);$("btnFinalizarPosto").onclick=finalizarPosto;$("btnNovoPostoDepois").onclick=()=>{renderConferencia();novoPosto()};$("btnVoltarConferencia").onclick=()=>{renderConferencia();tela("telaConferencia")};$("btnFinalizar").onclick=finalizar;$("btnWhatsApp").onclick=whatsapp;$("btnCompartilhar").onclick=compartilhar;$("btnNova").onclick=nova;$("btnManter").onclick=()=>{renderConferencia();tela("telaConferencia")};$("setor").onkeydown=e=>{if(e.key==="Enter")entrar()};
if(conferencia)mostrarRecuperacao();
