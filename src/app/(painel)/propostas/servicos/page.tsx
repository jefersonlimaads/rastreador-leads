import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { servicosDaAgencia } from "@/lib/servicos";
import { NovoServico } from "./formulario";
import { acaoAlternarServico, acaoExcluirServico } from "./acoes";

/**
 * A lista que aparece como caixinhas na proposta. Fica aqui, e não dentro do
 * formulário, porque mexer no catálogo é decisão de negócio — não é algo que
 * se faz no meio de escrever uma proposta para um lead.
 */
export default async function PaginaServicos() {
  const sessao = await exigirAdmin();
  const servicos = await servicosDaAgencia(sessao.agenciaId);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Serviços</h1>
          <p className="mt-1 text-sm text-suave">
            O que aparece para marcar na proposta. Alterar aqui não mexe em proposta já enviada.
          </p>
        </div>
        <Link href="/propostas" className="shrink-0 rounded-xl border border-borda px-3 py-2 text-sm">
          Voltar
        </Link>
      </div>

      <ul className="mt-5 flex flex-col gap-2">
        {servicos.map((s) => (
          <li
            key={s.id}
            className={`flex items-start justify-between gap-3 rounded-2xl border border-borda bg-superficie p-3.5 ${
              s.ativo ? "" : "opacity-60"
            }`}
          >
            <div className="min-w-0">
              <p className="font-medium [overflow-wrap:anywhere]">{s.nome}</p>
              {s.detalhe && <p className="mt-0.5 text-sm text-suave">{s.detalhe}</p>}
              {!s.ativo && <p className="mt-1 text-xs text-suave">fora da lista</p>}
            </div>
            <div className="flex shrink-0 gap-2">
              <form action={acaoAlternarServico}>
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" className="rounded-lg border border-borda px-2.5 py-1.5 text-xs">
                  {s.ativo ? "Tirar" : "Voltar"}
                </button>
              </form>
              <form action={acaoExcluirServico}>
                <input type="hidden" name="id" value={s.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-borda px-2.5 py-1.5 text-xs text-alerta"
                >
                  Apagar
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      <NovoServico />
    </>
  );
}
