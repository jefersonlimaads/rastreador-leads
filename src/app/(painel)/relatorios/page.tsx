import Link from "next/link";
import { exigirCliente, podeVerDinheiro } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatarDataHora } from "@/lib/datas";
import {
  montarRelatorio,
  periodosSugeridos,
  relatoriosDoCliente,
  validarPeriodo,
} from "@/lib/relatorio";
import { DocumentoRelatorio } from "@/app/relatorio/documento";
import { Vazio } from "../componentes";
import { EnviarRelatorio } from "./enviar";
import { acaoApagarRelatorio } from "./acoes";

const br = (iso: string) => iso.split("-").reverse().join("/");

export default async function PaginaRelatorios({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filtros = await searchParams;
  const texto = (k: string) => (typeof filtros[k] === "string" ? (filtros[k] as string) : "");
  const { sessao, clienteId } = await exigirCliente(texto("cliente") || null);

  if (!podeVerDinheiro(sessao.papel)) {
    return <Vazio>Relatórios são para gestor e administrador.</Vazio>;
  }

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { fuso: true, contatoNome: true, contatoTelefone: true },
  });
  const sugeridos = periodosSugeridos(cliente?.fuso);
  const padrao = sugeridos[1];

  const pedido = texto("de") && texto("ate") ? validarPeriodo(texto("de"), texto("ate")) : null;
  const erroPeriodo = pedido && "erro" in pedido ? pedido.erro : null;
  const periodo =
    pedido && !("erro" in pedido) ? pedido : (validarPeriodo(padrao.de, padrao.ate) as { de: Date; ate: Date });

  const [r, enviados] = await Promise.all([
    montarRelatorio(clienteId, periodo.de, periodo.ate),
    relatoriosDoCliente(clienteId),
  ]);
  if (!r) return <Vazio>Cliente não encontrado.</Vazio>;

  const escolhido = sugeridos.find((s) => s.de === r.periodo.de && s.ate === r.periodo.ate);
  const rotuloPeriodo = `${br(r.periodo.de)} a ${br(r.periodo.ate)}`;
  // Telefone do contato é dado comercial da agência: só o administrador usa.
  const whatsapp = sessao.papel === "ADMIN" ? (cliente?.contatoTelefone ?? null) : null;

  return (
    <>
      <div className="nao-imprimir">
        <h1 className="text-xl font-semibold tracking-tight">Relatório</h1>
        <p className="mt-1 text-sm text-suave">
          Escolha o período, confira a prévia e mande o link para o cliente.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {sugeridos.map((s) => (
            <Link
              key={s.rotulo}
              href={`/relatorios?de=${s.de}&ate=${s.ate}`}
              className={`rounded-xl border px-3 py-2 text-sm ${
                escolhido?.rotulo === s.rotulo
                  ? "border-marca bg-marca-suave text-marca-texto"
                  : "border-borda"
              }`}
            >
              {s.rotulo}
            </Link>
          ))}
        </div>

        {/* GET simples: o período fica na URL e a prévia recarrega com ele. */}
        <form method="get" action="/relatorios" className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-suave">
            De
            <input
              type="date"
              name="de"
              defaultValue={r.periodo.de}
              required
              className="rounded-xl border border-borda bg-superficie px-3 py-2 text-sm text-texto"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-suave">
            Até
            <input
              type="date"
              name="ate"
              defaultValue={r.periodo.ate}
              required
              className="rounded-xl border border-borda bg-superficie px-3 py-2 text-sm text-texto"
            />
          </label>
          <button type="submit" className="rounded-xl border border-borda px-4 py-2 text-sm">
            Ver período
          </button>
        </form>
        {erroPeriodo && (
          <p className="mt-2 rounded-lg bg-alerta-suave px-3 py-2 text-sm text-alerta">
            {erroPeriodo} Mostrando os últimos 30 dias.
          </p>
        )}

        <div className="mt-5">
          <EnviarRelatorio
            key={`${r.periodo.de}|${r.periodo.ate}`}
            clienteId={clienteId}
            de={r.periodo.de}
            ate={r.periodo.ate}
            rotuloPeriodo={rotuloPeriodo}
            whatsapp={whatsapp}
            contato={cliente?.contatoNome ?? null}
          />
        </div>

        <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-widest text-suave">
          Prévia
        </h2>
      </div>

      <DocumentoRelatorio r={r} />

      <section className="nao-imprimir mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-suave">
          Relatórios enviados
        </h2>
        {enviados.length === 0 ? (
          <div className="mt-2">
            <Vazio>Nenhum link gerado ainda para este cliente.</Vazio>
          </div>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {enviados.map((e) => {
              const de = e.de.toISOString().slice(0, 10);
              const ate = e.ate.toISOString().slice(0, 10);
              return (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-borda bg-superficie p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {br(de)} a {br(ate)}
                    </p>
                    <p className="text-xs text-suave">
                      Gerado {formatarDataHora(e.criadoEm, cliente?.fuso)}
                      {e.criadoPor ? ` por ${e.criadoPor}` : ""} ·{" "}
                      {e.visualizacoes === 0
                        ? "ainda não aberto"
                        : `aberto ${e.visualizacoes} ${e.visualizacoes === 1 ? "vez" : "vezes"}, a última ${formatarDataHora(e.visualizadoEm!, cliente?.fuso)}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={`/relatorio/${e.token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-borda px-3 py-1.5 text-sm"
                    >
                      Abrir
                    </a>
                    <form action={acaoApagarRelatorio}>
                      <input type="hidden" name="id" value={e.id} />
                      <button
                        type="submit"
                        className="rounded-xl border border-borda px-3 py-1.5 text-sm text-alerta"
                        title="Apaga o relatório e desativa o link"
                      >
                        Apagar
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
