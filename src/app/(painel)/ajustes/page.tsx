import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirCliente } from "@/lib/auth";
import { formatarTelefone } from "@/lib/telefone";
import { PARAMETROS_URL_META } from "@/lib/regras";
import { contasDisponiveis } from "@/lib/meta/marketing";
import { Selo } from "../componentes";
import { BlocoCopiavel } from "./copiar";
import { ContasDoCliente, type ContaListada } from "./meta";
import { Bloco, FormApiConversoes, FormFunil, FormNovoUsuario, FormNumero, FormPuxarMeta } from "./formularios";

// "Puxar dados do Meta agora" busca 90 dias e pode passar de um minuto.
export const maxDuration = 300;

/**
 * Ajustes do cliente em que você está — e só dele. O que é da agência (conexão
 * com o Meta, equipe da agência, senha) fica em Minha conta, no menu do topo.
 */
export default async function PaginaAjustes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { cliente: pedido } = await searchParams;
  const { sessao, clienteId } = await exigirCliente(typeof pedido === "string" ? pedido : null);
  const ehAdmin = sessao.papel === "ADMIN";
  const ehGestor = sessao.papel !== "ATENDENTE";

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    include: {
      numeros: true,
      contas: { orderBy: { criadoEm: "asc" } },
      usuarios: { orderBy: { nome: "asc" }, select: { id: true, nome: true, email: true, papel: true, ativo: true } },
    },
  });
  if (!cliente) return null;

  // Contas que o token da agência enxerga, marcando as que já são de outro cliente.
  let disponiveis: ContaListada[] = [];
  if (ehAdmin) {
    const [lista, usadas] = await Promise.all([
      contasDisponiveis(sessao.agenciaId),
      prisma.contaAnuncios.findMany({
        where: { cliente: { agenciaId: sessao.agenciaId } },
        select: { contaId: true, cliente: { select: { nome: true } } },
      }),
    ]);
    const dono = new Map(usadas.map((u) => [u.contaId, u.cliente.nome]));
    disponiveis = lista.contas.map((c) => ({ ...c, usadaPor: dono.get(c.contaId) ?? null }));
  }

  const appUrl = process.env.APP_URL ?? "https://painel.jlads.com.br";
  const numero = cliente.numeros[0]?.numero;
  const script = `<script async src="${appUrl}/jl.js"
        data-cliente="${cliente.id}"
        data-numero="${numero ?? "5511999999999"}"
        data-servico="orçamento"></script>`;

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Ajustes</h1>
      <p className="mt-1 text-sm text-suave">
        {cliente.nome}
        {numero ? ` · atendimento ${formatarTelefone(numero)}` : " · sem WhatsApp de atendimento"}
      </p>

      {ehAdmin && (
        <Bloco
          titulo="Contas de anúncios"
          descricao="De onde vêm o gasto e os resultados das campanhas."
        >
          <ContasDoCliente
            key={cliente.id}
            clienteId={cliente.id}
            ligadas={cliente.contas.map((c) => ({ id: c.id, contaId: c.contaId, nome: c.nome }))}
            disponiveis={disponiveis}
          />
          {cliente.contas.length > 0 && <FormPuxarMeta clienteId={cliente.id} />}
        </Bloco>
      )}

      {ehAdmin && (
        <Bloco
          titulo="Rastreamento da página"
          descricao="Para cada contato da landing page virar lead, ligado ao anúncio que o trouxe."
        >
          <div>
            <p className="text-sm font-medium">WhatsApp de atendimento</p>
            <p className="mb-2 mt-0.5 text-xs text-suave">Onde os leads chegam. É o número que o script usa nos botões da página.</p>
            <FormNumero clienteId={cliente.id} atual={numero ? formatarTelefone(numero) : null} />
          </div>
          <div className="border-t border-borda pt-3">
            <p className="text-sm font-medium">1. Script da página</p>
            <p className="mt-0.5 text-xs text-suave">
              Cole antes do &lt;/body&gt;. Ele acha sozinho os botões de WhatsApp e os formulários, e
              registra quem enviou. Formulário que pede WhatsApp vira lead na hora.
            </p>
            <BlocoCopiavel texto={script} />
          </div>
          <div className="border-t border-borda pt-3">
            <p className="text-sm font-medium">2. Parâmetros de URL dos anúncios</p>
            <p className="mt-0.5 text-xs text-suave">
              No Gerenciador de Anúncios, em cada anúncio: Rastreamento → Parâmetros de URL. É o mesmo
              texto para todo cliente; o Meta preenche o que está entre chaves no clique.
            </p>
            <BlocoCopiavel texto={PARAMETROS_URL_META} />
          </div>
        </Bloco>
      )}

      {ehAdmin && (
        <Bloco
          titulo="API de Conversões"
          descricao="Avisa o Meta de cada lead e venda pelo servidor, sem depender do pixel do navegador."
        >
          <FormApiConversoes clienteId={cliente.id} ligada={Boolean(cliente.pixelId && cliente.capiToken)} />
        </Bloco>
      )}

      {ehGestor && (
        <Bloco
          titulo="Funil de vendas"
          descricao="Define as etapas do pipeline e da tela de confirmação. Clínica e psicóloga costumam usar o simples; filmmaker, obra e consultoria, o completo."
        >
          <FormFunil clienteId={cliente.id} funilAtual={cliente.funil} />
        </Bloco>
      )}

      <Bloco titulo={`Equipe de ${cliente.nome}`} descricao="Quem do cliente acessa o painel dele.">
        {cliente.usuarios.length === 0 ? (
          <p className="text-sm text-suave">Ninguém do cliente tem acesso ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {cliente.usuarios.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2 rounded-xl bg-fundo px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{u.nome}</p>
                  <p className="truncate text-xs text-suave">{u.email}</p>
                </div>
                <Selo tom={u.papel === "GESTOR" ? "marca" : "neutro"}>
                  {u.papel === "GESTOR" ? "gestor" : "atendente"}
                </Selo>
              </li>
            ))}
          </ul>
        )}
        {ehGestor && <FormNovoUsuario clienteId={cliente.id} papeis={["ATENDENTE", "GESTOR"]} />}
      </Bloco>

      <p className="mt-6 text-sm text-suave">
        Senha{ehAdmin ? ", conexão com o Meta e equipe da agência ficam" : " fica"} em{" "}
        <Link href="/conta" className="text-marca-texto underline">
          Minha conta
        </Link>
        .
      </p>
    </>
  );
}
