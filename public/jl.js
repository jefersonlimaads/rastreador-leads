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

  // Mesmo aparelho, visita nova: reaproveita o código em vez de gerar outro.
  var codigo = lerCookie(COOKIE);
  var codigoNovo = false;
  if (!codigo || !/^[A-Z0-9]{4,6}$/.test(codigo)) {
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
  };

  function mensagem() {
    return "Olá, vim pelo site e quero saber sobre " + SERVICO + ". [" + codigo + "]";
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

  function aoClicar() {
    if (jaRegistrado) return;
    jaRegistrado = true;
    registrar();
  }

  function preparar() {
    var alvos = document.querySelectorAll(SELETOR);
    for (var i = 0; i < alvos.length; i++) {
      var alvo = alvos[i];
      if (alvo.tagName === "A") {
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
    codigoNovo: codigoNovo,
    mensagem: mensagem,
    link: function () {
      return montarLink(null);
    },
    registrar: registrar,
  };
})();
