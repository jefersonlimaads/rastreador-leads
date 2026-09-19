"use client";

import { Formulario, useLimparAoConcluir } from "@/app/formulario";
import { useActionState, useState } from "react";
import {
  acaoExcluirProspect,
  acaoMarcarPerdido,
  acaoReativar,
  acaoRegistrarInteracao,
  acaoSalvarProspect,
  type EstadoProspeccao,
} from "../acoes";

const vazio: EstadoProspeccao = {};
const campo =
  "w-full rounded-xl border border-borda bg-fundo px-3 py-2.5 text-sm outline-none focus:border-marca";

function Aviso({ estado }: { estado: EstadoProspeccao }) {
  if (estado.erro) {
    return <p className="rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">{estado.erro}</p>;
  }
  if (estado.ok) {
    return <p className="rounded-lg bg-ok-suave px-3 py-2 text-sm text-ok">{estado.ok}</p>;
  }
  return null;
}

/** Data de hoje + N dias, no formato do input de data. */
function daquiA(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

/**
 * O gesto principal da prospecção: registrar o que aconteceu, avançar a etapa e
 * marcar quando voltar, tudo de uma vez. Os atalhos de data existem porque
 * "daqui a 3 dias" é o que se pensa, não "dia 21".
 */
export function RegistrarContato({
  clienteId,
  etapaAtual,
  etapaManual,
  etapas,
  tipos,
}: {
  clienteId: string;
  etapaAtual: string;
  etapaManual: boolean;
  etapas: { valor: string; rotulo: string }[];
  tipos: { valor: string; rotulo: string }[];
}) {
  const [estado, registrar, registrando] = useActionState(acaoRegistrarInteracao, vazio);
  const chaveRegistro = useLimparAoConcluir(estado);
  const [proximo, setProximo] = useState(daquiA(3));
  const [etapa, setEtapa] = useState(etapaAtual);
  const [diaReuniao, setDiaReuniao] = useState(daquiA(2));
  const [horaReuniao, setHoraReuniao] = useState("10:00");

  // A hora digitada é de São Paulo; quem converte é o navegador, que sabe o fuso.
  const reuniaoIso =
    etapa === "REUNIAO_MARCADA" && diaReuniao && horaReuniao
      ? new Date(`${diaReuniao}T${horaReuniao}`).toISOString()
      : "";

  return (
    <Formulario
      acao={registrar}
      key={chaveRegistro}
      className="mt-5 flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-4"
    >
      <input type="hidden" name="clienteId" value={clienteId} />
      <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">Registrar contato</h2>

      <div className="flex flex-wrap gap-2">
        {tipos.map((t, i) => (
          <label key={t.valor} className="cursor-pointer">
            <input type="radio" name="tipo" value={t.valor} defaultChecked={i === 0} className="peer sr-only" />
            <span className="block rounded-xl border border-borda px-3 py-1.5 text-sm peer-checked:border-marca peer-checked:bg-marca-suave peer-checked:text-marca-texto">
              {t.rotulo}
            </span>
          </label>
        ))}
      </div>

      <textarea
        name="descricao"
        rows={3}
        required
        placeholder="O que foi dito. Ex.: mandei a primeira mensagem sobre o Reels dele; respondeu que está sem tempo até o dia 25."
        className={campo}
      />

      {etapaManual ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-suave">Etapa depois desse contato</span>
          <select
            name="novaEtapa"
            value={etapa}
            onChange={(e) => setEtapa(e.target.value)}
            className={campo}
          >
            {etapas.map((e) => (
              <option key={e.valor} value={e.valor}>
                {e.rotulo}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="text-xs text-suave">
          A etapa agora segue a proposta: muda quando ela for aberta, negociada ou respondida.
        </p>
      )}

      {/* Reunião marcada vai para a agenda com dia e hora, e gera a tarefa de
          enviar a proposta para 24h depois. */}
      {etapa === "REUNIAO_MARCADA" && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-marca bg-marca-suave p-3">
          <span className="text-sm text-marca-texto">Quando é a reunião?</span>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={diaReuniao}
              onChange={(e) => setDiaReuniao(e.target.value)}
              required
              className={campo}
            />
            <input
              type="time"
              value={horaReuniao}
              onChange={(e) => setHoraReuniao(e.target.value)}
              required
              step={900}
              className={campo}
            />
          </div>
          <input type="hidden" name="reuniaoEm" value={reuniaoIso} />
          <span className="text-xs text-marca-texto">
            Entra na agenda, e a tarefa de enviar a proposta fica para o dia seguinte.
          </span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-suave">Retomar em</span>
        <div className="flex flex-wrap gap-2">
          {[
            { rotulo: "Amanhã", dias: 1 },
            { rotulo: "3 dias", dias: 3 },
            { rotulo: "1 semana", dias: 7 },
            { rotulo: "15 dias", dias: 15 },
          ].map((a) => (
            <button
              key={a.dias}
              type="button"
              onClick={() => setProximo(daquiA(a.dias))}
              className={`rounded-xl border px-3 py-1.5 text-sm ${
                proximo === daquiA(a.dias) ? "border-marca bg-marca-suave text-marca-texto" : "border-borda"
              }`}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
        <input
          name="proximoContato"
          type="date"
          value={proximo}
          onChange={(e) => setProximo(e.target.value)}
          className={campo}
        />
      </div>

      <Aviso estado={estado} />
      <button
        type="submit"
        disabled={registrando}
        className="rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca disabled:opacity-60"
      >
        {registrando ? "Registrando..." : "Registrar"}
      </button>
    </Formulario>
  );
}

export function FichaProspect({
  prospect,
  origens,
}: {
  prospect: {
    id: string;
    nome: string;
    nicho: string;
    origem: string;
    contatoNome: string;
    contatoTelefone: string;
    contatoEmail: string;
    instagram: string;
    site: string;
    observacoes: string;
  };
  origens: string[];
}) {
  const [estado, salvar, salvando] = useActionState(acaoSalvarProspect, vazio);

  return (
    <details className="mt-6 rounded-2xl border border-borda bg-superficie p-4">
      <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-suave">
        Ficha do prospect
      </summary>
      <Formulario acao={salvar} className="mt-4 flex flex-col gap-3">
        <input type="hidden" name="clienteId" value={prospect.id} />
        <input name="nome" defaultValue={prospect.nome} required placeholder="Nome" className={campo} />
        <div className="grid grid-cols-2 gap-3">
          <input name="nicho" defaultValue={prospect.nicho} placeholder="Nicho" className={campo} />
          <select name="origem" defaultValue={prospect.origem} className={campo}>
            <option value="">De onde veio</option>
            {origens.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <input name="contatoNome" defaultValue={prospect.contatoNome} placeholder="Com quem falar" className={campo} />
        <div className="grid grid-cols-2 gap-3">
          <input name="contatoTelefone" defaultValue={prospect.contatoTelefone} placeholder="WhatsApp" className={campo} />
          <input name="contatoEmail" type="email" defaultValue={prospect.contatoEmail} placeholder="E-mail" className={campo} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input name="instagram" defaultValue={prospect.instagram} placeholder="@instagram" className={campo} />
          <input name="site" defaultValue={prospect.site} placeholder="Site" className={campo} />
        </div>
        <textarea
          name="observacoes"
          rows={3}
          defaultValue={prospect.observacoes}
          placeholder="Contexto: tamanho, quanto investe hoje, quem decide."
          className={campo}
        />
        <Aviso estado={estado} />
        <button
          type="submit"
          disabled={salvando}
          className="rounded-xl border border-borda px-4 py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {salvando ? "Salvando..." : "Salvar ficha"}
        </button>
      </Formulario>
    </details>
  );
}

/** Perder, reativar ou excluir: as saídas do funil, no fim da tela. */
export function SaidaDoFunil({
  clienteId,
  perdido,
  podeExcluir,
}: {
  clienteId: string;
  perdido: boolean;
  podeExcluir: boolean;
}) {
  const [perda, perder, perdendo] = useActionState(acaoMarcarPerdido, vazio);
  const [exclusao, excluir, excluindo] = useActionState(acaoExcluirProspect, vazio);
  const [modo, setModo] = useState<"" | "perder" | "excluir">("");

  return (
    <div className="mt-8 flex flex-col gap-3 border-t border-borda pt-5">
      {perdido ? (
        <form action={acaoReativar}>
          <input type="hidden" name="clienteId" value={clienteId} />
          <button type="submit" className="w-full rounded-xl border border-borda px-4 py-2.5 text-sm font-medium">
            Voltar para a prospecção
          </button>
        </form>
      ) : modo === "perder" ? (
        <Formulario acao={perder} className="flex flex-col gap-2 rounded-2xl border border-borda bg-superficie p-4">
          <input type="hidden" name="clienteId" value={clienteId} />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-suave">Por que não seguiu?</span>
            <textarea
              name="motivo"
              rows={2}
              required
              minLength={10}
              autoFocus
              placeholder="Sem verba agora, já tem agência, não respondeu mais..."
              className={campo}
            />
          </label>
          <Aviso estado={perda} />
          <div className="flex gap-2">
            <button type="submit" disabled={perdendo} className="flex-1 rounded-xl border border-alerta px-4 py-2.5 text-sm text-alerta disabled:opacity-60">
              {perdendo ? "Salvando..." : "Marcar como perdido"}
            </button>
            <button type="button" onClick={() => setModo("")} className="rounded-xl border border-borda px-4 py-2.5 text-sm">
              Cancelar
            </button>
          </div>
        </Formulario>
      ) : (
        <button type="button" onClick={() => setModo("perder")} className="rounded-xl px-4 py-2.5 text-sm text-suave">
          Marcar como perdido
        </button>
      )}

      {podeExcluir &&
        (modo === "excluir" ? (
          <Formulario acao={excluir} className="flex flex-col gap-2 rounded-2xl border border-alerta bg-alerta-suave p-4">
            <input type="hidden" name="clienteId" value={clienteId} />
            <p className="text-sm text-alerta">
              Excluir apaga o prospect, o histórico de contatos e as propostas não aceitas. Não dá
              para desfazer. Para quem só disse não, use &quot;perdido&quot;.
            </p>
            <Aviso estado={exclusao} />
            <div className="flex gap-2">
              <button type="submit" disabled={excluindo} className="flex-1 rounded-xl bg-alerta px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
                {excluindo ? "Excluindo..." : "Sim, excluir"}
              </button>
              <button type="button" onClick={() => setModo("")} className="rounded-xl border border-borda bg-superficie px-4 py-2.5 text-sm">
                Cancelar
              </button>
            </div>
          </Formulario>
        ) : (
          <button type="button" onClick={() => setModo("excluir")} className="rounded-xl px-4 py-2.5 text-sm text-alerta">
            Excluir prospect
          </button>
        ))}
    </div>
  );
}
