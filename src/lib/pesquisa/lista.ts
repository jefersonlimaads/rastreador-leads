/**
 * "Colar lista": uma empresa por linha, no formato que vier. Cada linha pode
 * ter nome, telefone, site e Instagram em qualquer ordem, separados por
 * vírgula, traço, barra ou tab — o que for número vira telefone, o que for
 * endereço de site vira site, o que tiver @ ou instagram.com vira Instagram, e
 * o resto é o nome.
 */

export type LinhaLista = {
  nome: string;
  telefone: string | null;
  site: string | null;
  instagram: string | null;
};

export const MAX_LINHAS = 50;

export function lerLista(texto: string): LinhaLista[] {
  const saida: LinhaLista[] = [];
  for (const bruta of texto.split(/\r?\n/)) {
    let linha = bruta.trim();
    if (!linha) continue;

    const ig =
      linha.match(/instagram\.com\/([A-Za-z0-9_.]{2,30})/i)?.[1] ??
      linha.match(/(?:^|\s|[|,;])@([A-Za-z0-9_.]{2,30})/)?.[1] ??
      null;
    linha = linha.replace(/https?:\/\/(www\.)?instagram\.com\/[^\s|,;]*/gi, " ").replace(/@[A-Za-z0-9_.]{2,30}/g, " ");

    const url = linha.match(/(https?:\/\/[^\s|,;]+|www\.[^\s|,;]+|\b[a-z0-9-]+\.(?:com\.br|net\.br|med\.br|adv\.br|arq\.br|odo\.br|com|net|br|site|online|app)(?:\/[^\s|,;]*)?)/i)?.[0] ?? null;
    if (url) linha = linha.replace(url, " ");

    const fone = linha.match(/(\+?\(?\d[\d\s().-]{8,}\d)/)?.[0] ?? null;
    if (fone) linha = linha.replace(fone, " ");

    // Separadores que sobram (vírgula, barra, traços) saem do nome, inclusive nas pontas.
    let nome = linha
      .replace(/[|,;\t]+/g, " ")
      .replace(/\s[-–—]+(?=\s|$)/g, " ")
      .replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!nome && url) nome = url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[./]/)[0];
    if (!nome && ig) nome = ig;
    if (!nome) continue;

    saida.push({
      nome: nome.slice(0, 120),
      telefone: fone && fone.replace(/\D/g, "").length >= 10 ? fone.trim() : null,
      site: url ? (/^https?:\/\//i.test(url) ? url : `https://${url}`) : null,
      instagram: ig,
    });
    if (saida.length >= MAX_LINHAS) break;
  }
  return saida;
}
