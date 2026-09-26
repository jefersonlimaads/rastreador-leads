import { prisma } from "@/lib/prisma";
import { exigirSessao } from "@/lib/auth";
import { mascarar } from "@/lib/cripto";
import { contasDisponiveis } from "@/lib/meta/marketing";
import { Selo } from "../componentes";
import { ConexaoMeta } from "../ajustes/meta";
import { Bloco, FormNovoUsuario, FormSenha } from "../ajustes/formularios";
import { ImportacaoCowork } from "./importacao";
import { EnderecoDeLeads } from "./leads-externos";

/**
 * Minha conta: o que é da pessoa e da agência, não de um cliente. Senha para
 * todo mundo; conexão com o Meta e equipe da agência para o administrador.
 */
export default async function PaginaConta() {
  const sessao = await exigirSessao();
  const ehAdmin = sessao.papel === "ADMIN";

  const [agencia, equipe] = ehAdmin
    ? await Promise.all([
        prisma.agencia.findUnique({
          where: { id: sessao.agenciaId },
          select: { nome: true, metaToken: true, chaveImportacaoFim: true, chaveImportacaoEm: true },
        }),
        prisma.usuario.findMany({
          where: { agenciaId: sessao.agenciaId, clienteId: null },
          orderBy: { nome: "asc" },
          select: { id: true, nome: true, email: true, papel: true },
        }),
      ])
    : [null, []];

  let mascara: string | null = null;
  try {
    mascara = mascarar(agencia?.metaToken);
  } catch {
    mascara = "(ilegível)";
  }
  const lista = ehAdmin && agencia?.metaToken ? await contasDisponiveis(sessao.agenciaId) : { contas: [] };

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Minha conta</h1>
      <p className="mt-1 text-sm text-suave">
        {sessao.nome}
        {ehAdmin && agencia ? ` · ${agencia.nome}` : ""}
      </p>

      {ehAdmin && (
        <Bloco
          titulo="Conexão com o Meta"
          descricao="Um token para todos os clientes. Cada cliente só compartilha a conta de anúncios com a BM da agência."
        >
          <ConexaoMeta
            mascara={mascara}
            contasVisiveis={lista.contas.length}
            erroLista={agencia?.metaToken ? (lista.erro ?? null) : null}
          />
        </Bloco>
      )}

      {ehAdmin && (
        <Bloco titulo="Equipe da agência" descricao="Administradores veem todos os clientes, o financeiro e a prospecção.">
          <ul className="flex flex-col gap-2">
            {equipe.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2 rounded-xl bg-fundo px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{u.nome}</p>
                  <p className="truncate text-xs text-suave">{u.email}</p>
                </div>
                <Selo tom="marca">{u.id === sessao.usuarioId ? "você" : "administrador"}</Selo>
              </li>
            ))}
          </ul>
          <FormNovoUsuario clienteId={null} papeis={["ADMIN"]} />
        </Bloco>
      )}

      {ehAdmin && agencia && (
        <Bloco
          titulo="Importação automática (Cowork)"
          descricao="Uma tarefa no Cowork pesquisa no Google Maps pelo seu navegador e manda os prospects para cá, já com briefing e mensagem. Sem custo além do seu plano do Claude."
        >
          <ImportacaoCowork
            url={process.env.APP_URL ?? "https://rastreador-leads.vercel.app"}
            agencia={agencia.nome}
            assinatura={`${sessao.nome.split(" ")[0]}, da ${agencia.nome}`}
            chaveAtual={
              agencia.chaveImportacaoFim && agencia.chaveImportacaoEm
                ? { fim: agencia.chaveImportacaoFim, em: agencia.chaveImportacaoEm.toLocaleDateString("pt-BR") }
                : null
            }
          />
        </Bloco>
      )}

      {ehAdmin && agencia && (
        <Bloco
          titulo="Receber leads de outra plataforma"
          descricao="Qualquer página ou automação pode mandar lead para cá, com a origem preservada. Usa a mesma chave da importação acima."
        >
          <EnderecoDeLeads url={process.env.APP_URL ?? "https://rastreador-leads.vercel.app"} />
        </Bloco>
      )}

      <Bloco titulo="Minha senha">
        <FormSenha />
      </Bloco>
    </>
  );
}
