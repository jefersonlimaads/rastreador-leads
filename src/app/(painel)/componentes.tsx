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

export function CartaoLead({
  lead,
  destaque,
  mostrarValor,
}: {
  lead: LeadCartao;
  destaque?: string;
  mostrarValor?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border bg-superficie p-4 ${
        destaque ? "border-alerta" : "border-borda"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/leads/${lead.id}`} className="block truncate font-medium">
            {lead.nome ||
              (lead.telefone ? formatarTelefone(lead.telefone) : null) ||
              lead.interesse ||
              "Lead sem identificação"}
          </Link>
          <p className="mt-0.5 text-sm text-suave">
            {[
              lead.nome && lead.telefone ? formatarTelefone(lead.telefone) : null,
              lead.nome || lead.telefone ? lead.interesse : null,
              tempoRelativo(lead.criadoEm),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {destaque && <Selo tom="alerta">{destaque}</Selo>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Selo tom={lead.status === "FECHADO" ? "ok" : "neutro"}>
          {ROTULO_STATUS[lead.status] ?? lead.status}
        </Selo>
        <Selo tom={lead.atribuicao === "EXATA" ? "marca" : "neutro"}>
          {ROTULO_ATRIBUICAO[lead.atribuicao] ?? lead.atribuicao}
        </Selo>
        {lead.anuncio && <Selo>{lead.anuncio}</Selo>}
        {mostrarValor && lead.valorVenda != null && <Selo tom="ok">{moeda(lead.valorVenda)}</Selo>}
      </div>

      <div className="mt-4 flex gap-2">
        {/* Sem telefone não há conversa para abrir: o lead veio da confirmação
            em lote, onde o cliente não precisa digitar nada. */}
        {lead.telefone && (
          <a
            href={linkWhatsapp(lead.telefone)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 rounded-xl bg-marca px-3 py-2.5 text-center text-sm font-medium text-sobre-marca"
          >
            Abrir conversa
          </a>
        )}
        <form action={acaoRegistrarContato} className="flex-1">
          <input type="hidden" name="leadId" value={lead.id} />
          <button
            type="submit"
            className="w-full rounded-xl border border-borda px-3 py-2.5 text-sm font-medium"
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
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}
