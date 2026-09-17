import "server-only";
import { prisma } from "./prisma";

/**
 * Política de retenção do escopo, aplicada pela rotina diária:
 * lead sem interação há 24 meses e clique sem contato há 12 meses são descartados.
 *
 * Aqui o apagar é real, não lógico: guardar telefone de gente que nunca mais
 * falou com o cliente é o que a LGPD manda evitar. O histórico de atribuição que
 * interessa ao painel é muito mais curto que esses prazos.
 */
export const RETENCAO = {
  leadMeses: 24,
  cliqueMeses: 12,
} as const;

function mesesAtras(meses: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - meses);
  return d;
}

export async function aplicarRetencao(clienteId: string) {
  const limiteLead = mesesAtras(RETENCAO.leadMeses);
  const limiteClique = mesesAtras(RETENCAO.cliqueMeses);

  const antigos = await prisma.lead.findMany({
    where: {
      clienteId,
      criadoEm: { lt: limiteLead },
      eventos: { none: { criadoEm: { gte: limiteLead } } },
    },
    select: { id: true },
    take: 500,
  });

  const ids = antigos.map((l) => l.id);
  let leadsDescartados = 0;

  if (ids.length > 0) {
    await prisma.$transaction([
      prisma.evento.deleteMany({ where: { leadId: { in: ids } } }),
      prisma.envioCapi.deleteMany({ where: { leadId: { in: ids } } }),
      // Solta o vínculo antes de apagar, senão o lead seguinte fica órfão.
      prisma.lead.updateMany({
        where: { leadAnteriorId: { in: ids } },
        data: { leadAnteriorId: null },
      }),
      prisma.lead.deleteMany({ where: { id: { in: ids } } }),
    ]);
    leadsDescartados = ids.length;
  }

  const { count: cliquesDescartados } = await prisma.clique.deleteMany({
    where: { clienteId, status: "SEM_CONTATO", criadoEm: { lt: limiteClique }, lead: null },
  });

  return { leadsDescartados, cliquesDescartados };
}
