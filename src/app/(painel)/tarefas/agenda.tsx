import Link from "next/link";
import type { DiaAgenda, ItemAgenda } from "@/lib/agenda";
import { partesLocais } from "@/lib/datas";

/**
 * Agenda semanal e mensal no formato que todo mundo já sabe ler: colunas por
 * dia, linhas por hora, blocos onde há compromisso e espaço vazio onde está
 * livre. É o espaço vazio que responde "que horário eu tenho para marcar?".
 */

const NOMES_DIA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HORA_INICIO = 7;
const HORA_FIM = 21;
const ALTURA_HORA = 52; // px

/** Leva para a ficha certa: prospect na prospecção, cliente no negócio. */
function destino(item: ItemAgenda) {
  if (!item.clienteId) return "/tarefas?modo=lista&de=jlads";
  const prospect = [
    "PROSPECCAO",
    "ABORDADO",
    "RESPONDEU",
    "REUNIAO_MARCADA",
    "PROPOSTA_ENVIADA",
    "NEGOCIANDO",
    "PERDIDO",
  ].includes(item.clienteCiclo ?? "");
  return prospect ? `/prospeccao/${item.clienteId}` : `/negocio/${item.clienteId}`;
}

function Chip({ item, compacto }: { item: ItemAgenda; compacto?: boolean }) {
  const feita = item.status === "FEITA";
  return (
    <Link
      href={destino(item)}
      title={[item.horario, item.titulo, item.clienteNome].filter(Boolean).join(" · ")}
      className={`block truncate rounded-md px-1.5 py-0.5 text-xs ${
        feita
          ? "bg-fundo text-suave line-through"
          : item.automatica
            ? "bg-marca-suave text-marca-texto"
            : "bg-[#141414] text-[#f6f4ef] dark:bg-[#f6f4ef] dark:text-[#141414]"
      }`}
    >
      {item.horario && !compacto ? `${item.horario} ` : ""}
      {item.titulo}
    </Link>
  );
}

export function AgendaSemana({ dias }: { dias: DiaAgenda[] }) {
  // A grade estica se houver compromisso fora do horário comercial.
  const minutos = dias.flatMap((d) => d.comHorario.map((i) => i.inicioMin ?? 0));
  const primeiraHora = Math.min(HORA_INICIO, ...minutos.map((m) => Math.floor(m / 60)));
  const ultimaHora = Math.max(HORA_FIM, ...minutos.map((m) => Math.ceil(m / 60) + 1));
  const horas = Array.from({ length: ultimaHora - primeiraHora }, (_, i) => primeiraHora + i);

  const agora = partesLocais(new Date());
  const minutoAgora = agora.hora * 60 + agora.minuto;

  return (
    <div className="overflow-x-auto rounded-2xl border border-borda bg-superficie">
      <div className="min-w-[760px]">
        {/* Cabeçalho dos dias */}
        <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-borda">
          <div />
          {dias.map((d) => (
            <div key={d.chave} className="px-2 py-2 text-center">
              <p className="text-xs uppercase tracking-wide text-suave">{NOMES_DIA[d.diaSemana]}</p>
              <p
                className={`mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full font-titulo text-sm font-semibold ${
                  d.hoje ? "bg-marca text-sobre-marca" : ""
                }`}
              >
                {d.diaDoMes}
              </p>
            </div>
          ))}
        </div>

        {/* Faixa do dia inteiro: tarefas com prazo e sem horário */}
        <div className="grid grid-cols-[48px_repeat(7,1fr)] border-b border-borda">
          <div className="px-1 py-1.5 text-right text-[10px] leading-tight text-suave">dia todo</div>
          {dias.map((d) => (
            <div key={d.chave} className="flex min-h-[32px] flex-col gap-1 border-l border-borda p-1">
              {d.diaInteiro.map((i) => (
                <Chip key={i.id} item={i} />
              ))}
            </div>
          ))}
        </div>

        {/* Grade de horas */}
        <div className="grid grid-cols-[48px_repeat(7,1fr)]">
          <div>
            {horas.map((h) => (
              <div key={h} style={{ height: ALTURA_HORA }} className="pr-1 text-right text-[11px] text-suave">
                <span className="-translate-y-2 inline-block">{String(h).padStart(2, "0")}:00</span>
              </div>
            ))}
          </div>

          {dias.map((d) => (
            <div key={d.chave} className="relative border-l border-borda">
              {horas.map((h) => (
                <div key={h} style={{ height: ALTURA_HORA }} className="border-t border-borda/60" />
              ))}

              {/* Linha do agora, só no dia de hoje */}
              {d.hoje && minutoAgora >= primeiraHora * 60 && minutoAgora <= ultimaHora * 60 && (
                <div
                  className="absolute inset-x-0 z-10 h-0.5 bg-alerta"
                  style={{ top: ((minutoAgora - primeiraHora * 60) / 60) * ALTURA_HORA }}
                />
              )}

              {d.comHorario.map((i) => {
                const topo = (((i.inicioMin ?? 0) - primeiraHora * 60) / 60) * ALTURA_HORA;
                const altura = Math.max((i.duracaoMin / 60) * ALTURA_HORA - 2, 22);
                const feita = i.status === "FEITA";
                return (
                  <Link
                    key={i.id}
                    href={destino(i)}
                    style={{ top: topo + 1, height: altura }}
                    className={`absolute inset-x-1 overflow-hidden rounded-lg px-1.5 py-1 text-xs ${
                      feita
                        ? "bg-fundo text-suave line-through"
                        : "bg-marca text-sobre-marca"
                    }`}
                  >
                    <p className="font-semibold">{i.horario}</p>
                    <p className="truncate">{i.titulo}</p>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AgendaMes({ dias }: { dias: DiaAgenda[] }) {
  const LIMITE = 3;

  return (
    <div className="overflow-hidden rounded-2xl border border-borda bg-superficie">
      <div className="grid grid-cols-7 border-b border-borda">
        {[1, 2, 3, 4, 5, 6, 0].map((n) => (
          <p key={n} className="py-2 text-center text-xs uppercase tracking-wide text-suave">
            {NOMES_DIA[n]}
          </p>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {dias.map((d, idx) => {
          const itens = [...d.comHorario, ...d.diaInteiro];
          const extras = itens.length - LIMITE;
          return (
            <div
              key={d.chave}
              className={`min-h-[92px] border-borda p-1 sm:min-h-[110px] ${idx % 7 !== 0 ? "border-l" : ""} ${
                idx >= 7 ? "border-t" : ""
              } ${d.foraDoMes ? "bg-fundo/60" : ""}`}
            >
              <Link
                href={`/tarefas?modo=semana&data=${d.chave}`}
                className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full font-titulo text-xs font-semibold ${
                  d.hoje ? "bg-marca text-sobre-marca" : d.foraDoMes ? "text-suave" : ""
                }`}
              >
                {d.diaDoMes}
              </Link>
              <div className="flex flex-col gap-0.5">
                {itens.slice(0, LIMITE).map((i) => (
                  <Chip key={i.id} item={i} compacto />
                ))}
                {extras > 0 && (
                  <Link href={`/tarefas?modo=semana&data=${d.chave}`} className="px-1 text-xs text-suave">
                    +{extras} mais
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
