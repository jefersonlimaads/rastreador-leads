import "server-only";
import { prisma } from "../prisma";
import { hashSha256 } from "../telefone";
import type { TipoEnvioCapi } from "@prisma/client";

const VERSAO_API = "v21.0";
/** O Meta recusa evento com mais de 7 dias. */
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
  const eventTime = quando < limite ? agora : quando;

  const payload = {
    data: [
      {
        event_name: tipo === "LEAD" ? "Lead" : "Purchase",
        event_time: eventTime,
        event_id: eventId,
        action_source: "website",
        event_source_url: lead.clique?.url ?? undefined,
        user_data: {
          ph: [await hashSha256(lead.telefone)],
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

  const { pixelId, capiToken } = lead.cliente;
  if (!pixelId || !capiToken) {
    // Cliente ainda sem credenciais: fica registrado para envio quando houver.
    await prisma.envioCapi.update({
      where: { id: envio.id },
      data: { resposta: "Cliente sem pixelId ou capiToken configurado" },
    });
    return envio;
  }

  return enviarAoMeta(envio.id, pixelId, capiToken, payload);
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
  const pendentes = await prisma.envioCapi.findMany({
    where: { clienteId, enviadoEm: null, tentativas: { lt: 5 } },
    orderBy: { criadoEm: "asc" },
    take: limite,
    include: { cliente: true },
  });

  let enviados = 0;
  for (const envio of pendentes) {
    const { pixelId, capiToken } = envio.cliente;
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
