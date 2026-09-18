import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listarProspects } from "@/lib/prospeccao";
import { CICLOS_EM_PROSPECCAO, ORIGENS, ROTULO_CICLO } from "@/lib/regras";
import { formatarDataPura, hojeComoDataPura } from "@/lib/datas";
import { Selo, Vazio, tempoRelativo } from "../componentes";
import { NovoProspect } from "./novo";

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

  const { lista, paraHoje, perdidos } = await listarProspects(sessao.agenciaId);
  const hoje = hojeComoDataPura();

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

      <NovoProspect origens={ORIGENS} />

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
                      <p className="truncate text-sm font-medium">{p.nome}</p>
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
