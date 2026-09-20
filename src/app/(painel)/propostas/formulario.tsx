"use client";

import { Formulario } from "@/app/formulario";
import { useActionState, useState } from "react";
import { acaoSalvarProposta, type EstadoProposta } from "./acoes";

const vazio: EstadoProposta = {};
const campo =
  "w-full rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm outline-none focus:border-marca";

export type ValoresProposta = {
  propostaId?: string;
  clienteId: string;
  titulo: string;
  apresentacao: string;
  /** Ids dos serviços do catálogo já marcados. */
  servicos: string[];
  /** Itens escritos à mão, que não estão no catálogo. */
  extras: string;
  feeCheio: string;
  feeMensal: string;
  setupCheio: string;
  setup: string;
  meses: string;
  condicoes: string;
  validade: string;
};

const CONDICOES_PADRAO = `Verba de anúncios paga direto ao Meta pelo cliente, à parte do valor mensal.
Pagamento mensal até o dia 10.`;

const PERIODOS = [
  { valor: "", rotulo: "Sem prazo mínimo" },
  { valor: "3", rotulo: "3 meses" },
  { valor: "6", rotulo: "6 meses" },
  { valor: "12", rotulo: "12 meses" },
];

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Aceita "1.800,00", "1800", "1800.00" — do jeito que a pessoa digitar. */
function numero(bruto: string): number | null {
  const limpo = bruto.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  if (!limpo) return null;
  const v = Number(limpo);
  return Number.isNaN(v) ? null : v;
}

export function FormularioProposta({
  valores,
  clientes,
  servicos,
}: {
  valores: ValoresProposta;
  clientes: { id: string; nome: string }[];
  servicos: { id: string; nome: string; detalhe: string | null }[];
}) {
  const [estado, salvar, salvando] = useActionState(acaoSalvarProposta, vazio);
  const nova = !valores.propostaId;

  // O desconto aparece enquanto você digita: é o que o cliente vai ler.
  const [cheio, setCheio] = useState(valores.feeCheio);
  const [cobrado, setCobrado] = useState(valores.feeMensal);
  const [meses, setMeses] = useState(valores.meses);
  const de = numero(cheio);
  const por = numero(cobrado);
  const economia = de != null && por != null && de > por ? de - por : null;
  const noPeriodo = economia != null && Number(meses) >= 2 ? economia * Number(meses) : null;

  return (
    <Formulario acao={salvar} className="mt-5 flex flex-col gap-4">
      {valores.propostaId && <input type="hidden" name="propostaId" value={valores.propostaId} />}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Para quem</span>
        <select name="clienteId" defaultValue={valores.clienteId} className={campo}>
          <option value="">Prospect novo (digite abaixo)</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>

      {nova && (
        <input
          name="novoProspect"
          placeholder="Nome do prospect novo, se não estiver na lista"
          className={campo}
        />
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Título</span>
        <input
          name="titulo"
          required
          defaultValue={valores.titulo}
          placeholder="Gestão de tráfego para a Clínica Exemplo"
          className={campo}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Abertura</span>
        <textarea
          name="apresentacao"
          rows={4}
          defaultValue={valores.apresentacao}
          placeholder="O problema que você entendeu na conversa, em duas ou três frases. É o que prova que a proposta foi escrita para ele."
          className={campo}
        />
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm text-suave">O que está incluído</legend>
        <div className="mt-1 flex flex-col gap-1.5">
          {servicos.map((s) => (
            <label
              key={s.id}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-borda bg-fundo px-3 py-2.5 has-[:checked]:border-marca has-[:checked]:bg-marca-suave"
            >
              <input
                type="checkbox"
                name="servicos"
                value={s.id}
                defaultChecked={valores.servicos.includes(s.id)}
                className="mt-0.5 size-4 shrink-0 accent-marca"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{s.nome}</span>
                {s.detalhe && <span className="block text-xs text-suave">{s.detalhe}</span>}
              </span>
            </label>
          ))}
        </div>
        <a href="/propostas/servicos" className="mt-1 text-xs text-marca-texto">
          Editar a lista de serviços
        </a>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Itens fora da lista</span>
        <textarea
          name="extras"
          rows={3}
          defaultValue={valores.extras}
          placeholder={'Um por linha. Use "Título: detalhe" para separar as duas partes.'}
          className={campo}
        />
      </label>

      <fieldset className="rounded-2xl border border-borda p-4">
        <legend className="px-1 text-sm text-suave">Investimento</legend>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-suave">Valor mensal de tabela (R$)</span>
            <input
              name="feeCheio"
              inputMode="decimal"
              value={cheio}
              onChange={(e) => setCheio(e.target.value)}
              placeholder="2.400,00"
              className={campo}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-suave">Valor desta proposta (R$)</span>
            <input
              name="feeMensal"
              inputMode="decimal"
              value={cobrado}
              onChange={(e) => setCobrado(e.target.value)}
              placeholder="1.800,00"
              className={campo}
            />
          </label>
        </div>
        <p className="mt-1.5 text-xs text-suave">
          Deixe o de tabela vazio quando não houver desconto. Com os dois preenchidos, o cliente vê
          &quot;de / por&quot;.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-suave">Implantação de tabela (R$)</span>
            <input
              name="setupCheio"
              inputMode="decimal"
              defaultValue={valores.setupCheio}
              placeholder="opcional"
              className={campo}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-suave">Implantação nesta proposta (R$)</span>
            <input
              name="setup"
              inputMode="decimal"
              defaultValue={valores.setup}
              placeholder="opcional"
              className={campo}
            />
          </label>
        </div>

        <label className="mt-3 flex flex-col gap-1.5">
          <span className="text-sm text-suave">Período de contrato</span>
          <select
            name="meses"
            value={meses}
            onChange={(e) => setMeses(e.target.value)}
            className={campo}
          >
            {PERIODOS.map((p) => (
              <option key={p.rotulo} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </select>
        </label>

        {economia != null && (
          <p className="mt-3 rounded-xl bg-ok-suave px-3 py-2 text-sm text-ok">
            Desconto de {moeda(economia)} por mês ({Math.round((economia / de!) * 100)}%)
            {noPeriodo != null ? ` · ${moeda(noPeriodo)} no período` : ""}
          </p>
        )}
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Condições</span>
        <textarea
          name="condicoes"
          rows={3}
          defaultValue={valores.condicoes || CONDICOES_PADRAO}
          className={campo}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Válida até</span>
        <input name="validade" type="date" required defaultValue={valores.validade} className={campo} />
      </label>

      {estado.erro && (
        <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>
      )}

      <button
        type="submit"
        disabled={salvando}
        className="rounded-xl bg-marca px-4 py-3 text-sm font-medium text-sobre-marca disabled:opacity-60"
      >
        {salvando ? "Salvando..." : nova ? "Criar proposta" : "Salvar alterações"}
      </button>
    </Formulario>
  );
}
