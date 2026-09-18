"use client";

import { useTransition } from "react";
import { acaoGerarFaturas, acaoMarcarPaga } from "./acoes";

export function BotaoGerarFaturas() {
  const [gerando, iniciar] = useTransition();

  return (
    <button
      type="button"
      disabled={gerando}
      onClick={() => iniciar(async () => void (await acaoGerarFaturas()))}
      className="shrink-0 rounded-xl border border-borda px-3 py-2 text-sm disabled:opacity-60"
    >
      {gerando ? "Gerando..." : "Gerar faturas do mês"}
    </button>
  );
}

/** Marcar pago e desmarcar são o mesmo botão: erro de toque não vira trabalho. */
export function BotaoPagar({
  faturaId,
  paga,
  valor,
}: {
  faturaId: string;
  paga: boolean;
  valor: string;
}) {
  return (
    <form action={acaoMarcarPaga}>
      <input type="hidden" name="faturaId" value={faturaId} />
      <button
        type="submit"
        className={`rounded-xl px-3 py-2 text-sm font-medium ${
          paga ? "border border-borda" : "bg-marca text-sobre-marca"
        }`}
      >
        {paga ? "Desfazer pagamento" : `Recebi ${valor}`}
      </button>
    </form>
  );
}
