"use client";

/** Salvar em PDF pelo próprio navegador: funciona igual no celular e no computador. */
export function BotaoImprimir({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      {children ?? "Baixar PDF"}
    </button>
  );
}
