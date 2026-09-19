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
 * mensagem e registra o clique sem travar o redirecionamento. Em página com
 * formulário antes do WhatsApp, registra no envio (com nome e telefone
 * digitados) e põe o código na mensagem que a própria página abrir.
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
    nomeVisitante: null,
    telefoneVisitante: null,
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

  /*
   * Nome e telefone que a pessoa digitou na própria landing page.
   *
   * Procura primeiro o que o instalador marcou (data-jl-nome, data-jl-telefone)
   * e, se não houver marcação, adivinha pelo name, id ou placeholder do campo —
   * é o que a maioria das páginas usa. Nada é enviado antes do clique no botão
   * de WhatsApp: quem não clica não vira registro.
   */
  function valorDoCampo(marcado, padrao, tipo) {
    var campo = document.querySelector("[" + marcado + "]");
    if (campo && campo.value) return limpar(campo.value);

    var candidatos = document.querySelectorAll("input" + (tipo ? "[type='" + tipo + "']" : ""));
    for (var i = 0; i < candidatos.length; i++) {
      var c = candidatos[i];
      var pistas = ((c.name || "") + " " + (c.id || "") + " " + (c.placeholder || "")).toLowerCase();
      if (padrao.test(pistas) && c.value) return limpar(c.value);
    }
    return null;
  }

  function nomeDoVisitante() {
    return valorDoCampo("data-jl-nome", /\bnome\b|\bname\b|seu nome/, null);
  }

  function telefoneDoVisitante() {
    var porTipo = valorDoCampo("data-jl-telefone", /telefone|celular|whats|fone|phone|tel\b/, "tel");
    if (porTipo) return porTipo;
    return valorDoCampo("data-jl-telefone", /telefone|celular|whats|fone|phone|tel\b/, null);
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
    dados.nomeVisitante = nomeDoVisitante();
    dados.telefoneVisitante = telefoneDoVisitante();
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

  /*
   * Formulário antes do WhatsApp: a pessoa preenche nome e telefone, envia, e a
   * própria página abre o WhatsApp. Não há link para tocar, então o registro
   * acontece no envio do formulário — com o que ela digitou.
   *
   * Só conta formulário que pede telefone (ou marcado com data-jl-form), para
   * não registrar busca, newsletter ou login como contato.
   */
  var CAMPO_TELEFONE =
    'input[type="tel"], [data-jl-telefone], input[name*="tel" i], input[name*="whats" i], ' +
    'input[name*="fone" i], input[name*="phone" i], input[name*="celular" i], input[placeholder*="whats" i]';

  function interesseDoFormulario(form) {
    var escolhido = form.querySelector("select");
    if (escolhido && escolhido.selectedIndex > 0) {
      var op = escolhido.options[escolhido.selectedIndex];
      if (op && op.value) return limpar(op.textContent);
    }
    var marcado = form.querySelector('input[type="radio"]:checked');
    if (marcado) {
      var rotulo = marcado.closest("label") || form.querySelector('label[for="' + marcado.id + '"]');
      return limpar(rotulo ? rotulo.textContent : marcado.value);
    }
    return null;
  }

  document.addEventListener(
    "submit",
    function (evento) {
      var form = evento.target;
      if (!form || form.tagName !== "FORM" || form.hasAttribute("data-jl-ignorar")) return;
      if (!form.hasAttribute("data-jl-form") && !form.querySelector(CAMPO_TELEFONE)) return;
      if (jaRegistrado) return;
      jaRegistrado = true;
      var botao = evento.submitter || null;
      dados.interesse =
        (botao && botao.getAttribute("data-jl-servico")) ||
        interesseDoCampo() ||
        interesseDoFormulario(form) ||
        descobrirInteresse(null);
      dados.nomeVisitante = nomeDoVisitante();
      dados.telefoneVisitante = telefoneDoVisitante();
      registrar();
    },
    true,
  );

  /*
   * A página que abre o WhatsApp sozinha depois do envio monta a própria
   * mensagem ("Olá, sou a Ana..."). Ela é mantida, e o código vai no fim,
   * entre colchetes, para o lead chegar já atribuído ao anúncio.
   */
  var WHATSAPP = /^(https?:\/\/)?(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\/|^whatsapp:\/\//i;

  function comCodigo(url) {
    try {
      var u = new URL(url, window.location.href);
      var texto = u.searchParams.get("text") || "";
      if (texto.indexOf("[" + codigo + "]") !== -1) return url;
      texto = (texto ? texto + " " : mensagem().replace(/ \[[A-Z0-9]+\]$/, " ")) + "[" + codigo + "]";
      u.searchParams.delete("text");
      // Montado à mão: searchParams troca espaço por "+", e o WhatsApp mostra o "+".
      var resto = u.search ? u.search + "&" : "?";
      // Base tirada do texto original: em "whatsapp://" o navegador não tem origin.
      return url.split(/[?#]/)[0] + resto + "text=" + encodeURIComponent(texto) + u.hash;
    } catch (e) {
      return url;
    }
  }

  function aoAbrirWhatsapp() {
    if (jaRegistrado) return;
    jaRegistrado = true;
    dados.interesse = interesseDoCampo() || dados.interesse;
    dados.nomeVisitante = nomeDoVisitante();
    dados.telefoneVisitante = telefoneDoVisitante();
    registrar();
  }

  // window.open("https://wa.me/...") — o jeito mais comum depois do envio.
  var abrirOriginal = window.open;
  window.open = function (url) {
    if (typeof url === "string" && WHATSAPP.test(url)) {
      aoAbrirWhatsapp();
      arguments[0] = comCodigo(url);
    }
    return abrirOriginal.apply(window, arguments);
  };

  // location.href = "https://wa.me/..." — só dá para ver onde o navegador
  // oferece a Navigation API (Chrome, Android). Nos outros, o envio do
  // formulário já registrou o contato; só a mensagem sai sem o código.
  if (window.navigation && window.navigation.addEventListener) {
    window.navigation.addEventListener("navigate", function (evento) {
      var destino = evento.destination && evento.destination.url;
      if (!destino || !WHATSAPP.test(destino) || destino.indexOf("%5B" + codigo + "%5D") !== -1) return;
      if (!evento.cancelable) return;
      evento.preventDefault();
      aoAbrirWhatsapp();
      window.location.href = comCodigo(destino);
    });
  }

  window.jlAds = {
    codigo: codigo,
    interesse: function () {
      return dados.interesse;
    },
    identificacao: function () {
      return { nome: nomeDoVisitante(), telefone: telefoneDoVisitante() };
    },
    codigoNovo: codigoNovo,
    mensagem: mensagem,
    link: function () {
      return montarLink(null);
    },
    registrar: registrar,
  };
})();
