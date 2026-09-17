import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/auth";
import { FormularioLogin } from "./formulario";

export default async function PaginaLogin() {
  const sessao = await sessaoAtual();
  if (sessao) redirect("/hoje");

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Rastreador de leads</h1>
        <p className="mt-1 text-sm text-suave">JL Ads</p>
        <div className="mt-8 rounded-2xl border border-borda bg-superficie p-5">
          <FormularioLogin />
        </div>
      </div>
    </main>
  );
}
