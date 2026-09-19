"use client";

import { Formulario } from "@/app/formulario";
import { useActionState } from "react";
import { acaoNovoClienteAtivo, type EstadoNegocio } from "../acoes";
import { ROTULO_FUNIL } from "@/lib/regras";
import type { ContaDisponivel } from "@/lib/meta/marketing";

const vazio: EstadoNegocio = {};
const campo =
  "w-full rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm outline-none focus:border-marca";

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4">
      <legend className="px-1 text-sm font-semibold uppercase tracking-wide text-suave">{titulo}</legend>
      {children}
    </fieldset>
  );
}

function Campo({ rotulo, ajuda, children }: { rotulo: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-suave">{rotulo}</span>
      {children}
      {ajuda && <span className="text-xs text-suave">{ajuda}</span>}
    </label>
  );
}

/**
 * Só o nome é obrigatório: dá para cadastrar a carteira inteira rápido e
 * completar depois. O que falta aparece como pendência no cadastro do cliente.
 */
export function FormularioNovoCliente({ contas }: { contas: ContaDisponivel[] }) {
  const [estado, criar, criando] = useActionState(acaoNovoClienteAtivo, vazio);

  return (
    <Formulario acao={criar} className="mt-5 flex flex-col gap-4">
      <Grupo titulo="Cliente">
        <Campo rotulo="Nome">
          <input name="nome" required autoFocus placeholder="Nome da empresa ou do profissional" className={campo} />
        </Campo>
        <Campo rotulo="CNPJ ou CPF">
          <input name="documento" className={campo} />
        </Campo>
        <Campo rotulo="WhatsApp de atendimento" ajuda="Onde os leads chegam. Vai no script da landing page.">
          <input name="numeroAtendimento" type="tel" inputMode="tel" placeholder="(11) 99999-9999" className={campo} />
        </Campo>
        <Campo rotulo="Funil">
          <select name="funil" defaultValue="COMPLETO" className={campo}>
            {Object.entries(ROTULO_FUNIL).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </select>
        </Campo>
      </Grupo>

      <Grupo titulo="Quem decide">
        <Campo rotulo="Nome">
          <input name="contatoNome" className={campo} />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="WhatsApp">
            <input name="contatoTelefone" type="tel" inputMode="tel" className={campo} />
          </Campo>
          <Campo rotulo="E-mail">
            <input name="contatoEmail" type="email" className={campo} />
          </Campo>
        </div>
      </Grupo>

      <Grupo titulo="Contrato">
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Fee mensal (R$)">
            <input name="feeMensal" inputMode="decimal" placeholder="1500,00" className={campo} />
          </Campo>
          <Campo rotulo="Vence dia">
            <input name="diaVencimento" inputMode="numeric" placeholder="10" className={campo} />
          </Campo>
        </div>
        <Campo rotulo="Cliente desde" ajuda="Pode ser uma data antiga. Faturas passadas não são geradas.">
          <input name="inicioContrato" type="date" className={campo} />
        </Campo>
      </Grupo>

      <Grupo titulo="Mídia (opcional)">
        <Campo
          rotulo="Conta de anúncios do Meta"
          ajuda="A lista mostra as contas compartilhadas com a BM da agência. Outras contas se ligam depois, em Ajustes."
        >
          {contas.length > 0 && (
            <select name="conta" defaultValue="" className={campo}>
              <option value="">Nenhuma por enquanto</option>
              {contas.map((c) => (
                <option key={c.contaId} value={`${c.contaId}|${c.nome}`}>
                  {c.nome}
                  {c.negocio ? ` — ${c.negocio}` : ""}
                </option>
              ))}
            </select>
          )}
          <input
            name="contaDigitada"
            placeholder={contas.length > 0 ? "ou digite o número da conta" : "Número da conta de anúncios"}
            className={campo}
          />
        </Campo>
      </Grupo>

      {estado.erro && (
        <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>
      )}

      <button
        type="submit"
        disabled={criando}
        className="rounded-xl bg-marca px-4 py-3 text-sm font-medium text-sobre-marca disabled:opacity-60"
      >
        {criando ? "Cadastrando..." : "Cadastrar cliente"}
      </button>
    </Formulario>
  );
}
