import Link from "next/link";
import { exigirSessao } from "@/lib/auth";
import { sair } from "../login/actions";
import { Navegacao } from "./navegacao";

export default async function LayoutPainel({ children }: LayoutProps<"/">) {
  const sessao = await exigirSessao();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b border-borda bg-superficie/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/hoje" className="font-semibold tracking-tight">
            JL Ads
          </Link>
          <div className="flex items-center gap-3 text-sm text-suave">
            <span className="hidden sm:inline">{sessao.nome}</span>
            <form action={sair}>
              <button type="submit" className="rounded-lg px-2 py-1 hover:bg-fundo">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* pb-24 deixa espaço para a barra de navegação fixa no celular. */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-28 pt-4">{children}</main>

      <Navegacao papel={sessao.papel} />
    </div>
  );
}
