import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { normalizarCodigo } from "@/lib/codigo";

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
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    null;

  try {
    await prisma.clique.upsert({
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
        url: d.url ?? null,
      },
    });
  } catch (erro) {
    console.error("[clique] falha ao gravar", erro);
    return NextResponse.json({ erro: "falha ao gravar" }, { status: 500, headers: CORS });
  }

  return NextResponse.json({ ok: true, codigo }, { headers: CORS });
}
