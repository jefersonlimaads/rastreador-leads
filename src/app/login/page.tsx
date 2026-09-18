import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/auth";
import { FormularioLogin } from "./formulario";

export default async function PaginaLogin() {
  const sessao = await sessaoAtual();
  if (sessao) redirect("/hoje");

  return (
    <main className="flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mx-auto w-full max-w-sm">
        <p className="font-titulo text-2xl font-bold tracking-tight">
          jl<span className="text-marca-texto">.</span>ads
        </p>
        <h1 className="mt-6 text-xl font-semibold tracking-tight">Rastreador de leads</h1>
        <div className="mt-8 rounded-2xl border border-borda bg-superficie p-5">
          <FormularioLogin />
        </div>
      </div>
    </main>
  );
}
