/** Cliente em foco no painel do administrador. Só um palpite: auth.ts confere a agência. */
export const COOKIE_CLIENTE = "jl_cliente";

export const OPCOES_COOKIE_CLIENTE = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 90,
};
