/*!
 * Rastreamento JL Ads — script da landing page.
 *
 * Instalação, antes de </body>:
 *   <script async src="https://SEU-DOMINIO/jl.js"
 *           data-cliente="ID_DO_CLIENTE"
 *           data-numero="5511999999999"
 *           data-servico="orçamento"></script>
 *
 * Ele gera o código curto, monta o link do wa.me com o código dentro da
 * mensagem e registra o clique sem travar o redirecionamento.
 */
(function () {
  "use strict";

  var script = document.currentScript;
  if (!script) return;

  var CLIENTE = script.getAttribute("data-cliente");
  var NUMERO = (script.getAttribute("data-numero") || "").replace(/\D/g, "");
  var SERVICO = script.getAttribute("data-servico") || "os serviços";
  var SELETOR = script.getAttribute("data-seletor") || '[data-jl-whatsapp], a[href*="wa.me"], a[href*="api.whatsapp.com"]';
  var BASE = new URL(script.src).origin;
  var COOKIE = "jl_codigo";
  var ALFABETO = "ACDEFGHJKMNPQRTUVWXY34679";

  if (!CLIENTE) return;

  function lerCookie(nome) {
    var partes = document.cookie.split("; ");
    for (var i = 0; i < partes.length; i++) {
      var p = partes[i].split("=");
      if (p[0] === nome) return decodeURIComponent(p.slice(1).join("="));
    }
    return null;
  }

  function gravarCookie(nome, valor, dias) {
    var d = new Date();
    d.setTime(d.getTime() + dias * 864e5);
    document.cookie =
      nome + "=" + encodeURIComponent(valor) + ";expires=" + d.toUTCString() + ";path=/;SameSite=Lax";
  }

  function gerarCodigo() {
    var bytes = new Uint8Array(5);
    (window.crypto || window.msCrypto).getRandomValues(bytes);
    var codigo = "";
    for (var i = 0; i < bytes.length; i++) {
      codigo += ALFABETO[bytes[i] % ALFABETO.length];
    }
    return codigo;
  }

  var params = new URLSearchParams(window.location.search);

  function param(nome) {
    return params.get(nome) || null;
  }

  // Sem Pixel na página o cookie _fbc não existe: montamos a partir do fbclid.
  function montarFbc(fbclid) {
    if (!fbclid) return lerCookie("_fbc");
    var existente = lerCookie("_fbc");
    if (existente) return existente;
    return "fb.1." + Date.now() + "." + fbclid;
  }

  /*
   * Quando gerar código novo e quando reaproveitar o do cookie.
   *
   * Chegou com marca de anúncio na URL (fbclid, ad_id, utm) = clique novo,
   * possivelmente de outro anúncio: precisa de código próprio, senão a pessoa
   * que volta pelo anúncio B seria atribuída ao anúncio A da semana passada.
   *
   * Chegou sem marca nenhuma = a mesma pessoa voltando direto ao site: aí sim
   * reaproveita o código, que é o caso para o qual o cookie existe.
   */
  var veioDeAnuncio = Boolean(
    param("fbclid") || param("ad_id") || param("utm_ad_id") || param("utm_source")
  );

  var codigo = lerCookie(COOKIE);
  var codigoNovo = false;
  if (veioDeAnuncio || !codigo || !/^[A-Z0-9]{4,6}$/.test(codigo)) {
    codigo = gerarCodigo();
    codigoNovo = true;
  }
  gravarCookie(COOKIE, codigo, 90);

  var dados = {
    clienteId: CLIENTE,
    codigo: codigo,
    utmSource: param("utm_source"),
    utmMedium: param("utm_medium"),
    utmCampaign: param("utm_campaign"),
    utmContent: param("utm_content"),
    utmTerm: param("utm_term"),
    campaignId: param("campaign_id") || param("utm_campaign_id"),
    adsetId: param("adset_id") || param("utm_adset_id"),
    adId: param("ad_id") || param("utm_ad_id"),
    fbclid: param("fbclid"),
    fbp: lerCookie("_fbp"),
    fbc: montarFbc(param("fbclid")),
    url: window.location.href,
    interesse: null,
  };

  /*
   * O que a pessoa escolheu, para quem atende reconhecer de quem se trata.
   * Ordem de procura, da mais confiável para a menos:
   *   1. data-jl-servico no próprio botão clicado
   *   2. campo marcado com data-jl-interesse (select, radio ou input)
   *   3. parâmetro servico ou interesse na URL
   *   4. o texto do botão, quando ele diz algo além de "Falar no WhatsApp"
   *   5. o data-servico do script, que vale para a página inteira
   */
  var GENERICOS = /^(falar|fale|chamar|clique|clicar|enviar|whatsapp|whats|contato|saiba mais|quero)/i;

  function limpar(texto) {
    return (texto || "").replace(/\s+/g, " ").trim().slice(0, 80);
  }

  function interesseDoCampo() {
    var campos = document.querySelectorAll("[data-jl-interesse]");
    for (var i = 0; i < campos.length; i++) {
      var campo = campos[i];
      if (campo.tagName === "SELECT") {
        var op = campo.options[campo.selectedIndex];
        if (op && op.value) return limpar(op.textContent);
      } else if (campo.type === "radio" || campo.type === "checkbox") {
        if (campo.checked) {
          var rotulo = campo.closest("label");
          return limpar(rotulo ? rotulo.textContent : campo.value);
        }
      } else if (campo.value) {
        return limpar(campo.value);
      }
    }
    return null;
  }

  function descobrirInteresse(alvo) {
    if (alvo) {
      var proprio = alvo.getAttribute("data-jl-servico");
      if (proprio) return limpar(proprio);
    }

    var doCampo = interesseDoCampo();
    if (doCampo) return doCampo;

    var daUrl = param("servico") || param("interesse");
    if (daUrl) return limpar(daUrl);

    if (alvo) {
      var texto = limpar(alvo.textContent);
      if (texto && !GENERICOS.test(texto)) return texto;
    }

    return SERVICO !== "os serviços" ? SERVICO : null;
  }

  function mensagem() {
    var assunto = dados.interesse || SERVICO;
    return "Olá, vim pelo site e quero saber sobre " + assunto + ". [" + codigo + "]";
  }

  function montarLink(href) {
    var numero = NUMERO;
    if (!numero && href) {
      var achado = href.match(/(?:wa\.me\/|phone=)(\d+)/);
      if (achado) numero = achado[1];
    }
    if (!numero) return href;
    return "https://wa.me/" + numero + "?text=" + encodeURIComponent(mensagem());
  }

  /**
   * Envia o registro sem bloquear a navegação. Se o servidor estiver fora do ar,
   * a pessoa segue para o WhatsApp com o código do mesmo jeito.
   */
  function registrar() {
    var corpo = JSON.stringify(dados);
    try {
      if (navigator.sendBeacon) {
        // text/plain evita preflight de CORS.
        navigator.sendBeacon(BASE + "/api/clique", new Blob([corpo], { type: "text/plain" }));
        return;
      }
    } catch (e) {
      /* cai no fetch */
    }
    try {
      fetch(BASE + "/api/clique", {
        method: "POST",
        body: corpo,
        headers: { "Content-Type": "text/plain" },
        keepalive: true,
        mode: "cors",
      });
    } catch (e) {
      /* clique perdido: o código ainda chega pela mensagem */
    }
  }

  var jaRegistrado = false;

  function aoClicar(evento) {
    if (jaRegistrado) return;
    jaRegistrado = true;
    dados.interesse = descobrirInteresse(evento && evento.currentTarget);
    registrar();
  }

  function preparar() {
    var alvos = document.querySelectorAll(SELETOR);
    for (var i = 0; i < alvos.length; i++) {
      var alvo = alvos[i];
      if (alvo.tagName === "A") {
        // O texto do botão entra na mensagem: cada botão da página pode falar
        // de um serviço diferente.
        dados.interesse = descobrirInteresse(alvo);
        alvo.href = montarLink(alvo.getAttribute("href"));
      }
      alvo.addEventListener("click", aoClicar, { passive: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", preparar);
  } else {
    preparar();
  }

  // Botão inserido depois (pop-up, carrossel, formulário em etapas).
  if (window.MutationObserver) {
    new MutationObserver(function () {
      preparar();
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  window.jlAds = {
    codigo: codigo,
    interesse: function () {
      return dados.interesse;
    },
    codigoNovo: codigoNovo,
    mensagem: mensagem,
    link: function () {
      return montarLink(null);
    },
    registrar: registrar,
  };
})();
