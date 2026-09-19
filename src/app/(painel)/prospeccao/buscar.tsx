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
 * Prospecção automática em duas formas, ambas gratuitas:
 * - Buscar no mapa: nicho + cidade no mapa aberto (ou no Google, se houver chave).
 * - Colar lista: as empresas que você mesmo juntou, uma por linha.
 * Nos dois casos, cada empresa é analisada e quem passa da nota mínima cai em
 * "A abordar" com briefing e mensagem sugerida.
 */
export function BuscarProspects({ google, ia, rodando }: { google: boolean; ia: boolean; rodando: boolean }) {
  const [estado, buscar, buscando] = useActionState(acaoBuscarProspects, vazio);
  const [aberto, setAberto] = useState(false);
  const [modo, setModo] = useState<"mapa" | "lista">("mapa");
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
          {rodando ? "Analisando prospects..." : "Buscar prospects automaticamente"}
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

      <div className="inline-flex self-start rounded-xl border border-borda bg-fundo p-1 text-sm">
        {(
          [
            ["mapa", "Buscar no mapa"],
            ["lista", "Colar lista"],
          ] as const
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setModo(valor)}
            className={`rounded-lg px-3.5 py-1.5 ${modo === valor ? "bg-marca font-medium text-sobre-marca" : "text-suave"}`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      <p className="text-sm text-suave">
        {modo === "mapa"
          ? google
            ? "Busca as empresas no Google e analisa site e presença de cada uma."
            : "Busca as empresas no mapa aberto (OpenStreetMap), de graça. Ele não tem todas as empresas da cidade: para cobrir as que faltarem, use Colar lista."
          : "Cole uma empresa por linha — nome, telefone, site ou @ do Instagram, na ordem que vier. Dá para copiar direto do Google Maps ou do Instagram."}
      </p>

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
          <span className="text-suave">Cidade</span>
          <input name="cidade" required placeholder="Campinas, SP" className={campo} />
        </label>
        {modo === "mapa" && (
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-suave">Quantas empresas analisar</span>
            <select name="quantidade" defaultValue="20" className={campo}>
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="30">30</option>
            </select>
          </label>
        )}
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

      {modo === "lista" && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-suave">Empresas (até 50, uma por linha)</span>
          <textarea
            name="lista"
            required
            rows={7}
            placeholder={"Clínica Bella Pele, (19) 99812-3344, bellapele.com.br\nEspaço Renova — @espacorenova\nStudio Face Design 19 3232-1010"}
            className={`${campo} font-mono text-xs`}
          />
        </label>
      )}

      {estado.erro && <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>}
      <button
        type="submit"
        disabled={buscando}
        className="rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca disabled:opacity-60"
      >
        {buscando ? (modo === "mapa" ? "Buscando no mapa... pode levar até 1 minuto" : "Lendo a lista...") : modo === "mapa" ? "Buscar" : "Analisar lista"}
      </button>
      <p className="text-xs text-suave">
        Gratuito. Empresas que você já tem ou que já foram pesquisadas não voltam.
        {ia ? " A análise usa IA para personalizar briefing e mensagem." : " Nota, briefing e mensagem saem pela regra da plataforma."}
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
