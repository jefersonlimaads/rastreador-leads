import { prisma } from "@/lib/prisma";
import { clienteEmFoco, exigirSessao } from "@/lib/auth";
import { Moldura } from "./moldura";

export default async function LayoutPainel({ children }: LayoutProps<"/">) {
  const sessao = await exigirSessao();
  const ehAdmin = sessao.papel === "ADMIN";

  const emFoco = await clienteEmFoco(sessao);
  const [atual, clientes] = await Promise.all([
    emFoco ? prisma.cliente.findUnique({ where: { id: emFoco }, select: { id: true, nome: true } }) : null,
    // Para trocar de cliente pelo cabeçalho: a carteira ativa da agência.
    ehAdmin
      ? prisma.cliente.findMany({
          where: { agenciaId: sessao.agenciaId, ativo: true, ciclo: { in: ["ATIVO", "PAUSADO"] } },
          select: { id: true, nome: true },
          orderBy: { nome: "asc" },
        })
      : [],
  ]);

  return (
    <Moldura
      papel={sessao.papel}
      nome={sessao.nome}
      plataforma={sessao.plataforma}
      clienteAtual={atual}
      clientes={clientes}
    >
      {children}
    </Moldura>
  );
}
