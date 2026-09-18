/**
 * Dados iniciais para desenvolvimento: um administrador da JL Ads, um cliente
 * de teste com número de WhatsApp e alguns cliques para exercitar a atribuição.
 * Em produção, rode uma vez e troque a senha do administrador no primeiro acesso.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const ALFABETO = "ACDEFGHJKMNPQRTUVWXY34679";
function codigo() {
  let c = "";
  for (let i = 0; i < 5; i++) c += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  return c;
}

async function main() {
  const senhaHash = await bcrypt.hash("jlads2026", 10);

  const agencia = await prisma.agencia.upsert({
    where: { id: "agencia-jlads" },
    update: {},
    create: { id: "agencia-jlads", nome: "jl.ads", slug: "jlads" },
  });

  const cliente = await prisma.cliente.upsert({
    where: { id: "cliente-demo" },
    update: {},
    create: {
      id: "cliente-demo",
      agenciaId: agencia.id,
      nome: "Cliente Demo",
      contaAnunciosId: "act_000000000000000",
      fuso: "America/Sao_Paulo",
    },
  });

  await prisma.numeroWhatsapp.deleteMany({ where: { clienteId: cliente.id } });
  await prisma.numeroWhatsapp.create({
    data: { clienteId: cliente.id, numero: "5511999999999", rotulo: "Comercial" },
  });

  await prisma.usuario.upsert({
    where: { email: "admin@jl.ads" },
    update: { senhaHash },
    create: {
      agenciaId: agencia.id,
      nome: "Jeferson Lima",
      email: "admin@jl.ads",
      senhaHash,
      papel: "ADMIN",
      plataforma: true,
      clienteId: null,
    },
  });

  await prisma.usuario.upsert({
    where: { email: "atendente@clientedemo.com" },
    update: { senhaHash },
    create: {
      agenciaId: agencia.id,
      nome: "Atendente Demo",
      email: "atendente@clientedemo.com",
      senhaHash,
      papel: "ATENDENTE",
      clienteId: cliente.id,
    },
  });

  // Cliques recentes de três anúncios diferentes, para testar a atribuição.
  const agora = Date.now();
  const anuncios = [
    { adId: "120210000000001", nome: "Anúncio A", minutos: 5 },
    { adId: "120210000000002", nome: "Anúncio B", minutos: 20 },
    { adId: "120210000000003", nome: "Anúncio C", minutos: 90 },
  ];

  for (const a of anuncios) {
    await prisma.clique.create({
      data: {
        clienteId: cliente.id,
        codigo: codigo(),
        utmSource: "facebook",
        utmMedium: "cpc",
        utmCampaign: "campanha-teste",
        campaignId: "23850000000000001",
        adsetId: "23850000000000002",
        adId: a.adId,
        fbclid: "IwAR" + Math.random().toString(36).slice(2),
        url: "https://exemplo.com.br/lp",
        criadoEm: new Date(agora - a.minutos * 60 * 1000),
      },
    });
  }

  const cliques = await prisma.clique.findMany({
    where: { clienteId: cliente.id },
    orderBy: { criadoEm: "desc" },
  });

  console.log("Cliente:", cliente.nome, cliente.id);
  console.log("Login admin: admin@jl.ads / jlads2026");
  console.log("Login atendente: atendente@clientedemo.com / jlads2026");
  console.log("Códigos de teste:", cliques.map((c) => c.codigo).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
