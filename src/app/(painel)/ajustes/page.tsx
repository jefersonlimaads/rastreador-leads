import { prisma } from "@/lib/prisma";
import { exigirSessao, clienteEmFoco } from "@/lib/auth";
import { formatarTelefone } from "@/lib/telefone";
import { Selo } from "../componentes";
import { PARAMETROS_URL_META, ROTULO_FUNIL } from "@/lib/regras";
import { BlocoCopiavel } from "./copiar";
import { ConexaoMeta, ContasDoCliente, type ContaListada } from "./meta";
import { contasDisponiveis } from "@/lib/meta/marketing";
import { mascarar } from "@/lib/cripto";
import { FormulariosAjustes } from "./formularios";

// "Puxar dados do Meta agora" busca 90 dias e pode passar de um minuto.
export const maxDuration = 300;

export default async function PaginaAjustes({ searchParams }: PageProps<"/ajustes">) {
  const { cliente: pedido } = await searchParams;
  const sessao = await exigirSessao();
  const clienteId = await clienteEmFoco(sessao, typeof pedido === "string" ? pedido : null);

  const clientes =
    sessao.papel === "ADMIN"
      ? await prisma.cliente.findMany({
          where: { agenciaId: sessao.agenciaId },
          include: {
            numeros: true,
            contas: { orderBy: { criadoEm: "asc" } },
            _count: { select: { leads: true, cliques: true } },
          },
          orderBy: { nome: "asc" },
        })
      : await prisma.cliente.findMany({
          where: { id: sessao.clienteId ?? "" },
          include: {
            numeros: true,
            contas: { orderBy: { criadoEm: "asc" } },
            _count: { select: { leads: true, cliques: true } },
          },
        });

  const usuarios = await prisma.usuario.findMany({
    where:
      sessao.papel === "ADMIN"
        ? { agenciaId: sessao.agenciaId }
        : { agenciaId: sessao.agenciaId, clienteId: sessao.clienteId },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, email: true, papel: true, ativo: true, clienteId: true },
  });

  const emFoco = clientes.find((c) => c.id === clienteId) ?? clientes[0];

  // Conexão da agência com o Meta e as contas que ela enxerga (só administrador).
  const ehAdmin = sessao.papel === "ADMIN";
  const agencia = ehAdmin
    ? await prisma.agencia.findUnique({ where: { id: sessao.agenciaId }, select: { metaToken: true } })
    : null;
  let mascara: string | null = null;
  try {
    mascara = mascarar(agencia?.metaToken);
  } catch {
    mascara = "(ilegível)";
  }
  const lista = ehAdmin && agencia?.metaToken ? await contasDisponiveis(sessao.agenciaId) : { contas: [] };
  const donoDaConta = new Map<string, string>();
  for (const c of clientes) for (const conta of c.contas) donoDaConta.set(conta.contaId, c.nome);
  const disponiveis: ContaListada[] = lista.contas.map((c) => ({
    ...c,
    usadaPor: donoDaConta.get(c.contaId) ?? null,
  }));
  const appUrl = process.env.APP_URL ?? "https://painel.jlads.com.br";

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Ajustes</h1>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-suave">Clientes</h2>
        <div className="flex flex-col gap-3">
          {clientes.map((c) => (
            <article key={c.id} className="rounded-2xl border border-borda bg-superficie p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium">{c.nome}</h3>
                  <p className="mt-0.5 text-sm text-suave">
                    {c.numeros.map((n) => formatarTelefone(n.numero)).join(", ") || "sem número"}
                  </p>
                </div>
                {!c.ativo && <Selo tom="alerta">inativo</Selo>}
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Selo>{c._count.leads} leads</Selo>
                <Selo>{c._count.cliques} cliques</Selo>
                <Selo tom={c.pixelId && c.capiToken ? "ok" : "alerta"}>
                  {c.pixelId && c.capiToken ? "API de Conversões ligada" : "API de Conversões desligada"}
                </Selo>
                <Selo tom={c.contas.length ? "ok" : "alerta"}>
                  {c.contas.length === 0
                    ? "sem conta de anúncios"
                    : c.contas.length === 1
                      ? c.contas[0].contaId
                      : `${c.contas.length} contas de anúncios`}
                </Selo>
                <Selo>{ROTULO_FUNIL[c.funil]}</Selo>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-marca-texto">
                  Script da página e parâmetros dos anúncios
                </summary>
                <BlocoCopiavel
                  texto={`<script async src="${appUrl}/jl.js"
        data-cliente="${c.id}"
        data-numero="${c.numeros[0]?.numero ?? "5511999999999"}"
        data-servico="orçamento"></script>`}
                />
                <p className="mt-2 text-xs text-suave">
                  Cole antes do &lt;/body&gt;. O script acha sozinho os botões de WhatsApp e os formulários com campo de telefone, e registra quem enviou.
                </p>
                <p className="mt-4 text-sm font-medium">Parâmetros de URL dos anúncios</p>
                <p className="mt-1 text-xs text-suave">
                  No Gerenciador de Anúncios, em cada anúncio: Rastreamento → Parâmetros de URL. É o
                  mesmo texto para todo cliente; o Meta preenche o que está entre chaves no clique.
                </p>
                <BlocoCopiavel texto={PARAMETROS_URL_META} />
              </details>
            </article>
          ))}
        </div>
      </section>

      {ehAdmin && (
        <ConexaoMeta
          mascara={mascara}
          contasVisiveis={lista.contas.length}
          erroLista={agencia?.metaToken ? (lista.erro ?? null) : null}
        />
      )}

      {ehAdmin && emFoco && (
        <ContasDoCliente
          key={emFoco.id}
          clienteId={emFoco.id}
          nomeCliente={emFoco.nome}
          ligadas={emFoco.contas.map((c) => ({ id: c.id, contaId: c.contaId, nome: c.nome }))}
          disponiveis={disponiveis}
        />
      )}

      <FormulariosAjustes
        papel={sessao.papel}
        clienteEmFoco={emFoco ? { id: emFoco.id, nome: emFoco.nome } : null}
        funilAtual={emFoco?.funil ?? "COMPLETO"}
        clientes={clientes.map((c) => ({ id: c.id, nome: c.nome }))}
      />

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-suave">Usuários</h2>
        <ul className="flex flex-col gap-2">
          {usuarios.map((u) => (
            <li
              key={u.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-borda bg-superficie px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{u.nome}</p>
                <p className="truncate text-xs text-suave">{u.email}</p>
              </div>
              <Selo tom={u.papel === "ADMIN" ? "marca" : "neutro"}>{u.papel.toLowerCase()}</Selo>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
