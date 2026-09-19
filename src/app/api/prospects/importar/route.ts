import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { agenciaPorChave, PedidoImportacao, validarEmpresas } from "@/lib/pesquisa/importacao";
import { iniciarBuscaPorLista, processarBusca } from "@/lib/pesquisa/busca";

// Roda em São Paulo, junto do banco. A análise segue em segundo plano: até 5 min.
export const preferredRegion = "gru1";
export const maxDuration = 300;

/**
 * Entrada de prospects de fora (Cowork, outra automação). Autenticação pela
 * chave de importação da agência, no cabeçalho:
 *   Authorization: Bearer jli_...
 *
 * POST { nicho, cidade, notaMinima?, empresas: [{ nome, telefone?, site?,
 *   instagram?, endereco?, categoria?, mapsUrl?, notaGoogle?, avaliacoes?,
 *   pontuacao?, resumo?, gaps?, briefing?, mensagem? }] }   (até 50)
 *
 * GET só confere a chave — o Cowork usa para testar a conexão.
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
    return NextResponse.json({ ok: false, erro: "Corpo precisa ser JSON." }, { status: 400 });
  }
  const pedido = PedidoImportacao.safeParse(corpo);
  if (!pedido.success) {
    return NextResponse.json(
      { ok: false, erro: "Faltam nicho, cidade ou a lista de empresas (1 a 50).", detalhe: pedido.error.issues.slice(0, 3) },
      { status: 400 },
    );
  }

  const { linhas, recusadas } = validarEmpresas(pedido.data.empresas);
  if (linhas.length === 0) {
    return NextResponse.json({ ok: false, erro: "Nenhuma empresa válida no lote.", recusadas }, { status: 400 });
  }

  // Poucas análises ao mesmo tempo por agência: protege o banco e o limite de tempo.
  const rodando = await prisma.buscaProspeccao.count({ where: { agenciaId: agencia.id, status: "RODANDO" } });
  if (rodando >= 3) {
    return NextResponse.json(
      { ok: false, erro: "Já há 3 análises rodando. Tente de novo em alguns minutos." },
      { status: 429 },
    );
  }

  const r = await iniciarBuscaPorLista(
    { agenciaId: agencia.id, nicho: pedido.data.nicho, cidade: pedido.data.cidade, notaMinima: pedido.data.notaMinima },
    linhas,
    "cowork",
  );
  if ("erro" in r) return NextResponse.json({ ok: false, erro: r.erro }, { status: 400 });

  const admin = await prisma.usuario.findFirst({
    where: { agenciaId: agencia.id, papel: "ADMIN", ativo: true },
    orderBy: { criadoEm: "asc" },
    select: { nome: true },
  });
  const quem = {
    assinatura: `${admin?.nome.split(" ")[0] ?? "Equipe"}, da ${agencia.nome}`,
    agencia: agencia.nome,
  };
  after(() => processarBusca(r.buscaId, quem));

  return NextResponse.json({
    ok: true,
    recebidas: pedido.data.empresas.length,
    novas: r.novas,
    jaExistiam: linhas.length - r.novas,
    recusadas,
    acompanhar: `${process.env.APP_URL ?? ""}/prospeccao/buscas/${r.buscaId}`,
  });
}
