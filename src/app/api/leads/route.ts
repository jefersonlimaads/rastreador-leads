import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { agenciaPorChave } from "@/lib/pesquisa/importacao";
import { PedidoLeads, validarLeads, type LeadValidado } from "@/lib/lead-externo";
import { cadastrarLead } from "@/lib/atribuicao";
import { enfileirarEventoCapi } from "@/lib/meta/capi";
import { normalizarCodigo } from "@/lib/codigo";

// Roda em São Paulo, junto do banco.
export const preferredRegion = "gru1";

/**
 * Entrada de leads de fora: formulário de outra plataforma, automação, CRM.
 *
 * Autenticação pela chave da agência, no cabeçalho:
 *   Authorization: Bearer jli_...
 *
 * POST { leads: [{ clienteId, telefone, nome?, quandoChegou?, mensagem?,
 *   codigo?, adId?, campaignId?, adsetId?, utm*?, fbclid?, pagina?,
 *   campos?: [{ rotulo, valor }] }] }   (até 200)
 *
 * GET só confere a chave.
 *
 * A origem entra em três níveis, e essa distinção é o ponto da rota: dizer que
 * um lead veio de um anúncio não é a mesma coisa que ter capturado o clique.
 */

function chaveDo(request: NextRequest) {
  const auth = request.headers.get("authorization");
  return auth?.replace(/^Bearer\s+/i, "").trim() ?? request.headers.get("x-chave")?.trim() ?? null;
}

export async function GET(request: NextRequest) {
  const agencia = await agenciaPorChave(chaveDo(request));
  if (!agencia) return NextResponse.json({ ok: false, erro: "Chave inválida ou revogada." }, { status: 401 });
  return NextResponse.json({ ok: true, agencia: agencia.nome });
}

export async function POST(request: NextRequest) {
  const agencia = await agenciaPorChave(chaveDo(request));
  if (!agencia) return NextResponse.json({ ok: false, erro: "Chave inválida ou revogada." }, { status: 401 });

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false, erro: "Corpo inválido." }, { status: 400 });
  }

  const pedido = PedidoLeads.safeParse(corpo);
  if (!pedido.success) {
    return NextResponse.json(
      { ok: false, erro: "Envie { leads: [...] }, de 1 a 200 por vez." },
      { status: 400 },
    );
  }

  const { aceitos, recusados } = validarLeads(pedido.data.leads);

  // Só clientes desta agência: o clienteId vem de fora e não se confia nele.
  const permitidos = new Set(
    (
      await prisma.cliente.findMany({
        where: { agenciaId: agencia.id, ativo: true },
        select: { id: true },
      })
    ).map((c) => c.id),
  );

  const resultado = { criados: 0, retornos: 0, recusados: [...recusados] as { linha: number; erro: string }[] };
  const porNivel = { confirmada: 0, informada: 0, nao_identificada: 0 };

  for (const [i, lead] of aceitos.entries()) {
    if (!permitidos.has(lead.clienteId)) {
      resultado.recusados.push({ linha: i + 1, erro: "cliente não é desta agência" });
      continue;
    }

    try {
      const { cliqueId, atribuicao, nivel } = await resolverOrigem(lead);
      porNivel[nivel]++;

      const r = await cadastrarLead({
        clienteId: lead.clienteId,
        telefone: lead.telefone,
        nome: lead.nome,
        mensagem: lead.mensagem,
        mensagemEm: lead.mensagemEm,
        usuarioId: null,
        cliqueIdEscolhido: cliqueId,
        atribuicaoEscolhida: atribuicao,
        origem: "WEBHOOK",
      });

      if (r.tipo === "retorno") resultado.retornos++;
      else {
        resultado.criados++;
        after(() => enfileirarEventoCapi({ leadId: r.lead.id, tipo: "LEAD" }));
      }
    } catch (erro) {
      console.error("[api/leads] falha ao gravar", erro);
      resultado.recusados.push({ linha: i + 1, erro: "falha ao gravar" });
    }
  }

  return NextResponse.json({ ok: true, ...resultado, origem: porNivel });
}

/**
 * A origem em três níveis.
 *
 * Confirmada: existe um clique nosso que bate — pelo código que a pessoa
 * levou na mensagem, ou pelo fbclid, que é único por clique. Aí a venda pode
 * ser atribuída ao anúncio com segurança.
 *
 * Informada: veio identificador no envio, mas nada confere. Vale para separar
 * por campanha, não para afirmar que aquele anúncio gerou aquela venda.
 *
 * Não identificada: nada veio.
 */
async function resolverOrigem(lead: LeadValidado): Promise<{
  cliqueId: string | null;
  atribuicao: "EXATA" | "PROVAVEL" | "DESCONHECIDA";
  nivel: "confirmada" | "informada" | "nao_identificada";
}> {
  const codigo = lead.codigo ? normalizarCodigo(lead.codigo) : null;

  const clique =
    (codigo
      ? await prisma.clique.findFirst({
          where: { clienteId: lead.clienteId, codigo, lead: null },
          select: { id: true },
        })
      : null) ??
    (lead.origem.fbclid
      ? await prisma.clique.findFirst({
          where: { clienteId: lead.clienteId, fbclid: lead.origem.fbclid, lead: null },
          select: { id: true },
        })
      : null);

  if (clique) return { cliqueId: clique.id, atribuicao: "EXATA", nivel: "confirmada" };

  /* Sem clique que confira, o que veio no envio vira um clique marcado como
     informado: guarda a origem para agrupar por campanha, sem afirmar que foi
     ele que gerou a venda. */
  if (lead.temOrigem) {
    const registrado = await prisma.clique.create({
      data: {
        clienteId: lead.clienteId,
        codigo: `EXT${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
        ...lead.origem,
        campos: lead.campos.length > 0 ? lead.campos : undefined,
        criadoEm: lead.mensagemEm,
        status: "CASADO",
      },
      select: { id: true },
    });
    return { cliqueId: registrado.id, atribuicao: "PROVAVEL", nivel: "informada" };
  }

  return { cliqueId: null, atribuicao: "DESCONHECIDA", nivel: "nao_identificada" };
}
