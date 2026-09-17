"use client";

import { useActionState, useState } from "react";
import { acaoMudarStatus, type EstadoStatus } from "../../acoes";
import { ROTULO_STATUS } from "@/lib/regras";

const STATUS = ["NOVO", "EM_ATENDIMENTO", "ORCAMENTO_ENVIADO", "FECHADO", "PERDIDO"] as const;

const estadoInicial: EstadoStatus = {};

export function PainelStatus({
  leadId,
  status,
  podeFechar,
  valorAtual,
  motivoAtual,
}: {
  leadId: string;
  status: string;
  podeFechar: boolean;
  valorAtual: number | null;
  motivoAtual: string | null;
}) {
  const [estado, acao, enviando] = useActionState(acaoMudarStatus, estadoInicial);
  const [escolhido, setEscolhido] = useState(status);

  return (
    <form action={acao} className="mt-5 rounded-2xl border border-borda bg-superficie p-4">
      <input type="hidden" name="leadId" value={leadId} />
      <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">Status</h2>

      <div className="mt-3 flex flex-wrap gap-2">
        {STATUS.map((s) => {
          const ativo = escolhido === s;
          const bloqueado = s === "FECHADO" && !podeFechar;
          return (
            <button
              key={s}
              type="button"
              disabled={bloqueado}
              onClick={() => setEscolhido(s)}
              className={`rounded-xl border px-3 py-2 text-sm ${
                ativo ? "border-marca bg-marca-suave font-medium text-marca" : "border-borda"
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
        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-sm text-suave">Motivo da perda</span>
          <input
            name="motivoPerda"
            required
            defaultValue={motivoAtual ?? ""}
            placeholder="Preço, prazo, sumiu..."
            className="rounded-xl border border-borda bg-fundo px-3 py-2.5 outline-none focus:border-marca"
          />
        </label>
      )}

      {estado.erro && (
        <p className="mt-3 rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>
      )}

      {escolhido !== status || estado.erro ? (
        <button
          type="submit"
          disabled={enviando}
          className="mt-4 w-full rounded-xl bg-marca px-4 py-2.5 font-medium text-white disabled:opacity-60"
        >
          {enviando ? "Salvando..." : `Mudar para ${ROTULO_STATUS[escolhido]}`}
        </button>
      ) : null}
    </form>
  );
}
