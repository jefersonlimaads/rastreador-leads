import Link from "next/link";
import { exigirCliente, podeVerDinheiro } from "@/lib/auth";
import { listarLeads } from "@/lib/consultas";
import { ROTULO_STATUS } from "@/lib/regras";
import { CartaoLead, Vazio } from "../componentes";

export default async function PaginaLeads({ searchParams }: PageProps<"/leads">) {
  const filtros = await searchParams;
  const { sessao, clienteId } = await exigirCliente(
    typeof filtros.cliente === "string" ? filtros.cliente : null,
  );

  const busca = typeof filtros.busca === "string" ? filtros.busca : "";
  const status = typeof filtros.status === "string" ? filtros.status : "";
  const adId = typeof filtros.ad === "string" ? filtros.ad : "";

  const leads = await listarLeads(clienteId, {
    busca: busca || undefined,
    status: status || undefined,
    adId: adId || undefined,
  });

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
        <Link
          href="/leads/novo"
          className="rounded-xl bg-marca px-4 py-2.5 text-sm font-medium text-white"
        >
          Cadastrar
        </Link>
      </div>

      <form className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          name="busca"
          defaultValue={busca}
          placeholder="Nome ou telefone"
          className="flex-1 rounded-xl border border-borda bg-superficie px-3 py-2.5 text-sm outline-none focus:border-marca"
        />
        <select
          name="status"
          defaultValue={status}
          className="rounded-xl border border-borda bg-superficie px-3 py-2.5 text-sm"
        >
          <option value="">Todos os status</option>
          {Object.entries(ROTULO_STATUS).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
        {adId && <input type="hidden" name="ad" value={adId} />}
        <button type="submit" className="rounded-xl border border-borda px-4 py-2.5 text-sm">
          Filtrar
        </button>
      </form>

      {adId && (
        <p className="mt-3 text-sm text-suave">
          Filtrando pelo anúncio {adId}.{" "}
          <Link href="/leads" className="text-marca">
            limpar
          </Link>
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {leads.length === 0 ? (
          <Vazio>Nenhum lead com esses filtros.</Vazio>
        ) : (
          leads.map((lead) => (
            <CartaoLead key={lead.id} lead={lead} mostrarValor={podeVerDinheiro(sessao.papel)} />
          ))
        )}
      </div>
    </>
  );
}
