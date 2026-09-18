"use client";

import { Formulario } from "@/app/formulario";
import { useActionState, useState } from "react";
import { acaoAceitar, acaoRecusar, type EstadoResposta } from "./acoes";

const vazio: EstadoResposta = {};
const campo =
  "w-full rounded-xl border border-borda bg-superficie px-3 py-3 text-base outline-none focus:border-marca";

/**
 * O fim da proposta. Aceitar pede o nome, que é a assinatura mais simples que
 * ainda deixa claro quem disse sim. Recusar exige o motivo: é o que diz se o
 * problema foi preço, momento ou escopo, e é isso que muda a próxima proposta.
 */
export function Resposta({
  token,
  situacao,
  validade,
  aceitaPor,
  contato,
}: {
  token: string;
  situacao: string;
  validade: string;
  aceitaPor: string | null;
  contato: string | null;
}) {
  const [aceite, aceitar, aceitando] = useActionState(acaoAceitar, vazio);
  const [recusa, recusar, recusando] = useActionState(acaoRecusar, vazio);
  const [modo, setModo] = useState<"" | "aceitar" | "recusar">("");

  if (situacao === "aceita" || aceite.ok) {
    return (
      <div className="rounded-2xl bg-[#141414] p-6 text-[#f6f4ef]">
        <div className="h-1 w-12 bg-[#d8f34f]" />
        <p className="mt-4 font-titulo text-2xl font-bold">Fechado. Bem-vindo.</p>
        <p className="mt-2 text-[#8a8a85]">
          {aceitaPor ? `Aceite registrado em nome de ${aceitaPor}. ` : ""}O próximo passo é o
          acesso às contas: a gente fala com você ainda hoje.
        </p>
      </div>
    );
  }

  if (situacao === "recusada" || recusa.ok) {
    return (
      <div className="rounded-2xl border border-borda bg-superficie p-6">
        <p className="font-medium">Resposta registrada.</p>
        <p className="mt-1 text-sm text-suave">Obrigado por avisar. A porta fica aberta.</p>
      </div>
    );
  }

  if (situacao === "expirada") {
    return (
      <div className="rounded-2xl border border-borda bg-superficie p-6">
        <p className="font-medium">Essa proposta venceu em {validade}.</p>
        <p className="mt-1 text-sm text-suave">
          Se ainda fizer sentido, é só responder a mensagem que a gente atualiza.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-borda bg-superficie p-5">
      <p className="text-sm text-suave">Proposta válida até {validade}.</p>

      {modo === "" && (
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setModo("aceitar")}
            className="rounded-xl bg-marca px-4 py-3.5 font-medium text-sobre-marca"
          >
            Aceitar proposta
          </button>
          <button
            type="button"
            onClick={() => setModo("recusar")}
            className="rounded-xl px-4 py-3 text-sm text-suave"
          >
            Não vou seguir agora
          </button>
        </div>
      )}

      {modo === "aceitar" && (
        <Formulario acao={aceitar} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="token" value={token} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-suave">Seu nome completo, para registrar o aceite</span>
            <input
              name="nome"
              required
              autoFocus
              defaultValue={contato ?? ""}
              autoComplete="name"
              className={campo}
            />
          </label>
          {aceite.erro && (
            <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{aceite.erro}</p>
          )}
          <button
            type="submit"
            disabled={aceitando}
            className="rounded-xl bg-marca px-4 py-3.5 font-medium text-sobre-marca disabled:opacity-60"
          >
            {aceitando ? "Registrando..." : "Confirmar aceite"}
          </button>
          <button type="button" onClick={() => setModo("")} className="text-sm text-suave">
            Voltar
          </button>
        </Formulario>
      )}

      {modo === "recusar" && (
        <Formulario acao={recusar} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="token" value={token} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-suave">O que pesou na decisão?</span>
            <textarea
              name="motivo"
              rows={3}
              required
              minLength={10}
              autoFocus
              className={campo}
              placeholder="Preço acima do que eu esperava, não é o momento, faltou algo no escopo..."
            />
            <span className="text-xs text-suave">
              Uma frase basta. É o que me ajuda a fazer uma proposta melhor da próxima vez.
            </span>
          </label>
          {recusa.erro && (
            <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{recusa.erro}</p>
          )}
          <button
            type="submit"
            disabled={recusando}
            className="rounded-xl border border-borda px-4 py-3 text-sm font-medium disabled:opacity-60"
          >
            {recusando ? "Enviando..." : "Enviar resposta"}
          </button>
          <button type="button" onClick={() => setModo("")} className="text-sm text-suave">
            Voltar
          </button>
        </Formulario>
      )}
    </div>
  );
}
