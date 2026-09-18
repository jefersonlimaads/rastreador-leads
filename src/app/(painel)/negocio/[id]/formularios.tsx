"use client";

import { Formulario, useLimparAoConcluir } from "@/app/formulario";
import { useActionState, useState } from "react";
import { acaoCriarFatura, acaoSalvarComercial, type EstadoNegocio } from "../acoes";
import { ROTULO_CICLO } from "@/lib/regras";

const vazio: EstadoNegocio = {};

const campo =
  "rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm outline-none focus:border-marca";
const botao =
  "rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca disabled:opacity-60";

function Aviso({ estado }: { estado: EstadoNegocio }) {
  if (estado.erro) {
    return <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>;
  }
  if (estado.ok) {
    return <p className="rounded-lg bg-ok-suave px-3 py-2 text-sm text-ok">{estado.ok}</p>;
  }
  return null;
}

export function FormularioComercial({
  cliente,
}: {
  cliente: {
    id: string;
    ciclo: string;
    feeMensal: number | null;
    diaVencimento: number | null;
    inicioContrato: string;
    documento: string;
    contatoNome: string;
    contatoEmail: string;
    contatoTelefone: string;
    linkPagamento: string;
    observacoes: string;
  };
}) {
  const [estado, salvar, salvando] = useActionState(acaoSalvarComercial, vazio);

  return (
    <Formulario acao={salvar} className="mt-5 flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
      <input type="hidden" name="clienteId" value={cliente.id} />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Etapa</span>
        <select name="ciclo" defaultValue={cliente.ciclo} className={campo}>
          {Object.entries(ROTULO_CICLO).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-suave">Fee mensal (R$)</span>
          <input
            name="feeMensal"
            inputMode="decimal"
            defaultValue={cliente.feeMensal ?? ""}
            placeholder="1500,00"
            className={campo}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-suave">Vence dia</span>
          <input
            name="diaVencimento"
            inputMode="numeric"
            defaultValue={cliente.diaVencimento ?? ""}
            placeholder="10"
            className={campo}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Início do contrato</span>
        <input
          name="inicioContrato"
          type="date"
          defaultValue={cliente.inicioContrato}
          className={campo}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">CNPJ ou CPF</span>
        <input name="documento" defaultValue={cliente.documento} className={campo} />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-suave">Contato</span>
          <input name="contatoNome" defaultValue={cliente.contatoNome} className={campo} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-suave">E-mail</span>
          <input name="contatoEmail" type="email" defaultValue={cliente.contatoEmail} className={campo} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-suave">WhatsApp</span>
          <input name="contatoTelefone" defaultValue={cliente.contatoTelefone} className={campo} />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Link de cobrança</span>
        <input
          name="linkPagamento"
          defaultValue={cliente.linkPagamento}
          placeholder="Cole o link do banco ou da maquininha"
          className={campo}
        />
        <span className="text-xs text-suave">
          Entra nas faturas novas deste cliente. Quando houver provedor de pagamento, o link passa
          a ser gerado sozinho.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Observações</span>
        <textarea name="observacoes" rows={3} defaultValue={cliente.observacoes} className={campo} />
      </label>

      <Aviso estado={estado} />
      <button type="submit" disabled={salvando} className={botao}>
        {salvando ? "Salvando..." : "Salvar dados do cliente"}
      </button>
    </Formulario>
  );
}

/** Cobrança fora do fee: projeto, setup, extra do mês. */
export function FormularioFatura({ clienteId }: { clienteId: string }) {
  const [estado, criar, criando] = useActionState(acaoCriarFatura, vazio);
  const chave = useLimparAoConcluir(estado);
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="mt-3 text-sm text-marca-texto">
        Lançar cobrança avulsa
      </button>
    );
  }

  return (
    <Formulario key={chave} acao={criar} className="mt-3 flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
      <input type="hidden" name="clienteId" value={clienteId} />
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-suave">Valor (R$)</span>
          <input name="valor" inputMode="decimal" required placeholder="800,00" className={campo} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-suave">Vencimento</span>
          <input name="vencimento" type="date" required className={campo} />
        </label>
      </div>
      <input name="observacao" placeholder="Do que se trata" className={campo} />
      <Aviso estado={estado} />
      <div className="flex gap-2">
        <button type="submit" disabled={criando} className={`${botao} flex-1`}>
          {criando ? "Criando..." : "Criar cobrança"}
        </button>
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-xl border border-borda px-4 py-2.5 text-sm"
        >
          Cancelar
        </button>
      </div>
    </Formulario>
  );
}
