import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizarCodigo } from "@/lib/codigo";
import { normalizarTelefone } from "@/lib/telefone";
import { cadastrarLead } from "@/lib/atribuicao";
import { enfileirarEventoCapi } from "@/lib/meta/capi";
import { lerCampos, MAX_CAMPOS, resumoDosCampos } from "@/lib/campos";

// Roda em São Paulo, junto do banco.
export const preferredRegion = "gru1";

// A landing page do cliente fica em outro domínio: precisa responder CORS.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const texto = z.string().trim().max(500).nullish();

const Entrada = z.object({
  clienteId: z.string().min(1).max(64),
  codigo: z.string().min(4).max(6),
  utmSource: texto,
  utmMedium: texto,
  utmCampaign: texto,
  utmContent: texto,
  utmTerm: texto,
  campaignId: texto,
  adsetId: texto,
  adId: texto,
  fbclid: texto,
  fbp: texto,
  fbc: texto,
  interesse: z.string().trim().max(80).nullish(),
  nomeVisitante: z.string().trim().max(120).nullish(),
  telefoneVisitante: z.string().trim().max(40).nullish(),
  // Os outros campos do formulário. A limpeza fina fica em lerCampos.
  campos: z
    .array(z.object({ rotulo: z.string().max(200), valor: z.string().max(1000) }))
    .max(MAX_CAMPOS * 3)
    .nullish(),
  url: z.string().trim().max(2000).nullish(),
});

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
  // O sendBeacon manda text/plain para evitar preflight, então lemos o corpo cru.
  let bruto: unknown;
  try {
    bruto = JSON.parse(await request.text());
  } catch {
    return NextResponse.json({ erro: "corpo inválido" }, { status: 400, headers: CORS });
  }

  const dados = Entrada.safeParse(bruto);
  if (!dados.success) {
    return NextResponse.json({ erro: "dados inválidos" }, { status: 400, headers: CORS });
  }

  const d = dados.data;
  const cliente = await prisma.cliente.findFirst({
    where: { id: d.clienteId, ativo: true },
    select: { id: true },
  });
  if (!cliente) {
    return NextResponse.json({ erro: "cliente não encontrado" }, { status: 404, headers: CORS });
  }

  const codigo = normalizarCodigo(d.codigo);
  const campos = lerCampos(d.campos);
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    null;

  let clique;
  try {
    clique = await prisma.clique.upsert({
      // Mesma pessoa voltando com o mesmo código não vira clique novo.
      where: { clienteId_codigo: { clienteId: cliente.id, codigo } },
      update: {},
      create: {
        clienteId: cliente.id,
        codigo,
        utmSource: d.utmSource ?? null,
        utmMedium: d.utmMedium ?? null,
        utmCampaign: d.utmCampaign ?? null,
        utmContent: d.utmContent ?? null,
        utmTerm: d.utmTerm ?? null,
        campaignId: d.campaignId ?? null,
        adsetId: d.adsetId ?? null,
        adId: d.adId ?? null,
        fbclid: d.fbclid ?? null,
        fbp: d.fbp ?? null,
        fbc: d.fbc ?? null,
        ip,
        userAgent: request.headers.get("user-agent"),
        interesse: d.interesse ?? null,
        nomeVisitante: d.nomeVisitante ?? null,
        telefoneVisitante: d.telefoneVisitante
          ? (normalizarTelefone(d.telefoneVisitante) ?? d.telefoneVisitante)
          : null,
        url: d.url ?? null,
        campos: campos.length > 0 ? campos : undefined,
      },
    });
  } catch (erro) {
    console.error("[clique] falha ao gravar", erro);
    return NextResponse.json({ erro: "falha ao gravar" }, { status: 500, headers: CORS });
  }

  /*
   * Formulário com telefone = lead. A pessoa deu nome e WhatsApp na própria
   * página: não precisa esperar ninguém cadastrar nem confirmar. Entra em Leads
   * e no pipeline na hora, já ligado ao anúncio do clique. Se o mesmo telefone
   * já tem lead aberto, vira retorno no lead existente, não lead novo.
   */
  const telefone = normalizarTelefone(d.telefoneVisitante ?? "");
  if (telefone && clique.status === "PENDENTE") {
    try {
      const resultado = await cadastrarLead({
        clienteId: cliente.id,
        telefone,
        nome: d.nomeVisitante ?? null,
        // O resumo entra na mensagem para quem lê o lead no painel já saber de
        // quem se trata, sem precisar abrir o detalhe.
        mensagem: [
          d.interesse
            ? `Preencheu o formulário da página: ${d.interesse}`
            : "Preencheu o formulário da página",
          campos.length > 0 ? resumoDosCampos(campos) : null,
        ]
          .filter(Boolean)
          .join(" — "),
        mensagemEm: new Date(),
        usuarioId: null,
        cliqueIdEscolhido: clique.id,
        atribuicaoEscolhida: "EXATA",
        origem: "FORMULARIO",
      });
      if (resultado.tipo !== "retorno") {
        // Depois da resposta: a página não espera o Meta.
        after(() => enfileirarEventoCapi({ leadId: resultado.lead.id, tipo: "LEAD" }));
      }
    } catch (erro) {
      // O clique já está gravado: sem o lead, ele ainda aparece para confirmação.
      console.error("[clique] falha ao criar lead do formulário", erro);
    }
  }

  return NextResponse.json({ ok: true, codigo }, { headers: CORS });
}
