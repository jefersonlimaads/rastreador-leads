import "server-only";
import { prisma } from "../prisma";
import { hashSha256 } from "../telefone";
import { decifrar } from "../cripto";
import type { TipoEnvioCapi } from "@prisma/client";

/**
 * Versão da Graph API. A atual é a v26.0 (julho de 2026), e cada versão fica de
 * pé por cerca de dois anos. Dá para trocar por variável de ambiente sem mexer
 * no código quando a próxima sair.
 */
const VERSAO_API = process.env.META_API_VERSION ?? "v26.0";

/** O Meta recusa a requisição inteira se o evento tiver mais de 7 dias. */
const JANELA_DIAS = 7;

type Params = { leadId: string; tipo: TipoEnvioCapi; valor?: number };

/**
 * Monta o evento, grava em envios_capi e tenta enviar. O registro nasce antes do
 * envio de propósito: se o Meta responder erro, fica a linha com a resposta para
 * auditoria e reenvio. Nada falha silenciosamente, e o cadastro do lead nunca
 * quebra por causa do Meta.
 */
export async function enfileirarEventoCapi({ leadId, tipo, valor }: Params) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { cliente: true, clique: true },
  });
  if (!lead) return null;

  const eventId = `${tipo.toLowerCase()}_${lead.id}`;

  // Deduplicação: o mesmo lead não gera dois eventos do mesmo tipo.
  const jaExiste = await prisma.envioCapi.findUnique({ where: { eventId } });
  if (jaExiste?.statusResposta === 200) return jaExiste;

  const agora = Math.floor(Date.now() / 1000);
  const quando = Math.floor(
    (tipo === "LEAD" ? lead.mensagemEm.getTime() : (lead.fechadoEm ?? new Date()).getTime()) / 1000,
  );
  const limite = agora - JANELA_DIAS * 24 * 60 * 60;
  // Fora da janela de 7 dias o Meta recusa a requisição inteira. Mandamos com a
  // hora atual e registramos o ajuste, em vez de perder o evento em silêncio.
  const forcado = quando < limite;

  /*
   * Lead cadastrado mais de 7 dias depois da mensagem é histórico (lançamento
   * dos leads antigos de um cliente novo, por exemplo). Mandar com a hora de
   * agora diria ao Meta que é um lead de hoje e bagunçaria a otimização da
   * campanha. Fica registrado como não enviado, com o motivo.
   */
  if (tipo === "LEAD" && forcado) {
    return prisma.envioCapi.upsert({
      where: { eventId },
      update: {},
      create: {
        clienteId: lead.clienteId,
        leadId: lead.id,
        eventId,
        tipo,
        payload: {},
        tentativas: 5,
        resposta: "Mensagem com mais de 7 dias: lead histórico, não enviado ao Meta",
      },
    });
  }
  const eventTime = forcado ? agora : quando;

  /*
   * event_source_url é obrigatório para evento de site e precisa bater com o
   * domínio verificado. O lead sem clique ligado não tem URL própria, então
   * usamos a landing page onde os cliques deste cliente acontecem.
   */
  let origem = lead.clique?.url ?? null;
  if (!origem) {
    const ultimo = await prisma.clique.findFirst({
      where: { clienteId: lead.clienteId, url: { not: null } },
      orderBy: { criadoEm: "desc" },
      select: { url: true },
    });
    origem = ultimo?.url ?? null;
  }

  const payload = {
    data: [
      {
        event_name: tipo === "LEAD" ? "Lead" : "Purchase",
        event_time: eventTime,
        event_id: eventId,
        action_source: "website",
        event_source_url: origem ?? undefined,
        user_data: {
          // Sem telefone o Meta ainda casa pelo fbc e pelo fbp do clique.
          ph: lead.telefone ? [await hashSha256(lead.telefone)] : undefined,
          fbc: lead.clique?.fbc ?? undefined,
          fbp: lead.clique?.fbp ?? undefined,
          client_ip_address: lead.clique?.ip ?? undefined,
          client_user_agent: lead.clique?.userAgent ?? undefined,
        },
        custom_data:
          tipo === "PURCHASE"
            ? { value: valor ?? Number(lead.valorVenda ?? 0), currency: "BRL" }
            : undefined,
      },
    ],
  };

  const envio = await prisma.envioCapi.upsert({
    where: { eventId },
    update: { payload, tentativas: { increment: 1 } },
    create: {
      clienteId: lead.clienteId,
      leadId: lead.id,
      eventId,
      tipo,
      valor: tipo === "PURCHASE" ? (valor ?? Number(lead.valorVenda ?? 0)) : null,
      payload,
      tentativas: 1,
    },
  });

  const pixelId = lead.cliente.pixelId;
  const capiToken = decifrar(lead.cliente.capiToken);
  if (!pixelId || !capiToken) {
    // Cliente ainda sem credenciais: fica registrado para envio quando houver.
    await prisma.envioCapi.update({
      where: { id: envio.id },
      data: { resposta: "Cliente sem pixelId ou capiToken configurado" },
    });
    return envio;
  }

  const resultado = await enviarAoMeta(envio.id, pixelId, capiToken, payload);

  if (forcado) {
    await prisma.envioCapi.update({
      where: { id: envio.id },
      data: {
        resposta: `${resultado.resposta ?? ""} | horário do evento ajustado: o original passava da janela de 7 dias do Meta`.slice(0, 2000),
      },
    });
  }

  return resultado;
}

async function enviarAoMeta(
  envioId: string,
  pixelId: string,
  token: string,
  payload: unknown,
) {
  const url = `https://graph.facebook.com/${VERSAO_API}/${pixelId}/events?access_token=${encodeURIComponent(token)}`;

  try {
    const resposta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const corpo = await resposta.text();

    return prisma.envioCapi.update({
      where: { id: envioId },
      data: {
        statusResposta: resposta.status,
        resposta: corpo.slice(0, 2000),
        enviadoEm: resposta.ok ? new Date() : null,
      },
    });
  } catch (erro) {
    return prisma.envioCapi.update({
      where: { id: envioId },
      data: { statusResposta: 0, resposta: String(erro).slice(0, 2000) },
    });
  }
}

/** Reenvia o que falhou. Chamado pela rotina diária. */
export async function reenviarFalhas(clienteId: string, limite = 50) {
  // Evento parado há mais de 6 dias já passou da janela do Meta: reenviar só
  // geraria recusa, ou um lead velho contado como novo.
  const recente = new Date(Date.now() - (JANELA_DIAS - 1) * 24 * 60 * 60 * 1000);
  const pendentes = await prisma.envioCapi.findMany({
    where: { clienteId, enviadoEm: null, tentativas: { lt: 5 }, criadoEm: { gte: recente } },
    orderBy: { criadoEm: "asc" },
    take: limite,
    include: { cliente: true },
  });

  let enviados = 0;
  for (const envio of pendentes) {
    const pixelId = envio.cliente.pixelId;
    const capiToken = decifrar(envio.cliente.capiToken);
    if (!pixelId || !capiToken) continue;
    await prisma.envioCapi.update({
      where: { id: envio.id },
      data: { tentativas: { increment: 1 } },
    });
    const resultado = await enviarAoMeta(envio.id, pixelId, capiToken, envio.payload);
    if (resultado.statusResposta === 200) enviados++;
  }
  return { tentados: pendentes.length, enviados };
}
