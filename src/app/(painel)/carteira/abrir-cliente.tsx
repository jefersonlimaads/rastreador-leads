"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { acaoTrocarCliente } from "../acoes";

/**
 * Troca o cliente em foco e já leva para a fila do dia dele. É o gesto central
 * de quem gere vários clientes: da carteira, entra em um.
 */
export function AbrirCliente({ clienteId }: { clienteId: string }) {
  const router = useRouter();
  const [trocando, iniciar] = useTransition();

  return (
    <button
      type="button"
      disabled={trocando}
      onClick={() =>
        iniciar(async () => {
          const dados = new FormData();
          dados.set("clienteId", clienteId);
          await acaoTrocarCliente(dados);
          router.push("/hoje");
        })
      }
      className="shrink-0 rounded-xl bg-marca px-3 py-2 text-sm font-medium text-sobre-marca disabled:opacity-60"
    >
      {trocando ? "Abrindo..." : "Abrir"}
    </button>
  );
}
