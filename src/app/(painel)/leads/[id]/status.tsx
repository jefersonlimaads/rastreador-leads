"use client";

import { Formulario } from "@/app/formulario";
import { useActionState, useState } from "react";
import { acaoMudarStatus, type EstadoStatus } from "../../acoes";
import { MOTIVOS_PERDA, ROTULO_STATUS } from "@/lib/regras";

const estadoInicial: EstadoStatus = {};

export function PainelStatus({
  leadId,
  etapas,
  status,
  podeFechar,
  valorAtual,
  motivoAtual,
  categoriaAtual,
}: {
  leadId: string;
  etapas: string[];
  status: string;
  podeFechar: boolean;
  valorAtual: number | null;
  motivoAtual: string | null;
  categoriaAtual: string | null;
}) {
  const [estado, acao, enviando] = useActionState(acaoMudarStatus, estadoInicial);
  const [escolhido, setEscolhido] = useState(status);

  return (
    <Formulario acao={acao} className="mt-5 rounded-2xl border border-borda bg-superficie p-4">
      <input type="hidden" name="leadId" value={leadId} />
      <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">Status</h2>

      <div className="mt-3 flex flex-wrap gap-2">
        {etapas.map((s) => {
          const ativo = escolhido === s;
          const bloqueado = s === "FECHADO" && !podeFechar;
          return (
            <button
              key={s}
              type="button"
              disabled={bloqueado}
              onClick={() => setEscolhido(s)}
              className={`rounded-xl border px-3 py-2 text-sm ${
                ativo ? "border-marca bg-marca-suave font-medium text-marca-texto" : "border-borda"
              } ${bloqueado ? "opacity-40" : ""}`}
            >
              {ROTULO_STATUS[s]}
            </button>
          );
        })}
      </div>
      <input type="hidden" name="status" value={escolhido} />

      {/* Regra 7: fechado exige valor, perdido exige motivo. */}
      {escolhido === "FECHADO" && (
        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-sm text-suave">Valor da venda (R$)</span>
          <input
            name="valorVenda"
            inputMode="decimal"
            required
            defaultValue={valorAtual ?? ""}
            placeholder="2000,00"
            className="rounded-xl border border-borda bg-fundo px-3 py-2.5 outline-none focus:border-marca"
          />
        </label>
      )}

      {escolhido === "PERDIDO" && (
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-suave">Motivo da perda</span>
            {/* Lista fechada: texto livre não se compara entre campanhas, e é a
                comparação que diz se o problema é anúncio ou atendimento. */}
            <select
              name="motivoPerdaCategoria"
              required
              defaultValue={categoriaAtual ?? ""}
              className="rounded-xl border border-borda bg-fundo px-3 py-2.5 outline-none focus:border-marca"
            >
              <option value="">Escolha...</option>
              {MOTIVOS_PERDA.map((m) => (
                <option key={m.chave} value={m.chave}>
                  {m.rotulo}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-suave">Observação (opcional)</span>
            <input
              name="motivoPerda"
              defaultValue={motivoAtual ?? ""}
              placeholder="O detalhe que o motivo não conta"
              className="rounded-xl border border-borda bg-fundo px-3 py-2.5 outline-none focus:border-marca"
            />
          </label>
        </div>
      )}

      {estado.erro && (
        <p className="mt-3 rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>
      )}

      {escolhido !== status || estado.erro ? (
        <button
          type="submit"
          disabled={enviando}
          className="mt-4 w-full rounded-xl bg-marca px-4 py-2.5 font-medium text-sobre-marca disabled:opacity-60"
        >
          {enviando ? "Salvando..." : `Mudar para ${ROTULO_STATUS[escolhido]}`}
        </button>
      ) : null}
    </Formulario>
  );
}
