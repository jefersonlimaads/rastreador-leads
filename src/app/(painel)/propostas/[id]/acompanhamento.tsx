"use client";

import { useActionState, useState } from "react";
import {
  acaoAlternarNegociacao,
  acaoExcluirProposta,
  acaoSalvarAcompanhamento,
  type EstadoProposta,
} from "../acoes";

const vazio: EstadoProposta = {};
const campo =
  "w-full rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm outline-none focus:border-marca";

/**
 * Depois de enviada, a proposta precisa de acompanhamento: em que pé está a
 * conversa, quando retomar e o que já foi dito. Sem isso, a proposta aberta e
 * sem resposta esfria na lista e ninguém lembra de ligar.
 */
export function Acompanhamento({
  propostaId,
  status,
  proximoContato,
  notas,
}: {
  propostaId: string;
  status: string;
  proximoContato: string;
  notas: string;
}) {
  const [estado, salvar, salvando] = useActionState(acaoSalvarAcompanhamento, vazio);
  const podeNegociar = status === "ENVIADA" || status === "NEGOCIANDO";

  return (
    <section className="mt-5 rounded-2xl border border-borda bg-superficie p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">Acompanhamento</h2>

      {podeNegociar && (
        <form action={acaoAlternarNegociacao} className="mt-3">
          <input type="hidden" name="propostaId" value={propostaId} />
          <button
            type="submit"
            className={`w-full rounded-xl px-4 py-2.5 text-sm font-medium ${
              status === "NEGOCIANDO"
                ? "border border-borda"
                : "bg-marca text-sobre-marca"
            }`}
          >
            {status === "NEGOCIANDO" ? "Voltar para enviada" : "Mover para negociando"}
          </button>
          <p className="mt-1.5 text-xs text-suave">
            {status === "NEGOCIANDO"
              ? "Em negociação a proposta não expira sozinha: a conversa está viva."
              : "Use quando o lead respondeu e vocês estão conversando valores ou escopo."}
          </p>
        </form>
      )}

      <form action={salvar} className="mt-4 flex flex-col gap-3">
        <input type="hidden" name="propostaId" value={propostaId} />
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-suave">Próximo contato</span>
          <input name="proximoContato" type="date" defaultValue={proximoContato} className={campo} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-suave">O que já foi conversado</span>
          <textarea
            name="notas"
            rows={4}
            defaultValue={notas}
            placeholder="Achou caro, pediu para rever o número de criativos. Retomar depois do feriado."
            className={campo}
          />
        </label>
        {estado.ok && (
          <p className="rounded-lg bg-ok-suave px-3 py-2 text-sm text-ok">{estado.ok}</p>
        )}
        <button
          type="submit"
          disabled={salvando}
          className="rounded-xl border border-borda px-4 py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Salvar acompanhamento"}
        </button>
      </form>
    </section>
  );
}

/** Excluir pede confirmação: some de vez, não tem lixeira. */
export function ExcluirProposta({ propostaId, aceita }: { propostaId: string; aceita: boolean }) {
  const [estado, excluir, excluindo] = useActionState(acaoExcluirProposta, vazio);
  const [confirmando, setConfirmando] = useState(false);

  if (aceita) {
    return (
      <p className="mt-8 text-center text-xs text-suave">
        Proposta aceita não pode ser excluída: é o registro do contrato.
      </p>
    );
  }

  return (
    <div className="mt-8 border-t border-borda pt-5">
      {!confirmando ? (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="w-full rounded-xl px-4 py-2.5 text-sm text-alerta"
        >
          Excluir proposta
        </button>
      ) : (
        <form action={excluir} className="flex flex-col gap-2 rounded-2xl border border-alerta bg-alerta-suave p-4">
          <input type="hidden" name="propostaId" value={propostaId} />
          <p className="text-sm text-alerta">
            Excluir apaga a proposta de vez, e o link que o lead recebeu para de funcionar. Não
            dá para desfazer.
          </p>
          {estado.erro && <p className="text-sm text-alerta">{estado.erro}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={excluindo}
              className="flex-1 rounded-xl bg-alerta px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {excluindo ? "Excluindo..." : "Sim, excluir"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="rounded-xl border border-borda bg-superficie px-4 py-2.5 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
