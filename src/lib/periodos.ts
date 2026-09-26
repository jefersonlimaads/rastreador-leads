import "server-only";
import { FUSO_PADRAO, fimDoDia, inicioDoDia, instanteLocal, partesLocais } from "./datas";

/**
 * Os períodos que a tela oferece, e o anterior comparável de cada um.
 *
 * Tudo no fuso do cliente: "hoje" de um cliente em Manaus não é o mesmo
 * instante que o de um em São Paulo, e usar UTC faria o dia virar cedo demais.
 *
 * O período anterior tem sempre o mesmo tamanho, e para mês fechado é o mês
 * anterior de verdade — não 30 dias para trás. Comparar setembro com "os 30
 * dias antes" mistura pedaço de agosto com pedaço de julho.
 */

export type ChavePeriodo =
  | "hoje"
  | "ontem"
  | "7dias"
  | "14dias"
  | "30dias"
  | "este_mes"
  | "mes_anterior"
  | "personalizado";

export type Periodo = {
  chave: ChavePeriodo;
  rotulo: string;
  de: Date;
  ate: Date;
  /** O mesmo recorte, imediatamente antes. Para a comparação. */
  anterior: { de: Date; ate: Date };
};

export const PERIODOS: { chave: ChavePeriodo; rotulo: string }[] = [
  { chave: "hoje", rotulo: "Hoje" },
  { chave: "ontem", rotulo: "Ontem" },
  { chave: "7dias", rotulo: "7 dias" },
  { chave: "14dias", rotulo: "14 dias" },
  { chave: "30dias", rotulo: "30 dias" },
  { chave: "este_mes", rotulo: "Este mês" },
  { chave: "mes_anterior", rotulo: "Mês anterior" },
];

const DIA = 24 * 60 * 60 * 1000;

/** Mesmo tamanho, colado antes. Serve para qualquer recorte de dias corridos. */
function anteriorDoMesmoTamanho(de: Date, ate: Date, fuso: string) {
  /* `ate` é o fim do último dia, não o começo: a diferença dá 6,99 dias para
     uma janela de 7. Arredondar para cima é o que conta os dias inteiros. */
  const dias = Math.ceil((ate.getTime() - de.getTime()) / DIA);
  const fim = fimDoDia(new Date(de.getTime() - DIA), fuso);
  const inicio = inicioDoDia(new Date(fim.getTime() - (dias - 1) * DIA), fuso);
  return { de: inicio, ate: fim };
}

function mes(ano: number, mesNum: number, fuso: string) {
  const de = instanteLocal(ano, mesNum, 1, 0, 0, fuso);
  // Dia 0 do mês seguinte é o último deste, sem precisar saber quantos tem.
  const ultimoDia = new Date(Date.UTC(ano, mesNum, 0)).getUTCDate();
  const ate = new Date(instanteLocal(ano, mesNum, ultimoDia + 1, 0, 0, fuso).getTime() - 1);
  return { de, ate };
}

export function resolverPeriodo(
  chave: ChavePeriodo,
  fuso: string = FUSO_PADRAO,
  personalizado?: { de: string; ate: string },
): Periodo {
  const agora = new Date();
  const p = partesLocais(agora, fuso);
  const rotulo = PERIODOS.find((x) => x.chave === chave)?.rotulo ?? "Período";

  const corridos = (dias: number, deslocamento = 0) => {
    const fim = fimDoDia(new Date(agora.getTime() - deslocamento * DIA), fuso);
    const inicio = inicioDoDia(new Date(fim.getTime() - (dias - 1) * DIA), fuso);
    return { de: inicio, ate: fim };
  };

  let janela: { de: Date; ate: Date };
  let anterior: { de: Date; ate: Date };

  switch (chave) {
    case "hoje":
      janela = corridos(1);
      anterior = corridos(1, 1);
      break;
    case "ontem":
      janela = corridos(1, 1);
      anterior = corridos(1, 2);
      break;
    case "7dias":
    case "14dias":
    case "30dias": {
      const dias = chave === "7dias" ? 7 : chave === "14dias" ? 14 : 30;
      janela = corridos(dias);
      anterior = anteriorDoMesmoTamanho(janela.de, janela.ate, fuso);
      break;
    }
    case "este_mes": {
      const inteiro = mes(p.ano, p.mes, fuso);
      // Até hoje, não até o fim do mês: o resto ainda não aconteceu.
      janela = { de: inteiro.de, ate: fimDoDia(agora, fuso) };
      // Compara com o mesmo número de dias do mês passado, não o mês inteiro.
      const anteriorInteiro = mes(p.mes === 1 ? p.ano - 1 : p.ano, p.mes === 1 ? 12 : p.mes - 1, fuso);
      anterior = {
        de: anteriorInteiro.de,
        ate: new Date(Math.min(
          anteriorInteiro.ate.getTime(),
          anteriorInteiro.de.getTime() + (janela.ate.getTime() - janela.de.getTime()),
        )),
      };
      break;
    }
    case "mes_anterior": {
      janela = mes(p.mes === 1 ? p.ano - 1 : p.ano, p.mes === 1 ? 12 : p.mes - 1, fuso);
      const doisAtras = p.mes <= 2 ? { ano: p.ano - 1, m: p.mes + 10 } : { ano: p.ano, m: p.mes - 2 };
      anterior = mes(doisAtras.ano, doisAtras.m, fuso);
      break;
    }
    case "personalizado": {
      const lido = lerDatas(personalizado, fuso);
      janela = lido ?? corridos(30);
      anterior = anteriorDoMesmoTamanho(janela.de, janela.ate, fuso);
      break;
    }
  }

  return { chave, rotulo, de: janela.de, ate: janela.ate, anterior };
}

/** "2026-09-01" a "2026-09-30" no fuso do cliente, ou null se não servir. */
function lerDatas(
  p: { de: string; ate: string } | undefined,
  fuso: string,
): { de: Date; ate: Date } | null {
  if (!p?.de || !p?.ate) return null;
  const formato = /^\d{4}-\d{2}-\d{2}$/;
  if (!formato.test(p.de) || !formato.test(p.ate)) return null;

  const [a1, m1, d1] = p.de.split("-").map(Number);
  const [a2, m2, d2] = p.ate.split("-").map(Number);
  const de = instanteLocal(a1, m1, d1, 0, 0, fuso);
  const ate = new Date(instanteLocal(a2, m2, d2 + 1, 0, 0, fuso).getTime() - 1);
  if (ate < de) return null;
  // Um ano é o teto: além disso a consulta fica cara e ninguém decide com isso.
  if (ate.getTime() - de.getTime() > 366 * DIA) return null;
  return { de, ate };
}

/** A chave veio da URL: aceita só o que existe, senão cai no padrão. */
export function lerChave(bruto: unknown): ChavePeriodo {
  const chaves: ChavePeriodo[] = [...PERIODOS.map((p) => p.chave), "personalizado"];
  return typeof bruto === "string" && (chaves as string[]).includes(bruto)
    ? (bruto as ChavePeriodo)
    : "30dias";
}
