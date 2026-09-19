import Link from "next/link";
import { formatarTelefone, linkWhatsapp } from "@/lib/telefone";
import { ROTULO_ATRIBUICAO, ROTULO_STATUS } from "@/lib/regras";
import { acaoRegistrarContato } from "./acoes";

export function Selo({
  children,
  tom = "neutro",
}: {
  children: React.ReactNode;
  tom?: "neutro" | "marca" | "alerta" | "ok";
}) {
  const tons = {
    neutro: "bg-fundo text-suave",
    marca: "bg-marca-suave text-marca-texto",
    alerta: "bg-alerta-suave text-alerta",
    ok: "bg-ok-suave text-ok",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tons[tom]}`}>{children}</span>
  );
}

export function tempoRelativo(data: Date): string {
  const minutos = Math.floor((Date.now() - data.getTime()) / 60000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  const dias = Math.floor(horas / 24);
  return `há ${dias}d`;
}

export function moeda(valor: number | null | undefined): string {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export type LeadCartao = {
  id: string;
  nome: string | null;
  telefone: string | null;
  interesse: string | null;
  status: string;
  atribuicao: string;
  criadoEm: Date;
  ultimoEventoEm: Date | null;
  anuncio: string | null;
  valorVenda: number | null;
};

/**
 * Um lead numa lista. Compacto de propósito: no celular cabem vários por tela.
 * O cartão inteiro abre o lead; os dois botões fazem as ações do dia a dia sem
 * precisar entrar nele.
 */
export function CartaoLead({
  lead,
  destaque,
  mostrarValor,
}: {
  lead: LeadCartao;
  destaque?: string;
  mostrarValor?: boolean;
}) {
  const titulo =
    lead.nome ||
    (lead.telefone ? formatarTelefone(lead.telefone) : null) ||
    lead.interesse ||
    "Lead sem identificação";
  const detalhe = [
    lead.nome && lead.telefone ? formatarTelefone(lead.telefone) : null,
    lead.nome || lead.telefone ? lead.interesse : null,
    tempoRelativo(lead.criadoEm),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article
      className={`relative flex flex-col gap-3 rounded-2xl border border-borda bg-superficie p-3.5 transition-colors hover:border-suave sm:flex-row sm:items-center ${
        destaque ? "border-l-4 border-l-alerta" : ""
      }`}
    >
      {/* O link cobre o cartão; os botões ficam por cima dele. */}
      <Link href={`/leads/${lead.id}`} className="absolute inset-0 rounded-2xl" aria-label={`Abrir ${titulo}`} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{titulo}</p>
          {destaque && <span className="shrink-0 text-xs font-medium text-alerta">{destaque}</span>}
        </div>
        <p className="mt-0.5 truncate text-sm text-suave">{detalhe}</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Selo tom={lead.status === "FECHADO" ? "ok" : lead.status === "PERDIDO" ? "neutro" : "marca"}>
            {ROTULO_STATUS[lead.status] ?? lead.status}
          </Selo>
          {lead.anuncio ? (
            <Selo>{lead.anuncio}</Selo>
          ) : (
            lead.atribuicao !== "EXATA" && <Selo>origem {ROTULO_ATRIBUICAO[lead.atribuicao]?.toLowerCase() ?? "?"}</Selo>
          )}
          {mostrarValor && lead.valorVenda != null && <Selo tom="ok">{moeda(lead.valorVenda)}</Selo>}
        </div>
      </div>

      <div className="relative z-10 flex shrink-0 gap-2">
        {/* Sem telefone não há conversa para abrir: o lead veio da confirmação
            em lote, onde o cliente não precisa digitar nada. */}
        {lead.telefone && (
          <a
            href={linkWhatsapp(lead.telefone)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center whitespace-nowrap rounded-xl bg-marca px-3 py-2 text-sm font-medium text-sobre-marca sm:flex-none sm:px-3.5"
          >
            WhatsApp
          </a>
        )}
        <form action={acaoRegistrarContato} className="flex-1 sm:flex-none">
          <input type="hidden" name="leadId" value={lead.id} />
          <button
            type="submit"
            title="Marca que você falou com o lead agora: sai da fila de sem resposta"
            className="w-full whitespace-nowrap rounded-xl border border-borda bg-superficie px-3 py-2 text-sm sm:px-3.5"
          >
            Registrei contato
          </button>
        </form>
      </div>
    </article>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-borda px-4 py-6 text-center text-sm text-suave">
      {children}
    </p>
  );
}

export function Secao({
  titulo,
  contagem,
  children,
}: {
  titulo: string;
  contagem?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 first:mt-0">
      <h2 className="mb-2 flex items-baseline gap-2 text-sm font-semibold uppercase tracking-wide text-suave">
        {titulo}
        {contagem != null && <span className="text-xs font-normal">{contagem}</span>}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}
