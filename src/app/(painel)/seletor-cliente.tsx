"use client";

import { useRef } from "react";
import { acaoTrocarCliente } from "./acoes";

/**
 * Só aparece para o administrador. A escolha fica num cookie, então vale em todas
 * as telas sem precisar carregar o cliente na URL. Os demais papéis ficam presos
 * ao próprio cliente, e isso é conferido no servidor a cada consulta.
 */
export function SeletorCliente({
  clientes,
  atual,
}: {
  clientes: { id: string; nome: string }[];
  atual: string | null;
}) {
  const formulario = useRef<HTMLFormElement>(null);

  if (clientes.length === 0) return null;

  return (
    <form action={acaoTrocarCliente} ref={formulario}>
      <select
        name="clienteId"
        aria-label="Cliente"
        defaultValue={atual ?? ""}
        onChange={() => formulario.current?.requestSubmit()}
        className="max-w-[10rem] truncate rounded-lg border border-borda bg-superficie px-2 py-1 text-sm"
      >
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
    </form>
  );
}
