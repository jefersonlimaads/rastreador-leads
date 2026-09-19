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

  it("site em Wix: pixel ausente vira dúvida, não gap", () => {
    const s = analisarHtml('<html><script src="https://static.wixstatic.com/x.js"></script></html>', "https://x.com.br");
    expect(s.plataforma).toBe("Wix");
    expect(s.naoConfirmavel).toBe(true);
    const q = qualificarPorRegra(base({ sinais: s }), "J");
    expect(q.gaps.some((g) => g.includes("Pixel"))).toBe(false);
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
    expect(q.mensagem).toContain("Pixel do Meta");
    expect(q.mensagem).toContain("clínica de estética em Campinas");
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

import { lerLista } from "../src/lib/pesquisa/lista";
import { converterOsm, filtrosDoNicho } from "../src/lib/pesquisa/osm";

describe("colar lista", () => {
  it("separa nome, telefone, site e Instagram, na ordem que vier", () => {
    const l = lerLista(
      [
        "Clínica Bella Pele, (19) 99812-3344, bellapele.com.br",
        "Espaço Renova — @espacorenova",
        "Studio Face Design 19 3232-1010",
        "https://www.instagram.com/dermaprime/ Derma Prime",
        "",
        "odontosorriso.com.br",
      ].join("\n"),
    );
    expect(l).toHaveLength(5);
    expect(l[0]).toEqual({ nome: "Clínica Bella Pele", telefone: "(19) 99812-3344", site: "https://bellapele.com.br", instagram: null });
    expect(l[1]).toMatchObject({ nome: "Espaço Renova", instagram: "espacorenova", telefone: null });
    expect(l[2]).toMatchObject({ nome: "Studio Face Design", telefone: "19 3232-1010" });
    expect(l[3]).toMatchObject({ nome: "Derma Prime", instagram: "dermaprime" });
    expect(l[4]).toMatchObject({ nome: "odontosorriso", site: "https://odontosorriso.com.br" });
  });
});

describe("mapa aberto", () => {
  it("nicho conhecido usa a categoria do mapa e também o nome", () => {
    const f = filtrosDoNicho("clínica odontológica");
    expect(f).toContain('nwr["amenity"="dentist"]');
    // "clínica" sozinho não puxa laboratório e cardiologista para odontologia.
    expect(f).not.toContain('nwr["amenity"="clinic"]');
    expect(filtrosDoNicho("clínica médica")).toContain('nwr["amenity"="clinic"]');
    expect(f.some((x) => x.startsWith('node["amenity"]["name"~'))).toBe(true);
  });

  it("converte os dados do mapa e põe quem tem telefone primeiro", () => {
    const e = converterOsm(
      [
        { type: "node", id: 1, tags: { name: "Sem Contato" } },
        { type: "node", id: 2, tags: { name: "Odonto Top", phone: "+55 19 3333-4444;+55 19 99999-0000", website: "odontotop.com.br", "contact:instagram": "https://instagram.com/odontotop/" } },
        { type: "way", id: 3, tags: { name: "odonto top" } },
        { type: "node", id: 4 },
        { type: "node", id: 5, tags: { name: 'Centro de Saúde "Dr. Laerte" - Jardim Eulina', phone: "19 3333-0000" } },
        { type: "node", id: 6, tags: { name: "Sabin", brand: "Sabin", phone: "19 3333-1111" } },
        { type: "node", id: 7, tags: { name: "Odonto Municipal", "operator:type": "public" } },
      ],
      "Campinas, SP",
    );
    expect(e).toHaveLength(2);
    expect(e[0]).toMatchObject({ placeId: "osm:node/2", telefone: "+55 19 3333-4444", site: "https://odontotop.com.br" });
    expect(e[1].nome).toBe("Sem Contato");
  });
});

import { agenciaPorChave, gerarChaveImportacao, validarEmpresas } from "../src/lib/pesquisa/importacao";
import { iniciarBuscaPorLista } from "../src/lib/pesquisa/busca";

describe("importação (Cowork)", () => {
  const AG2 = "agencia-importacao-teste";
  beforeAll(async () => {
    await prisma.diagnostico.deleteMany({ where: { agenciaId: AG2 } });
    await prisma.buscaProspeccao.deleteMany({ where: { agenciaId: AG2 } });
    await prisma.cliente.deleteMany({ where: { agenciaId: AG2 } });
    await prisma.agencia.deleteMany({ where: { id: AG2 } });
    await prisma.agencia.create({ data: { id: AG2, nome: "Importação Teste", slug: AG2 } });
  });
  afterAll(async () => {
    await prisma.diagnostico.deleteMany({ where: { agenciaId: AG2 } });
    await prisma.buscaProspeccao.deleteMany({ where: { agenciaId: AG2 } });
    await prisma.cliente.deleteMany({ where: { agenciaId: AG2 } });
    await prisma.agencia.deleteMany({ where: { id: AG2 } });
  });

  it("chave gerada abre a porta; chave trocada derruba a anterior", async () => {
    const primeira = await gerarChaveImportacao(AG2);
    expect((await agenciaPorChave(primeira))?.id).toBe(AG2);
    const segunda = await gerarChaveImportacao(AG2);
    expect(await agenciaPorChave(primeira)).toBeNull();
    expect((await agenciaPorChave(segunda))?.id).toBe(AG2);
    expect(await agenciaPorChave("jli_qualquercoisaerrada123")).toBeNull();
    // No banco só fica o hash.
    const a = await prisma.agencia.findUniqueOrThrow({ where: { id: AG2 } });
    expect(a.chaveImportacao).not.toBe(segunda);
    expect(a.chaveImportacaoFim).toBe(segunda.slice(-4));
  });

  it("empresa inválida fica de fora sem derrubar o lote", () => {
    const { linhas, recusadas } = validarEmpresas([
      { nome: "Boa Estética", telefone: "(19) 99999-1111", notaGoogle: "4,8" },
      { nome: "" },
      "texto solto",
    ]);
    expect(linhas).toHaveLength(1);
    expect(recusadas.map((r) => r.posicao)).toEqual([2, 3]);
  });

  it("briefing e mensagem do Cowork são mantidos; a plataforma só confere o site", async () => {
    const { linhas } = validarEmpresas([
      {
        nome: "Estética Cowork",
        telefone: "(19) 98888-2222",
        notaGoogle: 4.7,
        avaliacoes: 90,
        pontuacao: 77,
        resumo: "Bem avaliada, sem site.",
        gaps: ["Sem site próprio"],
        briefing: "Contexto: ...",
        mensagem: "Oi! Mensagem escrita pelo Cowork.",
      },
    ]);
    const r = await iniciarBuscaPorLista({ agenciaId: AG2, nicho: "estética", cidade: "Campinas", notaMinima: 50 }, linhas, "cowork");
    if ("erro" in r) throw new Error(r.erro);
    await processarBusca(r.buscaId, { assinatura: "J", agencia: "X" });
    const d = await prisma.diagnostico.findFirstOrThrow({ where: { buscaId: r.buscaId }, include: { cliente: true } });
    expect(d.mensagem).toBe("Oi! Mensagem escrita pelo Cowork.");
    expect(d.pontuacao).toBe(77);
    expect(d.analisadoPorIa).toBe(true);
    expect(d.notaGoogle).toBe(4.7);
    expect(d.cliente?.origem).toBe("Cowork (Google Maps)");
    expect((d.sinais as { situacao: string }).situacao).toBe("sem_site");
  });
});
