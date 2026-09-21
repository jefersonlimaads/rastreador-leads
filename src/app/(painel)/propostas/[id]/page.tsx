import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { escopoParaTexto, lerEscopo, ROTULO_SITUACAO, situacao } from "@/lib/propostas";
import { formatarDataHora } from "@/lib/datas";
import { Selo } from "../../componentes";
import { servicosDaAgencia } from "@/lib/servicos";
import { aberturaSugerida } from "@/lib/abertura";
import { FormularioProposta } from "../formulario";
import { EnviarProposta } from "./enviar";
import { Acompanhamento, ExcluirProposta } from "./acompanhamento";

export default async function PaginaProposta({ params }: { params: Promise<{ id: string }> }) {
  const sessao = await exigirAdmin();
  const { id } = await params;

  const proposta = await prisma.proposta.findFirst({
    where: { id, cliente: { agenciaId: sessao.agenciaId } },
    include: { cliente: { select: { nome: true, contatoTelefone: true, contatoNome: true } } },
  });
  if (!proposta) notFound();

  const clientes = await prisma.cliente.findMany({
    where: { agenciaId: sessao.agenciaId, ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

  const servicos = (await servicosDaAgencia(sessao.agenciaId)).filter((s) => s.ativo);
  const itens = lerEscopo(proposta.escopo);
  // Itens sem servicoId são os digitados à mão, e voltam para o campo de texto.
  const extras = itens.filter((i) => !i.servicoId);

  const sugestao = await aberturaSugerida(proposta.clienteId);

  const agora = situacao(proposta);
  const respondida = agora === "aceita" || agora === "recusada";

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">{proposta.cliente.nome}</h1>
          <p className="mt-0.5 truncate text-sm text-suave">{proposta.titulo}</p>
        </div>
        <Selo
          tom={
            agora === "aceita"
              ? "ok"
              : agora === "recusada" || agora === "expirada"
                ? "alerta"
                : agora === "negociando"
                  ? "marca"
                  : "neutro"
          }
        >
          {ROTULO_SITUACAO[agora]}
        </Selo>
      </div>

      {/* Linha do tempo: o que aconteceu com a proposta depois que saiu daqui. */}
      <ul className="mt-4 flex flex-col gap-1 text-sm text-suave">
        {proposta.enviadaEm && <li>Enviada em {formatarDataHora(proposta.enviadaEm)}</li>}
        {proposta.visualizadaEm && (
          <li>
            Aberta pela primeira vez em {formatarDataHora(proposta.visualizadaEm)}
            {proposta.visualizacoes > 1 ? ` · ${proposta.visualizacoes} aberturas` : ""}
          </li>
        )}
        {proposta.status === "ACEITA" && proposta.respondidaEm && (
          <li className="text-ok">
            Aceita por {proposta.aceitaPor} em {formatarDataHora(proposta.respondidaEm)}
          </li>
        )}
        {proposta.status === "RECUSADA" && proposta.respondidaEm && (
          <li className="text-alerta">
            Recusada em {formatarDataHora(proposta.respondidaEm)}
            {proposta.motivoRecusa ? `: ${proposta.motivoRecusa}` : ""}
          </li>
        )}
      </ul>

      <EnviarProposta
        propostaId={proposta.id}
        jaEnviada={proposta.status !== "RASCUNHO"}
        linkPublico={`${process.env.APP_URL ?? ""}/proposta/${proposta.token}`}
        telefone={proposta.cliente.contatoTelefone}
        contato={proposta.cliente.contatoNome}
      />

      {proposta.status !== "RASCUNHO" && !respondida && (
        <Acompanhamento
          propostaId={proposta.id}
          status={proposta.status}
          proximoContato={proposta.proximoContato?.toISOString().slice(0, 10) ?? ""}
          notas={proposta.notas ?? ""}
        />
      )}

      {respondida ? (
        <p className="mt-6 rounded-2xl border border-dashed border-borda px-4 py-6 text-center text-sm text-suave">
          Proposta respondida fica como registro do que foi combinado e não se edita. Para
          renegociar, crie uma nova.
        </p>
      ) : (
        <FormularioProposta
          clientes={clientes}
          servicos={servicos}
          sugestao={sugestao}
          valores={{
            propostaId: proposta.id,
            clienteId: proposta.clienteId,
            titulo: proposta.titulo,
            apresentacao: proposta.apresentacao ?? "",
            servicos: itens.map((i) => i.servicoId).filter((x): x is string => !!x),
            extras: escopoParaTexto(extras),
            feeCheio: proposta.feeCheio ? String(proposta.feeCheio).replace(".", ",") : "",
            feeMensal: proposta.feeMensal ? String(proposta.feeMensal).replace(".", ",") : "",
            setupCheio: proposta.setupCheio ? String(proposta.setupCheio).replace(".", ",") : "",
            setup: proposta.setup ? String(proposta.setup).replace(".", ",") : "",
            meses: proposta.meses ? String(proposta.meses) : "",
            condicoes: proposta.condicoes ?? "",
            validade: proposta.validade.toISOString().slice(0, 10),
          }}
        />
      )}

      <ExcluirProposta propostaId={proposta.id} aceita={proposta.status === "ACEITA"} />
    </>
  );
}
