"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Tela de erro do painel, no lugar da genérica em inglês. Mostra o código do
 * erro, que é o que se procura nos logs da Vercel para achar a causa.
 */
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[painel]", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 py-16">
      <div className="h-1 w-12 bg-marca" />
      <h1 className="text-xl font-semibold tracking-tight">Essa tela não carregou.</h1>
      <p className="text-sm text-suave">
        Pode ter sido uma atualização entrando no ar. Tente de novo em alguns segundos. Se
        continuar, mande o código abaixo que dá para achar a causa exata.
      </p>
      {error.digest && (
        <p className="rounded-xl bg-superficie px-3 py-2 font-mono text-sm">código {error.digest}</p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="flex-1 rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca"
        >
          Tentar de novo
        </button>
        <Link href="/negocio" className="rounded-xl border border-borda px-4 py-2.5 text-sm">
          Início
        </Link>
      </div>
    </div>
  );
}
