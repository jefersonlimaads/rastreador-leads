import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { detalheComercial, ROTULO_CICLO, ROTULO_FATURA } from "@/lib/financeiro";
import { formatarDataPura, formatarMesPuro } from "@/lib/datas";
import { formatarTelefone } from "@/lib/telefone";
import { moeda, Selo } from "../../componentes";
import { BotaoPagar } from "../botoes";
import { FormularioComercial, FormularioFatura } from "./formularios";

export default async function PaginaClienteComercial({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirAdmin();
  const { id } = await params;

  const cliente = await detalheComercial(id);
  if (!cliente) notFound();

  const hoje = new Date();

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
          href="/carteira"
          className="shrink-0 rounded-xl border border-borda px-3 py-2 text-sm"
        >
          Campanhas
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
    </>
  );
}
