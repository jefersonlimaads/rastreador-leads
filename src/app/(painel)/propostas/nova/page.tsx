import { exigirAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { servicosDaAgencia } from "@/lib/servicos";
import { FormularioProposta } from "../formulario";

export default async function PaginaNovaProposta({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessao = await exigirAdmin();
  const { cliente } = await searchParams;

  const servicos = (await servicosDaAgencia(sessao.agenciaId)).filter((s) => s.ativo);

  const clientes = await prisma.cliente.findMany({
    where: { agenciaId: sessao.agenciaId, ativo: true },
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
        Marque os serviços que entram, ajuste o valor e escolha o período.
      </p>
      <FormularioProposta
        clientes={clientes}
        servicos={servicos}
        valores={{
          clienteId: typeof cliente === "string" ? cliente : "",
          titulo: "",
          apresentacao: "",
          servicos: [],
          extras: "",
          feeCheio: "",
          feeMensal: "",
          setupCheio: "",
          setup: "",
          meses: "",
          condicoes: "",
          validade: validade.toISOString().slice(0, 10),
        }}
      />
    </>
  );
}
