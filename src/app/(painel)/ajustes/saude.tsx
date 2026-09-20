import type { SaudeCliente } from "@/lib/saude-cliente";

/** Semáforo da implantação: o que já está de pé e o que falta para os números fecharem. */
export function PainelSaude({ saude }: { saude: SaudeCliente }) {
  return (
    <div className="flex flex-col gap-2">
      {saude.rastreamentoParado && (
        <p className="rounded-xl bg-alerta-suave px-3 py-2 text-sm text-alerta">
          <strong>Rastreamento parado.</strong> Saíram{" "}
          {saude.rastreamentoParado.gasto.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} em anúncios
          nas últimas {saude.rastreamentoParado.horas}h e nenhuma visita foi registrada. Normalmente é o script fora da
          página, depois de uma publicação do site.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {saude.itens.map((i) => (
          <li key={i.chave} className="flex items-start gap-2 text-sm">
            <span
              aria-hidden
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                i.estado === "ok" ? "bg-ok" : i.estado === "alerta" ? "bg-alerta" : "bg-suave"
              }`}
            />
            <span className="min-w-0">
              <span className="font-medium">{i.titulo}</span>
              <span className="text-suave"> · {i.detalhe}</span>
              {i.estado !== "ok" && i.comoResolver && (
                <span className="block text-xs text-suave">{i.comoResolver}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
