"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { acaoCadastrarLead, acaoPreverAtribuicao, type EstadoCadastro } from "../../acoes";

type CliqueResumo = {
  id: string;
  codigo: string;
  adId: string | null;
  utmCampaign: string | null;
  criadoEm: string;
};

type Previsao = {
  atribuicao: string;
  codigoLido: string | null;
  clique: CliqueResumo | null;
} | null;

const estadoInicial: EstadoCadastro = {};

/** Valor para o input datetime-local: horário local, sem fuso, sem segundos. */
function agoraLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function FormularioCadastro({
  clienteId,
  cliquesRecentes,
}: {
  clienteId: string;
  cliquesRecentes: CliqueResumo[];
}) {
  const [estado, acao, enviando] = useActionState(acaoCadastrarLead, estadoInicial);
  const [mensagem, setMensagem] = useState("");
  const [mensagemEm, setMensagemEm] = useState(agoraLocal);
  const [previsao, setPrevisao] = useState<Previsao>(null);
  const [cliqueEscolhido, setCliqueEscolhido] = useState<string>("");
  const [, iniciarPrevisao] = useTransition();

  // Prévia da atribuição enquanto o atendente digita, com uma pausa para não
  // bater no servidor a cada tecla.
  useEffect(() => {
    const id = setTimeout(() => {
      iniciarPrevisao(async () => {
        const resultado = await acaoPreverAtribuicao({
          clienteId,
          mensagem,
          mensagemEm: mensagemEm ? new Date(mensagemEm).toISOString() : undefined,
        });
        setPrevisao(resultado);
      });
    }, 400);
    return () => clearTimeout(id);
  }, [clienteId, mensagem, mensagemEm]);

  const atribuicaoMostrada = cliqueEscolhido
    ? "EXATA (confirmada por você)"
    : previsao
      ? { EXATA: "Exata", PROVAVEL: "Provável", DESCONHECIDA: "Desconhecida" }[previsao.atribuicao]
      : "—";

  return (
    <form action={acao} className="flex flex-col gap-4">
      <input type="hidden" name="clienteId" value={clienteId} />
      <input type="hidden" name="cliqueId" value={cliqueEscolhido} />

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Mensagem recebida</span>
        <textarea
          name="mensagem"
          rows={3}
          value={mensagem}
          onChange={(e) => setMensagem(e.target.value)}
          placeholder="Olá, vim pelo site e quero saber sobre orçamento. [K7RPW]"
          className="rounded-xl border border-borda bg-superficie px-3 py-2.5 outline-none focus:border-marca"
        />
      </label>

      <div className="rounded-xl border border-borda bg-superficie px-3 py-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="text-suave">Atribuição</span>
          <span className="font-medium">{atribuicaoMostrada}</span>
        </div>
        {previsao?.clique && !cliqueEscolhido && (
          <p className="mt-1 text-suave">
            Clique {previsao.clique.codigo}
            {previsao.clique.adId ? ` · anúncio ${previsao.clique.adId}` : ""} ·{" "}
            {new Date(previsao.clique.criadoEm).toLocaleString("pt-BR")}
          </p>
        )}
        {previsao && !previsao.clique && !cliqueEscolhido && (
          <p className="mt-1 text-suave">
            Nenhum clique na janela de 30 minutos. O lead entra como desconhecido.
          </p>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Telefone</span>
        <input
          name="telefone"
          type="tel"
          inputMode="tel"
          required
          placeholder="(11) 99999-9999"
          className="rounded-xl border border-borda bg-superficie px-3 py-2.5 outline-none focus:border-marca"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Nome (opcional)</span>
        <input
          name="nome"
          className="rounded-xl border border-borda bg-superficie px-3 py-2.5 outline-none focus:border-marca"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Horário da mensagem</span>
        {/* O campo visível não é enviado: o servidor roda em UTC e leria a hora
            local como se fosse UTC. Quem converte é o navegador, que conhece o
            fuso de quem está atendendo. */}
        <input
          type="hidden"
          name="mensagemEm"
          value={mensagemEm ? new Date(mensagemEm).toISOString() : ""}
        />
        <input
          type="datetime-local"
          value={mensagemEm}
          onChange={(e) => setMensagemEm(e.target.value)}
          className="rounded-xl border border-borda bg-superficie px-3 py-2.5 outline-none focus:border-marca"
        />
        <span className="text-xs text-suave">
          É esse horário que vale para a janela de 30 minutos, não a hora do cadastro.
        </span>
      </label>

      {cliquesRecentes.length > 0 && (
        <details className="rounded-xl border border-borda bg-superficie px-3 py-3">
          <summary className="cursor-pointer text-sm text-suave">
            Escolher o clique à mão ({cliquesRecentes.length} sem lead)
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="escolha"
                checked={cliqueEscolhido === ""}
                onChange={() => setCliqueEscolhido("")}
              />
              Deixar o sistema decidir
            </label>
            {cliquesRecentes.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="escolha"
                  checked={cliqueEscolhido === c.id}
                  onChange={() => setCliqueEscolhido(c.id)}
                />
                <span>
                  {c.codigo}
                  {c.adId ? ` · ${c.adId}` : ""} ·{" "}
                  {new Date(c.criadoEm).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </label>
            ))}
          </div>
        </details>
      )}

      {estado.erro && (
        <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>
      )}
      {estado.aviso && (
        <p className="rounded-lg bg-marca-suave px-3 py-2 text-sm text-marca">{estado.aviso}</p>
      )}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-xl bg-marca px-4 py-3 font-medium text-white disabled:opacity-60"
      >
        {enviando ? "Salvando..." : "Salvar lead"}
      </button>
    </form>
  );
}
