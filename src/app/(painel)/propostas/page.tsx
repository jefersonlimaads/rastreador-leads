import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { listarPropostas, ROTULO_SITUACAO, type Situacao } from "@/lib/propostas";
import { formatarDataPura, hojeComoDataPura } from "@/lib/datas";
import { moeda, Selo } from "../componentes";

/**
 * Pipeline de propostas. As colunas seguem o caminho de uma proposta depois do
 * envio; "enviada" e "aberta" andam sozinhas pelo link, "negociando" é você que
 * move, e aceita e recusada vêm da resposta do lead.
 */
const COLUNAS: { chave: Situacao | "encerradas"; titulo: string; ajuda: string }[] = [
  { chave: "rascunho", titulo: "Rascunho", ajuda: "Só você vê" },
  { chave: "aguardando", titulo: "Enviada", ajuda: "Ainda não abriu" },
  { chave: "visualizada", titulo: "Aberta", ajuda: "Leu e não respondeu: ligue" },
  { chave: "negociando", titulo: "Negociando", ajuda: "Conversa em andamento" },
  { chave: "aceita", titulo: "Aceita", ajuda: "Virou cliente" },
  { chave: "encerradas", titulo: "Perdida", ajuda: "Recusada ou vencida" },
];

export default async function PaginaPropostas() {
  const sessao = await exigirAdmin();
  const propostas = await listarPropostas(sessao.agenciaId);
  const hoje = hojeComoDataPura();

  const colunaDe = (s: Situacao) => (s === "recusada" || s === "expirada" ? "encerradas" : s);

  const aceitas = propostas.filter((p) => p.situacao === "aceita");
  const respondidas = propostas.filter((p) => p.situacao === "aceita" || p.situacao === "recusada");
  const taxa = respondidas.length > 0 ? Math.round((aceitas.length / respondidas.length) * 100) : null;
  const emAberto = propostas.filter((p) =>
    ["aguardando", "visualizada", "negociando"].includes(p.situacao),
  );
  const valorEmAberto = emAberto.reduce((t, p) => t + Number(p.feeMensal ?? 0), 0);
  const contatosVencidos = emAberto.filter((p) => p.proximoContato && p.proximoContato <= hoje);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Propostas</h1>
          <p className="mt-1 text-sm text-suave">
            {[
              emAberto.length > 0
                ? `${emAberto.length} em aberto · ${moeda(valorEmAberto)}/mês em jogo`
                : "Nenhuma em aberto",
              taxa !== null ? `${taxa}% de aceite` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link href="/propostas/servicos" className="rounded-xl border border-borda px-3 py-2.5 text-sm">
            Serviços
          </Link>
          <Link
            href="/propostas/nova"
            className="rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca"
          >
            Nova
          </Link>
        </div>
      </div>

      {contatosVencidos.length > 0 && (
        <p className="mt-3 rounded-xl border border-alerta bg-alerta-suave px-3 py-2 text-sm text-alerta">
          {contatosVencidos.length === 1
            ? `Hoje é dia de retomar ${contatosVencidos[0].cliente.nome}.`
            : `${contatosVencidos.length} propostas com contato marcado para hoje ou antes.`}
        </p>
      )}

      {/* No celular as colunas viram uma fita horizontal, como o pipeline de leads. */}
      <div className="mt-4 flex snap-x gap-3 overflow-x-auto pb-2">
        {COLUNAS.map((col) => {
          const itens = propostas.filter((p) => colunaDe(p.situacao) === col.chave);
          return (
            <section
              key={col.chave}
              className="w-[78vw] max-w-xs shrink-0 snap-start rounded-2xl border border-borda bg-superficie p-3 sm:w-64"
            >
              <header>
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold">{col.titulo}</h2>
                  <span className="text-xs text-suave">{itens.length}</span>
                </div>
                <p className="text-xs text-suave">{col.ajuda}</p>
              </header>

              <div className="mt-3 flex flex-col gap-2">
                {itens.length === 0 && <p className="text-xs text-suave">Vazio</p>}
                {itens.map((p) => {
                  const retomar = p.proximoContato && p.proximoContato <= hoje;
                  return (
                    <Link
                      key={p.id}
                      href={`/propostas/${p.id}`}
                      className={`rounded-xl border px-3 py-2.5 ${
                        retomar ? "border-alerta" : "border-borda"
                      }`}
                    >
                      <p className="truncate text-sm font-medium">{p.cliente.nome}</p>
                      <p className="mt-0.5 text-xs text-suave">
                        {[
                          p.feeMensal ? `${moeda(Number(p.feeMensal))}/mês` : null,
                          p.visualizacoes > 0 ? `aberta ${p.visualizacoes}x` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || "sem valor definido"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {p.proximoContato && (
                          <Selo tom={retomar ? "alerta" : "neutro"}>
                            retomar {formatarDataPura(p.proximoContato)}
                          </Selo>
                        )}
                        {col.chave === "encerradas" && (
                          <Selo tom="alerta">{ROTULO_SITUACAO[p.situacao]}</Selo>
                        )}
                      </div>
                      {p.situacao === "recusada" && p.motivoRecusa && (
                        <p className="mt-2 line-clamp-2 text-xs text-suave">“{p.motivoRecusa}”</p>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
