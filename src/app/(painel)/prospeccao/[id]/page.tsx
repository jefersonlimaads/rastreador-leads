import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CICLOS_ANTES_DA_PROPOSTA,
  ORIGENS,
  ROTULO_CICLO,
  ROTULO_INTERACAO,
} from "@/lib/regras";
import { formatarDataHora, formatarDataPura } from "@/lib/datas";
import { formatarTelefone } from "@/lib/telefone";
import { ROTULO_SITUACAO, situacao } from "@/lib/propostas";
import { Selo } from "../../componentes";
import { FichaProspect, RegistrarContato, SaidaDoFunil } from "./formularios";

export default async function PaginaProspect({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await exigirAdmin();
  const { id } = await params;

  const p = await prisma.cliente.findFirst({
    where: { id, agenciaId: sessao.agenciaId },
    include: {
      interacoes: { orderBy: { criadoEm: "desc" }, take: 50 },
      propostas: { orderBy: { criadoEm: "desc" } },
      _count: { select: { leads: true, cliques: true, faturas: true } },
    },
  });
  if (!p) notFound();

  const etapaManual = (CICLOS_ANTES_DA_PROPOSTA as readonly string[]).includes(p.ciclo);
  const perdido = p.ciclo === "PERDIDO";
  const temHistorico =
    p._count.leads + p._count.cliques + p._count.faturas > 0 ||
    p.propostas.some((x) => x.status === "ACEITA");

  return (
    <>
      <Link href="/prospeccao" className="text-sm text-suave">
        ← Prospecção
      </Link>

      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{p.nome}</h1>
          <p className="mt-0.5 text-sm text-suave">
            {[p.nicho, p.origem, p.proximoContato ? `retomar ${formatarDataPura(p.proximoContato)}` : null]
              .filter(Boolean)
              .join(" · ") || "Complete a ficha abaixo"}
          </p>
        </div>
        <Selo tom={perdido ? "alerta" : "marca"}>{ROTULO_CICLO[p.ciclo]}</Selo>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {p.contatoTelefone && (
          <a
            href={`https://wa.me/${p.contatoTelefone}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl bg-marca px-3 py-2 text-sm font-medium text-sobre-marca"
          >
            WhatsApp
          </a>
        )}
        {p.instagram && (
          <a
            href={`https://instagram.com/${p.instagram}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-borda px-3 py-2 text-sm"
          >
            @{p.instagram}
          </a>
        )}
        {!perdido && (
          <Link
            href={`/propostas/nova?cliente=${p.id}`}
            className="rounded-xl border border-borda px-3 py-2 text-sm"
          >
            Nova proposta
          </Link>
        )}
      </div>

      {perdido && p.motivoPerda && (
        <p className="mt-4 rounded-xl border border-alerta bg-alerta-suave px-3 py-2 text-sm text-alerta">
          Perdido: {p.motivoPerda}
        </p>
      )}

      {!perdido && (
        <RegistrarContato
          clienteId={p.id}
          etapaAtual={p.ciclo}
          etapaManual={etapaManual}
          etapas={CICLOS_ANTES_DA_PROPOSTA.map((e) => ({ valor: e, rotulo: ROTULO_CICLO[e] }))}
          tipos={Object.entries(ROTULO_INTERACAO).map(([valor, rotulo]) => ({ valor, rotulo }))}
        />
      )}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-suave">Histórico</h2>
        {p.interacoes.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-borda px-4 py-6 text-center text-sm text-suave">
            Nenhum contato registrado. O primeiro vai aqui em cima.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {p.interacoes.map((i) => (
              <li key={i.id} className="rounded-xl border border-borda bg-superficie px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{ROTULO_INTERACAO[i.tipo]}</span>
                  <span className="shrink-0 text-xs text-suave">{formatarDataHora(i.criadoEm)}</span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-suave">{i.descricao}</p>
              </li>
            ))}
          </ol>
        )}
      </section>

      {p.propostas.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-suave">Propostas</h2>
          <div className="flex flex-col gap-2">
            {p.propostas.map((x) => (
              <Link
                key={x.id}
                href={`/propostas/${x.id}`}
                className="flex items-center justify-between gap-2 rounded-xl border border-borda bg-superficie px-3 py-2.5"
              >
                <span className="truncate text-sm">{x.titulo}</span>
                <Selo>{ROTULO_SITUACAO[situacao(x)]}</Selo>
              </Link>
            ))}
          </div>
        </section>
      )}

      <FichaProspect
        prospect={{
          id: p.id,
          nome: p.nome,
          nicho: p.nicho ?? "",
          origem: p.origem ?? "",
          contatoNome: p.contatoNome ?? "",
          contatoTelefone: p.contatoTelefone ? formatarTelefone(p.contatoTelefone) : "",
          contatoEmail: p.contatoEmail ?? "",
          instagram: p.instagram ?? "",
          site: p.site ?? "",
          observacoes: p.observacoes ?? "",
        }}
        origens={ORIGENS}
      />

      <SaidaDoFunil clienteId={p.id} perdido={perdido} podeExcluir={!temHistorico} />
    </>
  );
}
