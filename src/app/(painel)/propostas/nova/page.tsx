import { exigirAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { FormularioProposta } from "../formulario";

export default async function PaginaNovaProposta({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await exigirAdmin();
  const { cliente } = await searchParams;

  const clientes = await prisma.cliente.findMany({
    where: { ativo: true },
    orderBy: [{ ciclo: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true },
  });

  // Validade padrão: 7 dias. Proposta sem prazo não cria urgência nenhuma.
  const validade = new Date();
  validade.setDate(validade.getDate() + 7);

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Nova proposta</h1>
      <p className="mt-1 text-sm text-suave">
        Começa com o seu escopo padrão. Ajuste para esse lead antes de enviar.
      </p>
      <FormularioProposta
        clientes={clientes}
        valores={{
          clienteId: typeof cliente === "string" ? cliente : "",
          titulo: "",
          apresentacao: "",
          escopo: "",
          feeMensal: "",
          setup: "",
          condicoes: "",
          validade: validade.toISOString().slice(0, 10),
        }}
      />
    </>
  );
}
