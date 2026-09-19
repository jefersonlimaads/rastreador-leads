import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { contasDisponiveis } from "@/lib/meta/marketing";
import { FormularioNovoCliente } from "./formulario";

export default async function PaginaNovoCliente() {
  const sessao = await exigirAdmin();
  // Contas que o token da agência enxerga e que ainda não são de nenhum cliente.
  const [lista, usadas] = await Promise.all([
    contasDisponiveis(sessao.agenciaId),
    prisma.contaAnuncios.findMany({
      where: { cliente: { agenciaId: sessao.agenciaId } },
      select: { contaId: true },
    }),
  ]);
  const ocupadas = new Set(usadas.map((u) => u.contaId));
  const livres = lista.contas.filter((c) => !ocupadas.has(c.contaId));

  return (
    <>
      <Link href="/negocio" className="text-sm text-suave">
        ← Negócio
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">Novo cliente</h1>
      <p className="mt-1 text-sm text-suave">
        Para quem já é seu cliente. Entra direto como ativo, sem passar pela prospecção.
      </p>
      <FormularioNovoCliente contas={livres} />
    </>
  );
}
