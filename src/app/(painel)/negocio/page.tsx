import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import {
  carteiraComercial,
  resumoFinanceiro,
  ROTULO_CICLO,
  CICLOS_EM_PROSPECCAO,
} from "@/lib/financeiro";
import { formatarDataPura, formatarMesPuro } from "@/lib/datas";
import { moeda, Selo, Vazio } from "../componentes";
import { BotaoGerarFaturas, BotaoPagar } from "./botoes";

/**
 * Negócio: a carteira pelo lado da jl.ads — quanto entra por mês, quem pagou,
 * quem atrasou, e quem ainda é prospect.
 */
export default async function PaginaNegocio() {
  await exigirAdmin();

  const [resumo, clientes] = await Promise.all([resumoFinanceiro(), carteiraComercial()]);
  const emCarteira = clientes.filter(
    (c) => !(CICLOS_EM_PROSPECCAO as readonly string[]).includes(c.ciclo),
  );
  const prospects = clientes.filter((c) =>
    (CICLOS_EM_PROSPECCAO as readonly string[]).includes(c.ciclo),
  );

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Negócio</h1>
          <p className="mt-1 text-sm text-suave">
            {resumo.clientesAtivos} {resumo.clientesAtivos === 1 ? "cliente ativo" : "clientes ativos"}
            {resumo.emProspeccao > 0 ? ` · ${resumo.emProspeccao} em prospecção` : ""}
          </p>
        </div>
        <BotaoGerarFaturas />
      </div>

      <section className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador titulo="Receita recorrente" valor={moeda(resumo.receitaRecorrente)} nota="por mês" />
        <Indicador titulo="Recebido no mês" valor={moeda(resumo.recebidoNoMes)} nota={`de ${moeda(resumo.faturadoNoMes)}`} />
        <Indicador titulo="Em aberto" valor={moeda(resumo.emAberto)} />
        <Indicador
          titulo="Atrasado"
          valor={moeda(resumo.atrasado)}
          nota={resumo.atrasadas > 0 ? `${resumo.atrasadas} fatura(s)` : undefined}
          alerta={resumo.atrasado > 0}
        />
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-suave">
          Clientes
        </h2>
        <div className="flex flex-col gap-3">
          {emCarteira.length === 0 && <Vazio>Nenhum cliente ativo ainda.</Vazio>}
          {emCarteira.map((c) => (
            <article key={c.id} className="rounded-2xl border border-borda bg-superficie p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/negocio/${c.id}`} className="block truncate font-medium">
                    {c.nome}
                  </Link>
                  <p className="mt-0.5 text-sm text-suave">
                    {[
                      c.feeMensal ? `${moeda(c.feeMensal)}/mês` : "sem fee definido",
                      c.diaVencimento ? `vence dia ${c.diaVencimento}` : null,
                      c.contatoNome,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <Selo tom={c.ciclo === "ATIVO" ? "ok" : "neutro"}>{ROTULO_CICLO[c.ciclo]}</Selo>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {c.faturaDoMes ? (
                  <>
                    <Selo
                      tom={
                        c.faturaDoMes.status === "PAGA"
                          ? "ok"
                          : c.faturaDoMes.atrasada
                            ? "alerta"
                            : "neutro"
                      }
                    >
                      {c.faturaDoMes.status === "PAGA"
                        ? "mês pago"
                        : c.faturaDoMes.atrasada
                          ? `atrasada desde ${formatarDataPura(c.faturaDoMes.vencimento)}`
                          : `vence ${formatarDataPura(c.faturaDoMes.vencimento)}`}
                    </Selo>
                    <BotaoPagar
                      faturaId={c.faturaDoMes.id}
                      paga={c.faturaDoMes.status === "PAGA"}
                      valor={moeda(c.faturaDoMes.valor)}
                    />
                    {c.faturaDoMes.linkPagamento && c.faturaDoMes.status !== "PAGA" && (
                      <a
                        href={c.faturaDoMes.linkPagamento}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-xl border border-borda px-3 py-2 text-sm"
                      >
                        Abrir cobrança
                      </a>
                    )}
                  </>
                ) : (
                  <Selo>sem fatura neste mês</Selo>
                )}
                {c.atrasadas > 0 && <Selo tom="alerta">{c.atrasadas} em atraso</Selo>}
              </div>
            </article>
          ))}
        </div>
      </section>

      {prospects.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-suave">
            Prospecção
          </h2>
          <div className="flex flex-col gap-2">
            {prospects.map((c) => (
              <Link
                key={c.id}
                href={`/negocio/${c.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-borda bg-superficie px-3 py-2.5"
              >
                <span className="truncate text-sm font-medium">{c.nome}</span>
                <Selo>{ROTULO_CICLO[c.ciclo]}</Selo>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Indicador({
  titulo,
  valor,
  nota,
  alerta,
}: {
  titulo: string;
  valor: string;
  nota?: string;
  alerta?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${
        alerta ? "border-alerta bg-alerta-suave" : "border-borda bg-superficie"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-suave">{titulo}</p>
      <p className={`mt-1 text-lg font-semibold ${alerta ? "text-alerta" : ""}`}>{valor}</p>
      {nota && <p className="text-xs text-suave">{nota}</p>}
    </div>
  );
}
