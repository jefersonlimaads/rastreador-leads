"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ambienteDaRota } from "./navegacao";

/**
 * O cabeçalho diz onde você está. No ambiente da jl.ads, mostra a marca. Dentro
 * de um cliente, mostra o nome dele e o caminho de volta — sem isso, dá para
 * mexer no cliente errado sem perceber.
 */
export function Cabecalho({
  ehAdmin,
  nomeDoCliente,
}: {
  ehAdmin: boolean;
  nomeDoCliente: string | null;
}) {
  const caminho = usePathname();
  const ambiente = ehAdmin ? ambienteDaRota(caminho) : "cliente";

  if (ambiente === "jlads" || !ehAdmin) {
    return (
      <Link href={ehAdmin ? "/negocio" : "/hoje"} className="font-titulo text-lg font-bold tracking-tight">
        jl<span className="text-marca-texto">.</span>ads
      </Link>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Link
        href="/carteira"
        aria-label="Voltar para jl.ads"
        className="shrink-0 rounded-lg border border-borda px-2 py-1 text-sm text-suave"
      >
        ←
      </Link>
      <div className="min-w-0">
        <p className="truncate font-titulo text-base font-bold leading-tight">
          {nomeDoCliente ?? "Cliente"}
        </p>
        <p className="text-xs leading-tight text-suave">cliente</p>
      </div>
    </div>
  );
}
