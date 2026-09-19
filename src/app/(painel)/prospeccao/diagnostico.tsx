import type { Diagnostico } from "@prisma/client";
import { linkBibliotecaAnuncios, type SinaisSite } from "@/lib/pesquisa/site";
import { normalizarTelefone } from "@/lib/telefone";
import { BotaoCopiar } from "./copiar";

/**
 * O que a prospecção automática descobriu sobre o prospect, na ordem em que
 * se usa: nota e resumo, gaps, o briefing para ler antes de abordar e a
 * mensagem pronta para mandar.
 */
export function PainelDiagnostico({ d }: { d: Diagnostico }) {
  const sinais = d.sinais as SinaisSite | null;
  const gaps = (Array.isArray(d.gaps) ? d.gaps : []) as string[];
  const telefone = d.telefone ? normalizarTelefone(d.telefone) : null;
  const instagram = d.instagram ?? sinais?.instagram ?? null;

  return (
    <section className="mt-5 rounded-2xl border border-borda bg-superficie p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">Diagnóstico</h2>
          {d.resumo && <p className="mt-1 text-sm">{d.resumo}</p>}
        </div>
        {d.pontuacao != null && (
          <div className="shrink-0 text-center">
            <p className={`font-titulo text-3xl font-bold ${d.pontuacao >= 70 ? "text-marca-texto" : ""}`}>
              {d.pontuacao}
            </p>
            <p className="text-[11px] text-suave">de 100</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {d.site && (
          <a href={d.site} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-borda px-2.5 py-1">
            Site
          </a>
        )}
        {instagram && (
          <a
            href={`https://instagram.com/${instagram}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-borda px-2.5 py-1"
          >
            @{instagram}
          </a>
        )}
        {d.mapsUrl && (
          <a href={d.mapsUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-borda px-2.5 py-1">
            Google Maps
            {d.notaGoogle != null ? ` · ${d.notaGoogle.toFixed(1)}★ (${d.avaliacoes ?? 0})` : ""}
          </a>
        )}
        <a
          href={linkBibliotecaAnuncios(d.nome)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-borda px-2.5 py-1"
          title="Confira se já anuncia no Meta"
        >
          Biblioteca de Anúncios
        </a>
      </div>

      {sinais && (
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
          {sinais.situacao !== "ok" ? (
            <Sinal ok={false} rotulo={sinais.situacao === "sem_site" ? "Sem site" : "Site fora do ar"} />
          ) : (
            <>
              <Sinal ok={sinais.pixelMeta} incerto={sinais.naoConfirmavel} rotulo="Pixel do Meta" />
              <Sinal ok={sinais.googleTag || sinais.gtm} incerto={sinais.naoConfirmavel} rotulo="Tag do Google" />
              <Sinal ok={sinais.botaoWhatsapp} incerto={sinais.naoConfirmavel} rotulo="Botão de WhatsApp" />
              <Sinal ok={sinais.formulario} rotulo="Formulário" />
              <Sinal ok={sinais.https} rotulo="Site seguro (https)" />
              {sinais.plataforma && <li className="text-suave">Feito em {sinais.plataforma}</li>}
            </>
          )}
        </ul>
      )}
      {sinais?.naoConfirmavel && (
        <p className="mt-2 text-xs text-suave">
          ? = não dá para confirmar pela leitura do site ({sinais.plataforma ?? "carrega por script"}). Antes de citar,
          confira com a extensão Meta Pixel Helper do Chrome.
        </p>
      )}

      {gaps.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium">Gaps</p>
          <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-sm">
            {gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      )}

      {d.briefing && (
        <details className="mt-4" open>
          <summary className="cursor-pointer text-sm font-medium">Briefing de abordagem</summary>
          <p className="mt-2 whitespace-pre-line rounded-xl bg-fundo p-3 text-sm leading-relaxed">{d.briefing}</p>
        </details>
      )}

      {d.mensagem && (
        <div className="mt-4">
          <p className="text-sm font-medium">Mensagem sugerida</p>
          <p className="mt-2 whitespace-pre-line rounded-xl border border-borda p-3 text-sm leading-relaxed">
            {d.mensagem}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {telefone && (
              <a
                href={`https://wa.me/${telefone}?text=${encodeURIComponent(d.mensagem)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-marca px-3.5 py-2 text-sm font-medium text-sobre-marca"
              >
                Abrir WhatsApp com a mensagem
              </a>
            )}
            <BotaoCopiar texto={d.mensagem} rotulo="Copiar (para Direct ou e-mail)" />
          </div>
          <p className="mt-2 text-xs text-suave">
            Revise antes de mandar. Depois, registre a abordagem logo abaixo para a etapa andar.
          </p>
        </div>
      )}

      <p className="mt-4 text-[11px] text-suave">
        {d.analisadoPorIa ? "Análise feita com IA" : "Análise por regra fixa (sem IA)"}
        {d.analisadoEm ? ` em ${d.analisadoEm.toLocaleDateString("pt-BR")}` : ""} a partir de dados públicos
        {d.placeId.startsWith("osm:") ? " do mapa aberto (OpenStreetMap)" : d.placeId.startsWith("lista:") ? " da lista colada" : " do Google"} e
        do site.
      </p>
    </section>
  );
}

function Sinal({ ok, rotulo, incerto }: { ok: boolean; rotulo: string; incerto?: boolean }) {
  // Achou, é certo; não achou num site montado por script, é dúvida.
  const duvida = !ok && incerto;
  return (
    <li className="flex items-center gap-1.5">
      <span className={ok ? "text-ok" : duvida ? "text-suave" : "text-alerta"}>{ok ? "✓" : duvida ? "?" : "✗"}</span>
      <span className={ok ? "" : "text-suave"}>{rotulo}</span>
    </li>
  );
}
