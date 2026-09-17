import { prisma } from "@/lib/prisma";
import { exigirSessao, clienteEmFoco } from "@/lib/auth";
import { formatarTelefone } from "@/lib/telefone";
import { Selo } from "../componentes";
import { FormulariosAjustes } from "./formularios";

export default async function PaginaAjustes({ searchParams }: PageProps<"/ajustes">) {
  const { cliente: pedido } = await searchParams;
  const sessao = await exigirSessao();
  const clienteId = await clienteEmFoco(sessao, typeof pedido === "string" ? pedido : null);

  const clientes =
    sessao.papel === "ADMIN"
      ? await prisma.cliente.findMany({
          include: { numeros: true, _count: { select: { leads: true, cliques: true } } },
          orderBy: { nome: "asc" },
        })
      : await prisma.cliente.findMany({
          where: { id: sessao.clienteId ?? "" },
          include: { numeros: true, _count: { select: { leads: true, cliques: true } } },
        });

  const usuarios = await prisma.usuario.findMany({
    where: sessao.papel === "ADMIN" ? {} : { clienteId: sessao.clienteId },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true, email: true, papel: true, ativo: true, clienteId: true },
  });

  const emFoco = clientes.find((c) => c.id === clienteId) ?? clientes[0];
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
                  {c.pixelId && c.capiToken ? "Conversões configurada" : "Sem credenciais do Meta"}
                </Selo>
                <Selo tom={c.contaAnunciosId ? "ok" : "alerta"}>
                  {c.contaAnunciosId ?? "sem conta de anúncios"}
                </Selo>
              </div>

              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-marca">
                  Script para a landing page
                </summary>
                <pre className="mt-2 overflow-x-auto rounded-xl bg-fundo p-3 text-xs">
                  {`<script async src="${appUrl}/jl.js"
        data-cliente="${c.id}"
        data-numero="${c.numeros[0]?.numero ?? "5511999999999"}"
        data-servico="orçamento"></script>`}
                </pre>
                <p className="mt-2 text-xs text-suave">
                  Cole antes do &lt;/body&gt;. O script acha sozinho os links de wa.me da página.
                </p>
              </details>
            </article>
          ))}
        </div>
      </section>

      <FormulariosAjustes
        papel={sessao.papel}
        clienteEmFoco={emFoco ? { id: emFoco.id, nome: emFoco.nome } : null}
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
