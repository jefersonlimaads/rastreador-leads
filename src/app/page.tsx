import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/auth";

export default async function Raiz() {
  const sessao = await sessaoAtual();
  // Quem gere vários clientes começa na carteira; quem atende, na fila do dia.
  // Administrador começa no próprio negócio; quem atende, na fila do dia.
  redirect(sessao?.papel === "ADMIN" ? "/negocio" : "/hoje");
}
