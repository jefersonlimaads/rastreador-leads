import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_CLIENTE, OPCOES_COOKIE_CLIENTE } from "./lib/cookies";

/**
 * Link do painel com ?cliente=ID passa a valer para as próximas telas também.
 *
 * Sem isto, a tela aberta pelo link mostrava um cliente e o cabeçalho, as abas
 * e o próximo clique voltavam para o cliente anterior (o do cookie) — e um lead
 * aberto dali dava "não encontrado". O cookie é só um palpite: auth.ts confere
 * se o cliente é da agência de quem está logado antes de mostrar qualquer coisa.
 */
export function proxy(request: NextRequest) {
  const pedido = request.nextUrl.searchParams.get("cliente");
  if (!pedido || pedido.length > 64 || request.cookies.get(COOKIE_CLIENTE)?.value === pedido) {
    return NextResponse.next();
  }
  // Vale já nesta requisição (o layout lê o cookie) e nas seguintes.
  request.cookies.set(COOKIE_CLIENTE, pedido);
  const resposta = NextResponse.next({ request: { headers: request.headers } });
  resposta.cookies.set(COOKIE_CLIENTE, pedido, OPCOES_COOKIE_CLIENTE);
  return resposta;
}

export const config = {
  // Só telas do painel: API, arquivos, páginas públicas (proposta, relatório, confirmação) ficam de fora.
  matcher: ["/((?!api|_next|relatorio/|proposta/|confirmar/|login|.*\\..*).*)"],
};
