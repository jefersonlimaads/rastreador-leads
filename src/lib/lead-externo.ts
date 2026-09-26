import "server-only";
import { z } from "zod";
import { normalizarTelefone } from "./telefone";
import { lerCampos, type CampoFormulario } from "./campos";

/**
 * Lead que chega de fora: formulário de outra plataforma, automação, CRM.
 *
 * O ponto delicado é a origem. Quem manda o lead pode dizer de qual anúncio
 * ele veio, e isso não é a mesma coisa que ter capturado o clique — a página
 * pode ter copiado o parâmetro errado, ou repetido o mesmo em todos os envios.
 *
 * Então a origem entra em três níveis, como o briefing pede:
 *   confirmada  — bate com um clique que o nosso script registrou
 *   informada   — veio no envio, mas ninguém confere
 *   não identificada — não veio nada
 *
 * Sem isso, venda atribuída a anúncio vira palpite com cara de medição, e é
 * sobre esse número que se decide onde colocar verba.
 */

const texto = (max: number) =>
  z
    .union([z.string(), z.number()])
    .transform((v) => String(v).trim().slice(0, max))
    .nullish();

export const LeadExterno = z.object({
  clienteId: z.string().min(1).max(64),
  nome: texto(120),
  /* Só confere que veio algo: quem decide se é telefone é normalizarTelefone,
     para a mensagem de erro sair de um lugar só. */
  telefone: z.string({ error: "falta o telefone" }).min(3).max(40),
  email: texto(160),
  /** Quando o contato chegou de verdade. Sem isso, vale a hora de agora. */
  quandoChegou: texto(40),
  mensagem: texto(500),

  // Origem, do jeito que a página conhece.
  codigo: texto(10),
  campaignId: texto(64),
  adsetId: texto(64),
  adId: texto(64),
  utmSource: texto(120),
  utmMedium: texto(120),
  utmCampaign: texto(200),
  utmContent: texto(200),
  utmTerm: texto(200),
  fbclid: texto(300),
  pagina: texto(2000),

  /** Os outros campos do formulário: empresa, evento, o que a página perguntar. */
  campos: z.array(z.object({ rotulo: z.string().max(200), valor: z.string().max(1000) })).nullish(),
});

export type LeadExterno = z.infer<typeof LeadExterno>;

export const PedidoLeads = z.object({
  leads: z.array(LeadExterno).min(1).max(200),
});

export type LeadValidado = {
  clienteId: string;
  nome: string | null;
  telefone: string;
  mensagemEm: Date;
  mensagem: string;
  codigo: string | null;
  origem: {
    campaignId: string | null;
    adsetId: string | null;
    adId: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    utmContent: string | null;
    utmTerm: string | null;
    fbclid: string | null;
    url: string | null;
  };
  campos: CampoFormulario[];
  /** Se a origem veio no envio. Confirmar contra clique é trabalho da rota. */
  temOrigem: boolean;
};

/** Data do envio, ou agora. Data futura não passa: relógio errado é comum. */
function quando(bruto: string | null | undefined): Date {
  if (!bruto) return new Date();
  const d = new Date(bruto);
  if (Number.isNaN(d.getTime())) return new Date();
  const agora = Date.now();
  if (d.getTime() > agora + 60_000) return new Date();
  // Mais de dois anos atrás costuma ser erro de formato, não histórico.
  if (agora - d.getTime() > 2 * 365 * 24 * 60 * 60 * 1000) return new Date();
  return d;
}

export function validarLeads(brutos: unknown[]): {
  aceitos: LeadValidado[];
  recusados: { linha: number; erro: string }[];
} {
  const aceitos: LeadValidado[] = [];
  const recusados: { linha: number; erro: string }[] = [];
  const telefonesVistos = new Set<string>();

  brutos.forEach((bruto, i) => {
    const lido = LeadExterno.safeParse(bruto);
    if (!lido.success) {
      recusados.push({ linha: i + 1, erro: lido.error.issues[0]?.message ?? "dados inválidos" });
      return;
    }
    const d = lido.data;

    const telefone = normalizarTelefone(d.telefone);
    if (!telefone) {
      recusados.push({ linha: i + 1, erro: "telefone inválido" });
      return;
    }
    // Mesmo telefone duas vezes no mesmo envio é repetição do lado de lá.
    const chave = `${d.clienteId}|${telefone}`;
    if (telefonesVistos.has(chave)) {
      recusados.push({ linha: i + 1, erro: "telefone repetido neste envio" });
      return;
    }
    telefonesVistos.add(chave);

    const origem = {
      campaignId: d.campaignId ?? null,
      adsetId: d.adsetId ?? null,
      adId: d.adId ?? null,
      utmSource: d.utmSource ?? null,
      utmMedium: d.utmMedium ?? null,
      utmCampaign: d.utmCampaign ?? null,
      utmContent: d.utmContent ?? null,
      utmTerm: d.utmTerm ?? null,
      fbclid: d.fbclid ?? null,
      url: d.pagina ?? null,
    };

    aceitos.push({
      clienteId: d.clienteId,
      nome: d.nome?.trim() || null,
      telefone,
      mensagemEm: quando(d.quandoChegou),
      mensagem: d.mensagem?.trim() || "Recebido por integração",
      codigo: d.codigo?.toUpperCase() ?? null,
      origem,
      campos: lerCampos(d.campos),
      temOrigem: Boolean(origem.adId || origem.campaignId || origem.fbclid || origem.utmCampaign),
    });
  });

  return { aceitos, recusados };
}
