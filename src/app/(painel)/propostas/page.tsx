import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { listarPropostas, ROTULO_SITUACAO } from "@/lib/propostas";
import { formatarDataPura } from "@/lib/datas";
import { moeda, Selo, Vazio } from "../componentes";

const TOM: Record<string, "neutro" | "marca" | "alerta" | "ok"> = {
  rascunho: "neutro",
  aguardando: "neutro",
  visualizada: "marca",
  aceita: "ok",
  recusada: "alerta",
  expirada: "alerta",
};

/**
 * Propostas, das que pedem ação para as que já se resolveram. "Aberta, sem
 * resposta" vem primeiro: é o lead que leu e está decidindo, a hora de ligar.
 */
export default async function PaginaPropostas() {
  await exigirAdmin();
  const propostas = await listarPropostas();

  const ordem = ["visualizada", "aguardando", "rascunho", "expirada", "aceita", "recusada"];
  const ordenadas = [...propostas].sort(
    (a, b) => ordem.indexOf(a.situacao) - ordem.indexOf(b.situacao),
  );

  const aceitas = propostas.filter((p) => p.situacao === "aceita");
  const respondidas = propostas.filter((p) => p.situacao === "aceita" || p.situacao === "recusada");
  const taxa = respondidas.length > 0 ? Math.round((aceitas.length / respondidas.length) * 100) : null;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Propostas</h1>
          <p className="mt-1 text-sm text-suave">
            {propostas.length} no total
            {taxa !== null ? ` · ${taxa}% de aceite entre as respondidas` : ""}
          </p>
        </div>
        <Link
          href="/propostas/nova"
          className="shrink-0 rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca"
        >
          Nova
        </Link>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {ordenadas.length === 0 && (
          <Vazio>Nenhuma proposta ainda. A primeira já vem com o seu escopo padrão.</Vazio>
        )}

        {ordenadas.map((p) => (
          <Link
            key={p.id}
            href={`/propostas/${p.id}`}
            className="rounded-2xl border border-borda bg-superficie p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{p.cliente.nome}</p>
                <p className="mt-0.5 truncate text-sm text-suave">{p.titulo}</p>
              </div>
              <Selo tom={TOM[p.situacao]}>{ROTULO_SITUACAO[p.situacao]}</Selo>
            </div>
            <p className="mt-3 text-sm text-suave">
              {[
                p.feeMensal ? `${moeda(Number(p.feeMensal))}/mês` : null,
                p.setup ? `+ ${moeda(Number(p.setup))} de implantação` : null,
                p.visualizacoes > 0 ? `aberta ${p.visualizacoes}x` : null,
                `válida até ${formatarDataPura(p.validade)}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </Link>
        ))}
      </div>
    </>
  );
}
