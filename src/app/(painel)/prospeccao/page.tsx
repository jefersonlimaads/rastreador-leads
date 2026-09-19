import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listarProspects } from "@/lib/prospeccao";
import { CICLOS_EM_PROSPECCAO, ORIGENS, ROTULO_CICLO } from "@/lib/regras";
import { formatarDataPura, hojeComoDataPura } from "@/lib/datas";
import { Selo, Vazio, tempoRelativo } from "../componentes";
import { NovoProspect } from "./novo";
import { BuscarProspects, AtualizarSozinho } from "./buscar";
import { acaoCancelarBusca, acaoContinuarBusca } from "./acoes";
import { googleConfigurado } from "@/lib/pesquisa/google";
import { iaConfigurada } from "@/lib/pesquisa/ia";

// A busca automática analisa em segundo plano, dentro desta função: até 5 min.
export const maxDuration = 300;

/** Rodando sem avançar há mais de 90 s: a execução caiu no meio e pode ser retomada. */
function buscaParada(b: { status: string; atualizadoEm: Date }) {
  return b.status === "RODANDO" && Date.now() - b.atualizadoEm.getTime() > 90_000;
}

/**
 * Prospecção: quem abordar, quem retomar hoje, e em que pé está cada conversa.
 * "Retomar hoje" vem primeiro porque é a única parte da tela que pede ação.
 */
export default async function PaginaProspeccao({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sessao = await exigirAdmin();
  const { ver } = await searchParams;

  if (ver === "perdidos") return <Perdidos agenciaId={sessao.agenciaId} />;

  const [{ lista, paraHoje, perdidos }, buscas] = await Promise.all([
    listarProspects(sessao.agenciaId),
    prisma.buscaProspeccao.findMany({
      where: { agenciaId: sessao.agenciaId },
      orderBy: { criadoEm: "desc" },
      take: 3,
    }),
  ]);
  const hoje = hojeComoDataPura();
  const rodando = buscas.some((b) => b.status === "RODANDO");

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Prospecção</h1>
          <p className="mt-1 text-sm text-suave">
            {lista.length} em andamento
            {perdidos > 0 && (
              <>
                {" · "}
                <Link href="/prospeccao?ver=perdidos" className="underline">
                  {perdidos} perdido{perdidos > 1 ? "s" : ""}
                </Link>
              </>
            )}
          </p>
        </div>
      </div>

      <BuscarProspects google={googleConfigurado()} ia={iaConfigurada()} rodando={rodando} />
      <NovoProspect origens={ORIGENS} />

      {buscas.length > 0 && (
        <section className="mt-4 flex flex-col gap-2">
          {rodando && <AtualizarSozinho segundos={4} />}
          {buscas.map((b) => {
            const parada = buscaParada(b);
            return (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-borda bg-superficie px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {b.nicho} · {b.cidade}
                    <span className="ml-2 text-xs font-normal text-suave">
                      {b.fonte === "lista" ? "lista colada" : b.fonte === "osm" ? "mapa aberto" : "Google"}
                    </span>
                  </p>
                  <p className="text-xs text-suave">
                    {b.status === "RODANDO"
                      ? `Analisando ${b.analisados} de ${b.encontrados} · ${b.adicionados} em A abordar`
                      : b.erro && b.encontrados === 0
                        ? b.erro
                        : `${b.encontrados} analisadas · ${b.adicionados} em A abordar · ${tempoRelativo(b.criadoEm)}`}
                  </p>
                  {b.status === "RODANDO" && (
                    <div className="mt-1.5 h-1.5 w-48 max-w-full rounded-full bg-fundo">
                      <div
                        className="h-1.5 rounded-full bg-marca transition-all"
                        style={{ width: `${b.encontrados ? Math.round((b.analisados / b.encontrados) * 100) : 0}%` }}
                      />
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  {parada && (
                    <form action={acaoContinuarBusca}>
                      <input type="hidden" name="buscaId" value={b.id} />
                      <button type="submit" className="rounded-lg border border-borda px-2.5 py-1 text-xs">
                        Continuar
                      </button>
                    </form>
                  )}
                  {b.status === "RODANDO" && (
                    <form action={acaoCancelarBusca}>
                      <input type="hidden" name="buscaId" value={b.id} />
                      <button type="submit" className="rounded-lg px-2.5 py-1 text-xs text-suave">
                        Cancelar
                      </button>
                    </form>
                  )}
                  {b.encontrados > 0 && (
                    <Link href={`/prospeccao/buscas/${b.id}`} className="rounded-lg border border-borda px-2.5 py-1 text-xs">
                      Ver resultado
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {paraHoje.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-alerta">
            Retomar hoje <span className="text-xs font-normal">{paraHoje.length}</span>
          </h2>
          <div className="flex flex-col gap-2">
            {paraHoje.map((p) => (
              <Link
                key={p.id}
                href={`/prospeccao/${p.id}`}
                className="rounded-xl border border-alerta bg-superficie px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{p.nome}</p>
                  <Selo>{ROTULO_CICLO[p.ciclo]}</Selo>
                </div>
                <p className="mt-0.5 truncate text-xs text-suave">
                  {p.ultimaInteracao
                    ? `${tempoRelativo(p.ultimaInteracao.criadoEm)}: ${p.ultimaInteracao.descricao}`
                    : "Nenhum contato ainda"}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Funil em fita horizontal, como os outros pipelines do painel. */}
      <div className="mt-6 flex snap-x gap-3 overflow-x-auto pb-2">
        {CICLOS_EM_PROSPECCAO.map((etapa) => {
          const itens = lista.filter((p) => p.ciclo === etapa);
          return (
            <section
              key={etapa}
              className="w-[78vw] max-w-xs shrink-0 snap-start rounded-2xl border border-borda bg-superficie p-3 sm:w-60"
            >
              <header className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">{ROTULO_CICLO[etapa]}</h2>
                <span className="text-xs text-suave">{itens.length}</span>
              </header>
              <div className="mt-3 flex flex-col gap-2">
                {itens.length === 0 && <p className="text-xs text-suave">Vazio</p>}
                {itens.map((p) => {
                  const atrasado = p.proximoContato && p.proximoContato <= hoje;
                  return (
                    <Link
                      key={p.id}
                      href={`/prospeccao/${p.id}`}
                      className={`rounded-xl border px-3 py-2.5 ${atrasado ? "border-alerta" : "border-borda"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium">{p.nome}</p>
                        {p.pontuacao != null && (
                          <span
                            title="Nota da prospecção automática: chance de contratar"
                            className={`shrink-0 rounded-md px-1.5 text-xs font-semibold ${
                              p.pontuacao >= 70 ? "bg-marca text-sobre-marca" : "bg-fundo text-suave"
                            }`}
                          >
                            {p.pontuacao}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-suave">
                        {[p.nicho, p.origem].filter(Boolean).join(" · ") || "sem nicho anotado"}
                      </p>
                      {p.proximoContato && (
                        <div className="mt-2">
                          <Selo tom={atrasado ? "alerta" : "neutro"}>
                            retomar {formatarDataPura(p.proximoContato)}
                          </Selo>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {lista.length === 0 && (
        <div className="mt-4">
          <Vazio>Nenhum prospect em andamento. Cadastre o primeiro acima.</Vazio>
        </div>
      )}
    </>
  );
}

/** Perdidos, com o motivo: é daqui que sai o ajuste de oferta e de abordagem. */
async function Perdidos({ agenciaId }: { agenciaId: string }) {
  const perdidos = await prisma.cliente.findMany({
    where: { agenciaId, ativo: true, ciclo: "PERDIDO" },
    orderBy: { criadoEm: "desc" },
    select: { id: true, nome: true, nicho: true, motivoPerda: true },
  });

  return (
    <>
      <Link href="/prospeccao" className="text-sm text-suave">
        ← Prospecção
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">Perdidos</h1>
      <p className="mt-1 text-sm text-suave">
        O que se repete nos motivos é o que ajustar na oferta.
      </p>
      <div className="mt-5 flex flex-col gap-2">
        {perdidos.length === 0 && <Vazio>Nenhum prospect perdido.</Vazio>}
        {perdidos.map((p) => (
          <Link
            key={p.id}
            href={`/prospeccao/${p.id}`}
            className="rounded-xl border border-borda bg-superficie px-3 py-2.5"
          >
            <p className="text-sm font-medium">{p.nome}</p>
            {p.nicho && <p className="text-xs text-suave">{p.nicho}</p>}
            {p.motivoPerda && <p className="mt-1 text-sm text-suave">“{p.motivoPerda}”</p>}
          </Link>
        ))}
      </div>
    </>
  );
}
