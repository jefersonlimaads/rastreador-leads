import Link from "next/link";
import { exigirCliente } from "@/lib/auth";
import { filaDoDia } from "@/lib/consultas";
import { encerrarCliquesSemContato } from "@/lib/atribuicao";
import { CartaoLead, Secao, Vazio } from "../componentes";

export default async function PaginaHoje({ searchParams }: PageProps<"/hoje">) {
  const { cliente } = await searchParams;
  const { clienteId } = await exigirCliente(typeof cliente === "string" ? cliente : null);

  // Regra 12 aplicada na abertura do painel: clique sem mensagem em 24h se encerra.
  await encerrarCliquesSemContato(clienteId);

  const { novos, parados, followUp, cliquesPendentes } = await filaDoDia(clienteId);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Hoje</h1>
        <Link
          href="/leads/novo"
          className="rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-white"
        >
          Cadastrar lead
        </Link>
      </div>

      {cliquesPendentes > 0 && (
        <p className="mt-3 rounded-xl bg-marca-suave px-3 py-2 text-sm text-marca">
          {cliquesPendentes} {cliquesPendentes === 1 ? "clique aguardando" : "cliques aguardando"}{" "}
          mensagem nas últimas 24 horas.
        </p>
      )}

      <Secao titulo="Sem resposta há mais de 2 horas" contagem={parados.length}>
        {parados.length === 0 ? (
          <Vazio>Nenhum lead novo esperando resposta.</Vazio>
        ) : (
          parados.map((lead) => <CartaoLead key={lead.id} lead={lead} destaque="Sem resposta" />)
        )}
      </Secao>

      <Secao titulo="Leads novos" contagem={novos.length}>
        {novos.length === 0 ? (
          <Vazio>Nenhum lead novo agora.</Vazio>
        ) : (
          novos.map((lead) => <CartaoLead key={lead.id} lead={lead} />)
        )}
      </Secao>

      <Secao titulo="Follow-up" contagem={followUp.length}>
        {followUp.length === 0 ? (
          <Vazio>Nenhum lead parado há mais de 3 dias.</Vazio>
        ) : (
          followUp.map((lead) => <CartaoLead key={lead.id} lead={lead} destaque="Parado" />)
        )}
      </Secao>
    </>
  );
}
