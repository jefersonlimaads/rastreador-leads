import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirCliente, podeVerDinheiro } from "@/lib/auth";
import { detalheLead } from "@/lib/consultas";
import { formatarTelefone, linkWhatsapp } from "@/lib/telefone";
import { ROTULO_ATRIBUICAO, ROTULO_EVENTO, ROTULO_STATUS } from "@/lib/regras";
import { formatarDataHora } from "@/lib/datas";
import { etapasVisiveis } from "@/lib/regras";
import { Selo, moeda, tempoRelativo } from "../../componentes";
import { PainelStatus } from "./status";
import { ArquivarLead } from "./arquivar";
import { acaoAdicionarNota, acaoRegistrarContato } from "../../acoes";

export default async function PaginaLead({ params, searchParams }: PageProps<"/leads/[id]">) {
  const { id } = await params;
  const { cliente } = await searchParams;
  const { sessao, clienteId } = await exigirCliente(typeof cliente === "string" ? cliente : null);

  const lead = await detalheLead(clienteId, id);
  if (!lead) notFound();

  const mostrarDinheiro = podeVerDinheiro(sessao.papel);

  // Nomes do anúncio, conjunto e campanha vêm do Meta (tabela de gasto); o
  // clique só traz os números. Sem gasto sincronizado, fica o que o link trouxe.
  const nomes = lead.clique?.adId
    ? await prisma.gasto.findFirst({
        where: { clienteId, adId: lead.clique.adId },
        orderBy: { dia: "desc" },
        select: { adNome: true, adsetNome: true, campaignNome: true },
      })
    : null;
  let pagina: string | null = null;
  try {
    pagina = lead.clique?.url ? new URL(lead.clique.url).hostname : null;
  } catch {
    pagina = null;
  }
  const fuso = lead.cliente.fuso;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold tracking-tight">
            {lead.nome ||
              (lead.telefone ? formatarTelefone(lead.telefone) : `Conversa ${lead.clique?.codigo ?? ""}`)}
          </h1>
          <p className="mt-0.5 text-sm text-suave">
            {lead.telefone ? formatarTelefone(lead.telefone) + " · " : ""}entrou{" "}
            {tempoRelativo(lead.criadoEm)}
          </p>
        </div>
        {lead.telefone && (
          <a
            href={linkWhatsapp(lead.telefone)}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-sobre-marca"
          >
            WhatsApp
          </a>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Selo tom={lead.status === "FECHADO" ? "ok" : "neutro"}>{ROTULO_STATUS[lead.status]}</Selo>
        <Selo tom={lead.atribuicao === "EXATA" ? "marca" : "neutro"}>
          {ROTULO_ATRIBUICAO[lead.atribuicao]}
        </Selo>
        {mostrarDinheiro && lead.valorVenda && (
          <Selo tom="ok">{moeda(Number(lead.valorVenda))}</Selo>
        )}
        {lead.leadAnterior && <Selo>Oportunidade nova do mesmo telefone</Selo>}
      </div>

      <section className="mt-5 rounded-2xl border border-borda bg-superficie p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-suave">Origem</h2>
        {lead.clique ? (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm [&_dd]:min-w-0 [&_dd]:[overflow-wrap:anywhere]">
            {lead.clique.interesse && (
              <>
                <dt className="text-suave">Interesse</dt>
                <dd className="font-medium">{lead.clique.interesse}</dd>
              </>
            )}
            <dt className="text-suave">Anúncio</dt>
            <dd>{nomes?.adNome ?? lead.clique.utmContent ?? lead.clique.adId ?? "sem anúncio (visita direta)"}</dd>
            {(nomes?.adsetNome || lead.clique.adsetId) && (
              <>
                <dt className="text-suave">Conjunto</dt>
                <dd>{nomes?.adsetNome ?? lead.clique.adsetId}</dd>
              </>
            )}
            {(nomes?.campaignNome || lead.clique.utmCampaign || lead.clique.campaignId) && (
              <>
                <dt className="text-suave">Campanha</dt>
                <dd>{nomes?.campaignNome ?? lead.clique.utmCampaign ?? lead.clique.campaignId}</dd>
              </>
            )}
            {pagina && (
              <>
                <dt className="text-suave">Página</dt>
                <dd>{pagina}</dd>
              </>
            )}
            <dt className="text-suave">Chegou em</dt>
            <dd>{formatarDataHora(lead.mensagemEm, fuso)}</dd>
            <dt className="text-suave">Código</dt>
            <dd className="text-suave">{lead.clique.codigo}</dd>
          </dl>
        ) : (
          <p className="mt-2 text-sm text-suave">
            Não dá para saber de qual anúncio veio: chegou sem passar pela página rastreada.
            Chegou em {formatarDataHora(lead.mensagemEm, fuso)}.
          </p>
        )}
      </section>

      <PainelStatus
        leadId={lead.id}
        etapas={etapasVisiveis(lead.cliente.funil, [lead.status])}
        status={lead.status}
        podeFechar={mostrarDinheiro}
        valorAtual={lead.valorVenda ? Number(lead.valorVenda) : null}
        motivoAtual={lead.motivoPerda}
      />

      <section className="mt-5 flex gap-2">
        <form action={acaoRegistrarContato} className="flex-1">
          <input type="hidden" name="leadId" value={lead.id} />
          <button
            type="submit"
            className="w-full rounded-xl border border-borda bg-superficie px-3 py-2.5 text-sm font-medium"
          >
            Registrei contato
          </button>
        </form>
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-suave">Histórico</h2>

        <form action={acaoAdicionarNota} className="mb-3 flex gap-2">
          <input type="hidden" name="leadId" value={lead.id} />
          <input
            name="nota"
            placeholder="Anotar algo sobre este lead"
            className="flex-1 rounded-xl border border-borda bg-superficie px-3 py-2.5 text-sm outline-none focus:border-marca"
          />
          <button type="submit" className="rounded-xl border border-borda px-3 py-2.5 text-sm">
            Anotar
          </button>
        </form>

        <ol className="flex flex-col gap-2">
          {lead.eventos.map((evento) => (
            <li key={evento.id} className="rounded-xl border border-borda bg-superficie px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{ROTULO_EVENTO[evento.tipo] ?? evento.tipo}</span>
                <span className="shrink-0 text-xs text-suave">
                  {formatarDataHora(evento.criadoEm, fuso)}
                </span>
              </div>
              {evento.descricao && <p className="mt-1 text-sm text-suave">{evento.descricao}</p>}
              {evento.usuario && (
                <p className="mt-1 text-xs text-suave">por {evento.usuario.nome}</p>
              )}
            </li>
          ))}
        </ol>
      </section>

      {mostrarDinheiro && lead.enviosCapi.length > 0 && (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-suave">
            Enviado ao Meta
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {lead.enviosCapi.map((envio) => (
              <li key={envio.id} className="rounded-xl border border-borda bg-superficie px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{envio.tipo}</span>
                  <Selo tom={envio.statusResposta === 200 ? "ok" : "alerta"}>
                    {envio.statusResposta === 200 ? "aceito" : (envio.statusResposta ?? "pendente")}
                  </Selo>
                </div>
                <p className="mt-1 break-all text-xs text-suave">{envio.eventId}</p>
                {envio.resposta && <p className="mt-1 text-xs text-suave">{envio.resposta}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {mostrarDinheiro && (
        <div className="mt-8">
          <ArquivarLead leadId={lead.id} />
        </div>
      )}
    </>
  );
}
