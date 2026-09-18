"use client";

import { useActionState, useState } from "react";
import {
  acaoConfirmarConversa,
  acaoDescartar,
  acaoDesfecho,
  type EstadoConfirmacao,
} from "./acoes";
import { ETAPAS_EM_ANDAMENTO, ROTULO_STATUS } from "@/lib/regras";

const vazio: EstadoConfirmacao = {};

const cartao = "rounded-2xl border border-borda bg-superficie p-4";
const botaoPrimario = "rounded-xl bg-marca px-3 py-2.5 text-sm font-medium text-white disabled:opacity-60";
const botaoSecundario = "rounded-xl border border-borda px-3 py-2.5 text-sm font-medium disabled:opacity-60";
const campo = "w-full rounded-xl border border-borda bg-fundo px-3 py-2.5 text-base outline-none focus:border-marca";

function Resposta({ estado }: { estado: EstadoConfirmacao }) {
  if (estado.erro) {
    return <p className="mt-3 rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>;
  }
  if (estado.ok) {
    return <p className="mt-3 rounded-lg bg-ok-suave px-3 py-2 text-sm text-ok">{estado.ok}</p>;
  }
  return null;
}

/** Um clique aguardando confirmação: virou conversa, ou não falou comigo. */
export function ItemClique({
  token,
  cliqueId,
  codigo,
  interesse,
  nome,
  telefone,
  quando,
}: {
  token: string;
  cliqueId: string;
  codigo: string;
  interesse: string | null;
  nome: string | null;
  telefone: string | null;
  quando: string;
}) {
  const [confirmado, confirmar, confirmando] = useActionState(acaoConfirmarConversa, vazio);
  const [descartado, descartar, descartando] = useActionState(acaoDescartar, vazio);
  const [abrirTelefone, setAbrirTelefone] = useState(false);

  const respondido = Boolean(confirmado.ok || descartado.ok);

  if (respondido) {
    return (
      <article className={`${cartao} opacity-60`}>
        <p className="text-sm">
          {nome ?? interesse ?? `Código ${codigo}`} ·{" "}
          {confirmado.ok ? "virou conversa" : "sem contato"}
        </p>
      </article>
    );
  }

  return (
    <article className={cartao}>
      {/* O que a pessoa procurava vem primeiro: é assim que quem atende
          reconhece de quem se trata. O código serve para conferir na conversa. */}
      <p className="font-medium">{nome ?? interesse ?? "Sem identificação"}</p>
      <p className="mt-0.5 text-sm text-suave">
        {[nome ? interesse : null, telefone, `clicou ${quando}`, `código ${codigo}`]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {abrirTelefone ? (
        <form action={confirmar} className="mt-3 flex flex-col gap-2">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="cliqueId" value={cliqueId} />
          <input name="nome" placeholder="Nome de quem falou (opcional)" className={campo} />
          <input
            name="telefone"
            type="tel"
            inputMode="tel"
            placeholder="Telefone (opcional)"
            className={campo}
          />
          <div className="flex gap-2">
            <button type="submit" disabled={confirmando} className={`${botaoPrimario} flex-1`}>
              {confirmando ? "Salvando..." : "Confirmar"}
            </button>
            <button type="button" onClick={() => setAbrirTelefone(false)} className={botaoSecundario}>
              Voltar
            </button>
          </div>
          <Resposta estado={confirmado} />
        </form>
      ) : (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <form action={confirmar} className="flex-1">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="cliqueId" value={cliqueId} />
            <button type="submit" disabled={confirmando} className={`${botaoPrimario} w-full`}>
              {confirmando ? "Salvando..." : "Falou comigo"}
            </button>
          </form>
          <form action={descartar} className="flex-1">
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="cliqueId" value={cliqueId} />
            <button type="submit" disabled={descartando} className={`${botaoSecundario} w-full`}>
              {descartando ? "Salvando..." : "Não falou"}
            </button>
          </form>
        </div>
      )}

      {!abrirTelefone && (
        <button
          type="button"
          onClick={() => setAbrirTelefone(true)}
          className="mt-2 text-sm text-marca"
        >
          {nome ? "Corrigir nome ou telefone" : "Falou comigo e quero anotar quem é"}
        </button>
      )}

      {!abrirTelefone && (
        <>
          <Resposta estado={confirmado} />
          <Resposta estado={descartado} />
        </>
      )}
    </article>
  );
}

/** Um lead em aberto: fechou com valor, ou perdeu com motivo. */
export function ItemLead({
  token,
  leadId,
  titulo,
  telefone,
  codigo,
  interesse,
  etapaAtual,
  quando,
}: {
  token: string;
  leadId: string;
  titulo: string;
  telefone: string | null;
  codigo: string | null;
  interesse: string | null;
  etapaAtual: string;
  quando: string;
}) {
  const [estado, responder, enviando] = useActionState(acaoDesfecho, vazio);
  const [escolha, setEscolha] = useState<"" | "FECHADO" | "PERDIDO" | "ANDAMENTO">("");

  if (estado.ok) {
    return (
      <article className={`${cartao} opacity-60`}>
        <p className="text-sm">
          {titulo} · {estado.ok}
        </p>
      </article>
    );
  }

  return (
    <article className={cartao}>
      <p className="font-medium">{titulo}</p>
      <p className="mt-0.5 text-sm text-suave">
        {[
          etapaAtual === "NOVO" ? null : ROTULO_STATUS[etapaAtual],
          interesse,
          telefone,
          `desde ${quando}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {escolha === "" && (
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => setEscolha("FECHADO")}
              className={`${botaoPrimario} flex-1`}
            >
              Virou cliente
            </button>
            <button
              type="button"
              onClick={() => setEscolha("PERDIDO")}
              className={`${botaoSecundario} flex-1`}
            >
              Não fechou
            </button>
          </div>
          <button
            type="button"
            onClick={() => setEscolha("ANDAMENTO")}
            className={`${botaoSecundario} w-full`}
          >
            Ainda estou tratando
          </button>
        </div>
      )}

      {/* Etapa do funil: só aparece para quem disse que ainda está tratando. */}
      {escolha === "ANDAMENTO" && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-sm text-suave">Em que ponto está?</p>
          {ETAPAS_EM_ANDAMENTO.map((etapa) => (
            <form key={etapa} action={responder}>
              <input type="hidden" name="token" value={token} />
              <input type="hidden" name="leadId" value={leadId} />
              <input type="hidden" name="status" value={etapa} />
              <button
                type="submit"
                disabled={enviando}
                className={`${botaoSecundario} w-full ${etapa === etapaAtual ? "border-marca text-marca" : ""}`}
              >
                {ROTULO_STATUS[etapa]}
                {etapa === etapaAtual ? " · atual" : ""}
              </button>
            </form>
          ))}
          <button type="button" onClick={() => setEscolha("")} className="mt-1 text-sm text-marca">
            Voltar
          </button>
          <Resposta estado={estado} />
        </div>
      )}

      {(escolha === "FECHADO" || escolha === "PERDIDO") && (
        <form action={responder} className="mt-4 flex flex-col gap-2">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="leadId" value={leadId} />
          <input type="hidden" name="status" value={escolha} />

          {escolha === "FECHADO" ? (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-suave">Valor da venda (R$)</span>
              <input
                name="valorVenda"
                inputMode="decimal"
                required
                placeholder="2000,00"
                className={campo}
              />
            </label>
          ) : (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-suave">O que aconteceu?</span>
              <input
                name="motivoPerda"
                required
                placeholder="Preço, prazo, sumiu..."
                className={campo}
              />
            </label>
          )}

          <div className="flex gap-2">
            <button type="submit" disabled={enviando} className={`${botaoPrimario} flex-1`}>
              {enviando ? "Salvando..." : "Salvar"}
            </button>
            <button type="button" onClick={() => setEscolha("")} className={botaoSecundario}>
              Voltar
            </button>
          </div>

          <Resposta estado={estado} />
        </form>
      )}

      {escolha === "" && <Resposta estado={estado} />}
    </article>
  );
}
