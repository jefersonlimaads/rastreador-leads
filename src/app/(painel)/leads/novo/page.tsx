import { exigirCliente } from "@/lib/auth";
import { cliquesRecentes } from "@/lib/consultas";
import { FormularioCadastro } from "./formulario";

export default async function PaginaNovoLead({ searchParams }: PageProps<"/leads/novo">) {
  const { cliente } = await searchParams;
  const { clienteId } = await exigirCliente(typeof cliente === "string" ? cliente : null);
  const cliques = await cliquesRecentes(clienteId, 8);

  return (
    <>
      <h1 className="text-xl font-semibold tracking-tight">Cadastrar lead</h1>
      <p className="mt-1 text-sm text-suave">
        Cole a mensagem recebida no WhatsApp. O código é lido sozinho.
      </p>

      <div className="mt-5">
        <FormularioCadastro
          clienteId={clienteId}
          cliquesRecentes={cliques.map((c) => ({
            id: c.id,
            codigo: c.codigo,
            adId: c.adId,
            utmCampaign: c.utmCampaign,
            criadoEm: c.criadoEm.toISOString(),
          }))}
        />
      </div>
    </>
  );
}
