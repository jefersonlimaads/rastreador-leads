"use client";

import { useActionState, useState } from "react";
import { Formulario } from "@/app/formulario";
import { BotaoImprimir } from "@/app/relatorio/imprimir";
import { acaoCriarRelatorio, type EstadoRelatorio } from "./acoes";

const vazio: EstadoRelatorio = {};

/**
 * Gera o link do período escolhido. O resumo escrito aqui abre o relatório:
 * é onde você conta o que os números significam antes do cliente tirar a
 * própria conclusão.
 */
export function EnviarRelatorio({
  clienteId,
  de,
  ate,
  rotuloPeriodo,
  whatsapp,
  contato,
}: {
  clienteId: string;
  de: string;
  ate: string;
  rotuloPeriodo: string;
  whatsapp: string | null;
  contato: string | null;
}) {
  const [estado, criar, criando] = useActionState(acaoCriarRelatorio, vazio);
  const [copiado, setCopiado] = useState(false);
  const link = estado.ok?.url;
  // Link gerado para outro período não vale para o que está na tela agora.
  const [periodoDoLink, setPeriodoDoLink] = useState<string | null>(null);
  const atual = `${de}|${ate}`;
  const mostrarLink = link && periodoDoLink === atual;

  const saudacao = contato ? `Oi, ${contato.split(" ")[0]}!` : "Oi!";
  const texto = `${saudacao} Segue o relatório de resultados de ${rotuloPeriodo}: ${link ?? ""}`;

  return (
    <section className="nao-imprimir rounded-2xl border border-borda bg-superficie p-4">
      <h2 className="font-semibold">Enviar para o cliente</h2>
      <Formulario
        acao={(dados) => {
          setPeriodoDoLink(atual);
          setCopiado(false);
          criar(dados);
        }}
        className="mt-3 flex flex-col gap-3"
      >
        <input type="hidden" name="clienteId" value={clienteId} />
        <input type="hidden" name="de" value={de} />
        <input type="hidden" name="ate" value={ate} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-suave">Resumo do período (opcional, aparece no topo)</span>
          <textarea
            name="comentario"
            rows={3}
            maxLength={3000}
            placeholder="Ex.: Mês com o menor custo por contato do ano. A campanha de implante puxou o resultado; para outubro vamos testar novos criativos de clareamento."
            className="w-full rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm outline-none focus:border-marca"
          />
        </label>
        {estado.erro && (
          <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={criando}
            className="rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca disabled:opacity-60"
          >
            {criando ? "Gerando..." : "Gerar link do relatório"}
          </button>
          <BotaoImprimir className="rounded-xl border border-borda px-4 py-2.5 text-sm">
            Baixar PDF
          </BotaoImprimir>
        </div>
      </Formulario>

      {mostrarLink && (
        <div className="mt-4 flex flex-col gap-2 border-t border-borda pt-4">
          <p className="text-sm text-suave">
            Link pronto. O cliente abre sem senha e pode salvar em PDF por lá.
          </p>
          <p className="break-all rounded-xl bg-fundo px-3 py-2 text-xs text-suave">{link}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopiado(true);
                } catch {
                  // Sem permissão de área de transferência: o link está visível acima.
                }
              }}
              className="rounded-xl border border-borda px-3 py-2 text-sm"
            >
              {copiado ? "Copiado" : "Copiar link"}
            </button>
            <a
              href={`https://wa.me/${whatsapp ?? ""}?text=${encodeURIComponent(texto)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl bg-marca px-3 py-2 text-sm font-medium text-sobre-marca"
            >
              Mandar no WhatsApp
            </a>
            <a href={link} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-borda px-3 py-2 text-sm">
              Abrir
            </a>
          </div>
        </div>
      )}
    </section>
  );
}
