"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Formulario } from "@/app/formulario";
import { acaoBuscarProspects, type EstadoProspeccao } from "./acoes";

const vazio: EstadoProspeccao = {};
const campo =
  "w-full rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm outline-none focus:border-marca";

const SUGESTOES = [
  "clínica de estética",
  "clínica odontológica",
  "psicólogo",
  "nutricionista",
  "fisioterapia",
  "advogado",
  "arquitetura e interiores",
  "estúdio de pilates",
  "academia",
  "salão de beleza",
  "pet shop",
  "imobiliária",
  "escola de idiomas",
  "filmmaker",
];

/**
 * Busca de prospects: nicho + cidade no Google, e a análise de cada empresa
 * roda sozinha. Quem passa da nota mínima cai em "A abordar" com briefing e
 * mensagem sugerida.
 */
export function BuscarProspects({ google, ia, rodando }: { google: boolean; ia: boolean; rodando: boolean }) {
  const [estado, buscar, buscando] = useActionState(acaoBuscarProspects, vazio);
  const [aberto, setAberto] = useState(false);
  // Busca iniciada, fecha o formulário: o andamento aparece logo abaixo.
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    if (estado.ok) setAberto(false);
  }

  if (!aberto) {
    return (
      <div className="mt-4 flex flex-col gap-2">
        {estado.ok && <p className="rounded-lg bg-ok-suave px-3 py-2 text-sm text-ok">{estado.ok}</p>}
        <button
          type="button"
          onClick={() => setAberto(true)}
          disabled={rodando}
          className="rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca disabled:opacity-60 sm:self-start"
        >
          {rodando ? "Buscando prospects..." : "Buscar prospects automaticamente"}
        </button>
      </div>
    );
  }

  return (
    <Formulario acao={buscar} className="mt-4 flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Buscar prospects</h2>
        <button type="button" onClick={() => setAberto(false)} className="text-sm text-suave">
          Fechar
        </button>
      </div>
      <p className="text-sm text-suave">
        Busca no Google, analisa o site e a presença de cada empresa e põe em A abordar quem tem mais
        chance de contratar — com briefing e mensagem sugerida.
      </p>
      {!google && (
        <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">
          Falta a chave do Google (GOOGLE_PLACES_API_KEY) na Vercel: a busca não funciona sem ela.
        </p>
      )}
      {google && !ia && (
        <p className="rounded-lg bg-fundo px-3 py-2 text-xs text-suave">
          Sem a chave do Claude (ANTHROPIC_API_KEY), a nota e a mensagem saem por regra fixa — funcionam,
          mas sem a personalização da IA.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-suave">Nicho</span>
          <input name="nicho" list="nichos" required placeholder="clínica de estética" className={campo} />
          <datalist id="nichos">
            {SUGESTOES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-suave">Cidade (e bairro, se quiser)</span>
          <input name="cidade" required placeholder="Campinas, SP" className={campo} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-suave">Quantas empresas analisar</span>
          <select name="quantidade" defaultValue="20" className={campo}>
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="30">30</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-suave">Nota mínima para entrar em A abordar</span>
          <select name="notaMinima" defaultValue="50" className={campo}>
            <option value="40">40 — mais prospects, menos filtro</option>
            <option value="50">50 — equilibrado</option>
            <option value="60">60 — mais exigente</option>
            <option value="70">70 — só os melhores</option>
          </select>
        </label>
      </div>
      {estado.erro && <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>}
      <button
        type="submit"
        disabled={buscando || !google}
        className="rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca disabled:opacity-60"
      >
        {buscando ? "Buscando no Google..." : "Buscar"}
      </button>
      <p className="text-xs text-suave">
        Empresas que você já tem ou que já foram pesquisadas não voltam. Custo aproximado: alguns
        centavos por empresa.
      </p>
    </Formulario>
  );
}

/** Enquanto uma busca roda, a tela se atualiza sozinha para mostrar o andamento. */
export function AtualizarSozinho({ segundos }: { segundos: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), segundos * 1000);
    return () => clearInterval(t);
  }, [router, segundos]);
  return null;
}
