import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Criptografia dos tokens de acesso (Meta, Google) guardados no banco.
 *
 * Token de anúncio dá acesso à conta de mídia do cliente. Guardado em texto,
 * qualquer vazamento do banco — backup, acesso indevido, print de tela —
 * entrega as contas de todos os clientes de todas as agências. Cifrado, o banco
 * sozinho não serve para nada: a chave fica só na variável de ambiente.
 *
 * AES-256-GCM, que além de esconder o valor detecta adulteração.
 * Formato guardado: "v1:" + base64(iv | tag | texto cifrado).
 */

const PREFIXO = "v1:";

function chave(): Buffer {
  const bruta = process.env.CHAVE_CRIPTOGRAFIA;
  if (!bruta) {
    throw new Error("CHAVE_CRIPTOGRAFIA não definida: não dá para guardar token com segurança");
  }
  const buf = Buffer.from(bruta, "base64");
  if (buf.length !== 32) throw new Error("CHAVE_CRIPTOGRAFIA precisa ter 32 bytes em base64");
  return buf;
}

/** A chave está configurada e tem o formato certo? Não revela nada dela. */
export function chaveValida(): boolean {
  try {
    chave();
    return true;
  } catch {
    return false;
  }
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cifra = createCipheriv("aes-256-gcm", chave(), iv);
  const conteudo = Buffer.concat([cifra.update(texto, "utf8"), cifra.final()]);
  const tag = cifra.getAuthTag();
  return PREFIXO + Buffer.concat([iv, tag, conteudo]).toString("base64");
}

/**
 * Decifra. Valor sem o prefixo é token antigo, de antes da criptografia: é
 * devolvido como está e passa a ser cifrado na próxima vez que for salvo.
 */
export function decifrar(guardado: string | null | undefined): string | null {
  if (!guardado) return null;
  if (!guardado.startsWith(PREFIXO)) return guardado;

  const dados = Buffer.from(guardado.slice(PREFIXO.length), "base64");
  const iv = dados.subarray(0, 12);
  const tag = dados.subarray(12, 28);
  const conteudo = dados.subarray(28);

  const decifra = createDecipheriv("aes-256-gcm", chave(), iv);
  decifra.setAuthTag(tag);
  return Buffer.concat([decifra.update(conteudo), decifra.final()]).toString("utf8");
}

/** Para mostrar na tela que existe um token, sem mostrar o token. */
export function mascarar(guardado: string | null | undefined): string | null {
  const texto = decifrar(guardado);
  if (!texto) return null;
  return texto.length <= 8 ? "••••" : `••••${texto.slice(-4)}`;
}
