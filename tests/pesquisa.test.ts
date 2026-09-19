/**
 * Prospecção automática: o diagnóstico do site, a nota por regra e a fila da
 * busca. Sem internet: o Google e o Claude não entram aqui (empresas sem site
 * e sem chave de IA).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { analisarHtml, enderecoPublico } from "../src/lib/pesquisa/site";
import { qualificarPorRegra, type DadosProspect } from "../src/lib/pesquisa/qualificar";
import { processarBusca, promoverDiagnostico } from "../src/lib/pesquisa/busca";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const SITE_SEM_NADA = `<html><head><title>Clínica Bella Pele | Estética em Campinas</title>
<meta name="description" content="Tratamentos faciais e corporais."></head>
<body><a href="https://www.instagram.com/clinicabellapele/">Instagram</a>
<a href="https://www.instagram.com/p/abc123/">post</a></body></html>`;

const SITE_COMPLETO = `<html><head><meta name="generator" content="WordPress 6.4">
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-123456789"></script>
<script>gtag('config', 'AW-123456789');</script>
<script>!function(f,b,e,v,n,t,s){}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init', '111');</script>
</head><body><form action="/contato"></form><a href="https://wa.me/5519999999999">WhatsApp</a>
<a href="https://facebook.com/sharer/sharer.php">compartilhar</a><a href="https://facebook.com/clinicaxyz">fb</a></body></html>`;

describe("diagnóstico do site", () => {
  it("site sem pixel, sem tag e sem WhatsApp", () => {
    const s = analisarHtml(SITE_SEM_NADA, "https://bellapele.com.br");
    expect(s.situacao).toBe("ok");
    expect(s.pixelMeta).toBe(false);
    expect(s.googleTag).toBe(false);
    expect(s.botaoWhatsapp).toBe(false);
    expect(s.instagram).toBe("clinicabellapele");
    expect(s.titulo).toBe("Clínica Bella Pele | Estética em Campinas");
    expect(s.https).toBe(true);
  });

  it("site com pixel, Google Ads, formulário e WhatsApp", () => {
    const s = analisarHtml(SITE_COMPLETO, "http://clinicaxyz.com.br");
    expect(s.pixelMeta).toBe(true);
    expect(s.googleTag).toBe(true);
    expect(s.googleAds).toBe(true);
    expect(s.formulario).toBe(true);
    expect(s.botaoWhatsapp).toBe(true);
    expect(s.plataforma).toBe("WordPress");
    expect(s.facebook).toBe("clinicaxyz");
    expect(s.https).toBe(false);
  });

  it("não visita endereço interno", () => {
    expect(enderecoPublico("https://clinica.com.br")).toBe(true);
    expect(enderecoPublico("http://localhost:3000")).toBe(false);
    expect(enderecoPublico("http://169.254.169.254/latest")).toBe(false);
    expect(enderecoPublico("http://10.0.0.5")).toBe(false);
    expect(enderecoPublico("http://192.168.0.1")).toBe(false);
    expect(enderecoPublico("file:///etc/passwd")).toBe(false);
  });
});

const base = (p: Partial<DadosProspect>): DadosProspect => ({
  nome: "Clínica Teste",
  nicho: "clínica de estética",
  cidade: "Campinas",
  categoria: "Clínica de estética",
  telefone: "+55 19 99999-0000",
  site: "https://x.com.br",
  notaGoogle: 4.8,
  avaliacoes: 25,
  instagram: "x",
  sinais: analisarHtml(SITE_SEM_NADA, "https://x.com.br"),
  ...p,
});

describe("nota por regra", () => {
  it("bem avaliado e sem pixel é prospect forte, com gaps e mensagem", () => {
    const q = qualificarPorRegra(base({ avaliacoes: 80 }), "Jeferson, da jl.ads");
    expect(q.pontuacao).toBeGreaterThanOrEqual(70);
    expect(q.gaps.some((g) => g.includes("Pixel"))).toBe(true);
    expect(q.mensagem).toContain("Jeferson, da jl.ads");
    expect(q.mensagem).toContain("Clínica Teste");
  });

  it("quem já tem pixel e tag de anúncio vale menos", () => {
    const forte = qualificarPorRegra(base({}), "J").pontuacao;
    const gerido = qualificarPorRegra(base({ sinais: analisarHtml(SITE_COMPLETO, "https://x.com.br") }), "J").pontuacao;
    expect(gerido).toBeLessThan(forte - 20);
  });

  it("sem telefone perde pontos", () => {
    const com = qualificarPorRegra(base({}), "J").pontuacao;
    const sem = qualificarPorRegra(base({ telefone: null }), "J").pontuacao;
    expect(sem).toBe(com - 20);
  });
});

const AG = "agencia-pesquisa-teste";

describe("busca", () => {
  beforeAll(async () => {
    await prisma.diagnostico.deleteMany({ where: { agenciaId: AG } });
    await prisma.buscaProspeccao.deleteMany({ where: { agenciaId: AG } });
    await prisma.cliente.deleteMany({ where: { agenciaId: AG } });
    await prisma.agencia.deleteMany({ where: { id: AG } });
    await prisma.agencia.create({ data: { id: AG, nome: "Pesquisa Teste", slug: AG } });
  });

  afterAll(async () => {
    await prisma.diagnostico.deleteMany({ where: { agenciaId: AG } });
    await prisma.buscaProspeccao.deleteMany({ where: { agenciaId: AG } });
    await prisma.cliente.deleteMany({ where: { agenciaId: AG } });
    await prisma.agencia.deleteMany({ where: { id: AG } });
    await prisma.$disconnect();
  });

  it("analisa a fila: quem passa da nota vira prospect em A abordar, o resto fica guardado", async () => {
    const busca = await prisma.buscaProspeccao.create({
      data: { agenciaId: AG, nicho: "clínica de estética", cidade: "Campinas", quantidade: 2, notaMinima: 60, encontrados: 2 },
    });
    await prisma.diagnostico.createMany({
      data: [
        // Sem site, bem avaliada, com telefone: entra.
        { agenciaId: AG, buscaId: busca.id, placeId: "p-forte", nome: "Forte Estética", telefone: "+55 19 98888-1111", notaGoogle: 4.9, avaliacoes: 150 },
        // Sem site, sem avaliações, sem telefone: fica de fora.
        { agenciaId: AG, buscaId: busca.id, placeId: "p-fraca", nome: "Fraca Estética", notaGoogle: null, avaliacoes: 0 },
      ],
    });

    await processarBusca(busca.id, { assinatura: "Jeferson, da jl.ads", agencia: "jl.ads" });

    const fim = await prisma.buscaProspeccao.findUniqueOrThrow({ where: { id: busca.id } });
    expect(fim.status).toBe("CONCLUIDA");
    expect(fim.analisados).toBe(2);
    expect(fim.adicionados).toBe(1);

    const forte = await prisma.diagnostico.findFirstOrThrow({ where: { placeId: "p-forte" }, include: { cliente: true } });
    expect(forte.status).toBe("ANALISADO");
    expect(forte.cliente?.ciclo).toBe("PROSPECCAO");
    expect(forte.cliente?.contatoTelefone).toBe("5519988881111");
    expect(forte.briefing).toBeTruthy();

    const fraca = await prisma.diagnostico.findFirstOrThrow({ where: { placeId: "p-fraca" } });
    expect(fraca.status).toBe("DESCARTADO");
    expect(fraca.clienteId).toBeNull();

    // Discordou da nota: o descartado vira prospect.
    const promovido = await promoverDiagnostico(fraca.id, AG);
    expect(promovido).toBeTruthy();
    const depois = await prisma.buscaProspeccao.findUniqueOrThrow({ where: { id: busca.id } });
    expect(depois.adicionados).toBe(2);
  });
});
