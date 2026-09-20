import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { detalheComercial, ROTULO_CICLO, ROTULO_FATURA } from "@/lib/financeiro";
import { formatarDataPura, formatarMesPuro } from "@/lib/datas";
import { formatarTelefone } from "@/lib/telefone";
import { moeda, Selo } from "../../componentes";
import { BotaoPagar } from "../botoes";
import { acaoApagarEntrega } from "../acoes";
import { FormularioComercial, FormularioFatura } from "./formularios";
import { NovaEntrega } from "./entregas";

export default async function PaginaClienteComercial({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessao = await exigirAdmin();
  const { id } = await params;

  const cliente = await detalheComercial(id, sessao.agenciaId);
  if (!cliente) notFound();

  const hoje = new Date();
  const mesCorrente = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{cliente.nome}</h1>
          <p className="mt-0.5 text-sm text-suave">
            {[
              ROTULO_CICLO[cliente.ciclo],
              cliente.feeMensal ? `${moeda(Number(cliente.feeMensal))}/mês` : null,
              cliente.inicioContrato ? `desde ${formatarDataPura(cliente.inicioContrato)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Link
          href={`/propostas/nova?cliente=${cliente.id}`}
          className="shrink-0 rounded-xl border border-borda px-3 py-2 text-sm"
        >
          Nova proposta
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Selo>{cliente._count.leads} leads</Selo>
        <Selo>{cliente._count.cliques} cliques</Selo>
        {cliente.contatoTelefone && (
          <a
            href={`https://wa.me/${cliente.contatoTelefone}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Selo tom="marca">falar com {cliente.contatoNome ?? "contato"}</Selo>
          </a>
        )}
      </div>

      <FormularioComercial
        cliente={{
          id: cliente.id,
          ciclo: cliente.ciclo,
          feeMensal: cliente.feeMensal ? Number(cliente.feeMensal) : null,
          diaVencimento: cliente.diaVencimento,
          inicioContrato: cliente.inicioContrato
            ? cliente.inicioContrato.toISOString().slice(0, 10)
            : "",
          fimContrato: cliente.fimContrato ? cliente.fimContrato.toISOString().slice(0, 10) : "",
          custoMensal: cliente.custoMensal ? Number(cliente.custoMensal) : null,
          documento: cliente.documento ?? "",
          contatoNome: cliente.contatoNome ?? "",
          contatoEmail: cliente.contatoEmail ?? "",
          contatoTelefone: cliente.contatoTelefone ? formatarTelefone(cliente.contatoTelefone) : "",
          linkPagamento: cliente.linkPagamento ?? "",
          observacoes: cliente.observacoes ?? "",
        }}
      />

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-suave">Faturas</h2>

        <div className="flex flex-col gap-2">
          {cliente.faturas.length === 0 && (
            <p className="rounded-2xl border border-dashed border-borda px-4 py-6 text-center text-sm text-suave">
              Nenhuma fatura ainda. Defina o fee e o dia de vencimento: a rotina diária gera a
              fatura no começo de cada mês.
            </p>
          )}

          {cliente.faturas.map((f) => {
            const atrasada = f.status === "ABERTA" && f.vencimento < hoje;
            return (
              <article
                key={f.id}
                className={`rounded-xl border bg-superficie px-3 py-2.5 ${
                  atrasada ? "border-alerta" : "border-borda"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
{formatarMesPuro(f.competencia)}
                      {" · "}
                      {moeda(Number(f.valor))}
                    </p>
                    <p className="mt-0.5 text-xs text-suave">
                      {[
                        `vence ${formatarDataPura(f.vencimento)}`,
                        f.pagoEm ? `pago em ${formatarDataPura(f.pagoEm)}` : ROTULO_FATURA[f.status],
                        f.observacao,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <BotaoPagar
                    faturaId={f.id}
                    paga={f.status === "PAGA"}
                    valor={moeda(Number(f.valor))}
                  />
                </div>
              </article>
            );
          })}
        </div>

        <FormularioFatura clienteId={cliente.id} />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">
          Entregas do mês
        </h2>
        <p className="mt-0.5 text-xs text-suave">
          O que a agência fez por esse cliente. Entra no relatório dele, em “O que fizemos no
          período”.
        </p>

        {cliente.entregas.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {cliente.entregas.map((e) => (
              <li
                key={e.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-borda bg-superficie px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm [overflow-wrap:anywhere]">
                    <span className="mr-2 rounded-full bg-marca-suave px-2 py-0.5 text-xs font-medium text-marca-texto">
                      {e.tipo}
                    </span>
                    {e.descricao}
                  </p>
                  <p className="mt-0.5 text-xs text-suave">{formatarMesPuro(e.competencia)}</p>
                </div>
                <form action={acaoApagarEntrega}>
                  <input type="hidden" name="id" value={e.id} />
                  <button
                    type="submit"
                    className="shrink-0 rounded-lg border border-borda px-2 py-1 text-xs text-alerta"
                    title="Apagar entrega"
                  >
                    Apagar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <NovaEntrega clienteId={cliente.id} competencia={mesCorrente} />
      </section>
    </>
  );
}
