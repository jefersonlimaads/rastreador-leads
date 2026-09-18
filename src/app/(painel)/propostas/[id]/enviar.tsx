"use client";

import { useState, useTransition } from "react";
import { acaoEnviarProposta } from "../acoes";

/**
 * Enviar é gerar o link e mandar. O link existe desde a criação, mas só passa
 * a contar como enviado quando você pega ele aqui — antes disso é rascunho.
 */
export function EnviarProposta({
  propostaId,
  jaEnviada,
  linkPublico,
  telefone,
  contato,
}: {
  propostaId: string;
  jaEnviada: boolean;
  linkPublico: string;
  telefone: string | null;
  contato: string | null;
}) {
  const [link, setLink] = useState<string | null>(jaEnviada ? linkPublico : null);
  const [copiado, setCopiado] = useState(false);
  const [enviando, iniciar] = useTransition();

  const texto = `${contato ? `${contato}, ` : ""}segue a proposta que conversamos: ${link ?? ""}`;

  return (
    <section className="mt-5 rounded-2xl border border-borda bg-superficie p-4">
      {!link ? (
        <>
          <p className="text-sm text-suave">
            Enquanto é rascunho, só você vê. Enviar gera o link e move o prospect para
            &quot;proposta enviada&quot; no Negócio.
          </p>
          <button
            type="button"
            disabled={enviando}
            onClick={() =>
              iniciar(async () => {
                const url = await acaoEnviarProposta(propostaId);
                setLink(url);
                try {
                  await navigator.clipboard.writeText(url);
                  setCopiado(true);
                } catch {
                  // Sem permissão de área de transferência: o link fica visível.
                }
              })
            }
            className="mt-3 w-full rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca disabled:opacity-60"
          >
            {enviando ? "Gerando link..." : "Gerar link para enviar"}
          </button>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="break-all rounded-xl bg-fundo px-3 py-2 text-xs text-suave">{link}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopiado(true);
              }}
              className="rounded-xl border border-borda px-3 py-2 text-sm"
            >
              {copiado ? "Copiado" : "Copiar link"}
            </button>
            {telefone && (
              <a
                href={`https://wa.me/${telefone}?text=${encodeURIComponent(texto)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-marca px-3 py-2 text-sm font-medium text-sobre-marca"
              >
                Mandar no WhatsApp
              </a>
            )}
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-borda px-3 py-2 text-sm"
            >
              Ver como o lead vê
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
