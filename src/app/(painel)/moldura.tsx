"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Papel } from "@prisma/client";
import { sair } from "../login/actions";

/**
 * A moldura do painel: cabeçalho, menu e a largura do conteúdo.
 *
 * Dois ambientes, nunca misturados:
 *   jl.ads  — o negócio: clientes, financeiro, prospecção, tarefas.
 *   Cliente — campanhas e leads de um cliente por vez.
 *
 * No computador o menu fica no topo; no celular, embaixo, ao alcance do
 * polegar, com ícone — seis palavras lado a lado não cabem numa tela de 375px.
 */

type ItemNav = { href: string; rotulo: string; icone: keyof typeof ICONES; sóGestor?: boolean };

const AMBIENTE_JLADS: ItemNav[] = [
  { href: "/negocio", rotulo: "Negócio", icone: "negocio" },
  { href: "/prospeccao", rotulo: "Prospecção", icone: "prospeccao" },
  { href: "/propostas", rotulo: "Propostas", icone: "propostas" },
  { href: "/tarefas", rotulo: "Tarefas", icone: "tarefas" },
  { href: "/carteira", rotulo: "Clientes", icone: "clientes" },
];

const AMBIENTE_CLIENTE: ItemNav[] = [
  { href: "/hoje", rotulo: "Hoje", icone: "hoje" },
  { href: "/pipeline", rotulo: "Pipeline", icone: "pipeline" },
  { href: "/leads", rotulo: "Leads", icone: "leads" },
  { href: "/anuncios", rotulo: "Anúncios", icone: "anuncios", sóGestor: true },
  { href: "/relatorios", rotulo: "Relatório", icone: "relatorio", sóGestor: true },
  { href: "/ajustes", rotulo: "Ajustes", icone: "ajustes" },
];

const DA_CASA = ["/negocio", "/prospeccao", "/propostas", "/tarefas", "/carteira", "/plataforma", "/conta"];

/** Rotas que pertencem ao ambiente da jl.ads. */
export function ambienteDaRota(caminho: string): "jlads" | "cliente" {
  return DA_CASA.some((r) => caminho === r || caminho.startsWith(r + "/")) ? "jlads" : "cliente";
}

/** Telas de colunas lado a lado: usam a largura da tela no computador. */
const LARGAS = ["/pipeline", "/prospeccao", "/propostas", "/tarefas"];

function ativo(caminho: string, href: string) {
  return caminho === href || caminho.startsWith(href + "/");
}

export function Moldura({
  papel,
  nome,
  plataforma,
  clienteAtual,
  clientes,
  children,
}: {
  papel: Papel;
  nome: string;
  plataforma: boolean;
  clienteAtual: { id: string; nome: string } | null;
  clientes: { id: string; nome: string }[];
  children: React.ReactNode;
}) {
  const caminho = usePathname();
  const ehAdmin = papel === "ADMIN";
  const ambiente = ehAdmin ? ambienteDaRota(caminho) : "cliente";
  const itens =
    ambiente === "jlads"
      ? AMBIENTE_JLADS
      : AMBIENTE_CLIENTE.filter((i) => !i.sóGestor || papel !== "ATENDENTE");
  const larga = LARGAS.includes(caminho);
  const largura = larga ? "max-w-6xl" : "max-w-4xl";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-borda bg-superficie/95 backdrop-blur">
        <div className={`mx-auto flex w-full ${largura} items-center justify-between gap-3 px-4 py-2.5`}>
          {ambiente === "jlads" || !ehAdmin ? (
            <Link href={ehAdmin ? "/negocio" : "/hoje"} className="font-titulo text-lg font-bold tracking-tight">
              jl<span className="text-marca-texto">.</span>ads
            </Link>
          ) : (
            <SeletorCliente atual={clienteAtual} clientes={clientes} caminho={caminho} />
          )}
          <MenuUsuario nome={nome} plataforma={plataforma} />
        </div>

        {/* Menu no topo, só no computador. */}
        <nav className={`mx-auto hidden w-full ${largura} gap-1 px-2 md:flex`}>
          {itens.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 border-b-2 px-3 pb-2.5 pt-1 text-sm ${
                ativo(caminho, item.href)
                  ? "border-marca font-semibold text-texto"
                  : "border-transparent text-suave hover:text-texto"
              }`}
            >
              <Icone nome={item.icone} className="h-4 w-4" />
              {item.rotulo}
            </Link>
          ))}
        </nav>
      </header>

      {/* pb-28 no celular deixa espaço para o menu fixo embaixo. */}
      <main className={`mx-auto w-full ${largura} flex-1 px-4 pb-28 pt-5 md:pb-12`}>{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="mx-auto flex w-full max-w-4xl">
          {itens.map((item) => {
            const marcado = ativo(caminho, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 pb-2 pt-2.5 text-[11px] ${
                  marcado ? "font-semibold text-marca-texto" : "text-suave"
                }`}
              >
                <Icone nome={item.icone} className="h-5 w-5" />
                <span className="max-w-full truncate">{item.rotulo}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/** Menu que abre ao tocar e fecha ao tocar fora ou trocar de tela. */
function useMenu() {
  const caminho = usePathname();
  // Guardar em que tela o menu foi aberto fecha ele sozinho ao navegar.
  const [abertoEm, setAbertoEm] = useState<string | null>(null);
  const aberto = abertoEm === caminho;
  const setAberto = (v: boolean) => setAbertoEm(v ? caminho : null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbertoEm(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAbertoEm(null);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);
  return { aberto, setAberto, ref };
}

/**
 * Dentro de um cliente: o nome dele, que abre a lista para trocar de cliente
 * sem voltar à carteira. Em tela de detalhe (um lead), a troca leva para o
 * Hoje do outro cliente — o lead aberto não existe lá.
 */
function SeletorCliente({
  atual,
  clientes,
  caminho,
}: {
  atual: { id: string; nome: string } | null;
  clientes: { id: string; nome: string }[];
  caminho: string;
}) {
  const { aberto, setAberto, ref } = useMenu();
  const secao = "/" + (caminho.split("/")[1] || "hoje");
  const destino = caminho.split("/").length > 2 ? "/hoje" : secao;

  return (
    <div ref={ref} className="relative flex min-w-0 items-center gap-2">
      <Link
        href="/carteira"
        aria-label="Voltar para jl.ads"
        title="Voltar para jl.ads"
        className="shrink-0 rounded-lg border border-borda px-2 py-1 text-sm text-suave hover:text-texto"
      >
        ←
      </Link>
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
        className="flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-left hover:bg-fundo"
      >
        <span className="min-w-0">
          <span className="block truncate font-titulo text-base font-bold leading-tight">
            {atual?.nome ?? "Cliente"}
          </span>
          <span className="block text-xs leading-tight text-suave">trocar cliente</span>
        </span>
        <Icone nome="seta" className="h-4 w-4 shrink-0 text-suave" />
      </button>
      {aberto && (
        <div className="absolute left-0 top-full z-30 mt-2 w-72 max-w-[85vw] overflow-hidden rounded-2xl border border-borda bg-superficie shadow-lg">
          <ul className="max-h-80 overflow-y-auto py-1">
            {clientes.map((c) => (
              <li key={c.id}>
                {/* Navegação completa: o cabeçalho (layout) só recarrega assim. */}
                <a
                  href={`${destino}?cliente=${c.id}`}
                  className={`block truncate px-4 py-2.5 text-sm hover:bg-fundo ${
                    c.id === atual?.id ? "font-semibold text-marca-texto" : ""
                  }`}
                >
                  {c.nome}
                </a>
              </li>
            ))}
          </ul>
          <Link onClick={() => setAberto(false)} href="/carteira" className="block border-t border-borda px-4 py-2.5 text-sm text-suave hover:bg-fundo">
            Ver todos na carteira
          </Link>
        </div>
      )}
    </div>
  );
}

function MenuUsuario({ nome, plataforma }: { nome: string; plataforma: boolean }) {
  const { aberto, setAberto, ref } = useMenu();
  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        aria-expanded={aberto}
        aria-label="Menu da conta"
        className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 text-sm text-suave hover:bg-fundo"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-marca text-xs font-bold text-sobre-marca">
          {iniciais}
        </span>
        <span className="hidden sm:inline">{nome}</span>
      </button>
      {aberto && (
        <div className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-2xl border border-borda bg-superficie py-1 shadow-lg">
          <Link onClick={() => setAberto(false)} href="/conta" className="block px-4 py-2.5 text-sm hover:bg-fundo">
            Minha conta
          </Link>
          {plataforma && (
            <Link onClick={() => setAberto(false)} href="/plataforma" className="block px-4 py-2.5 text-sm hover:bg-fundo">
              Plataforma
            </Link>
          )}
          <form action={sair} className="border-t border-borda">
            <button type="submit" className="block w-full px-4 py-2.5 text-left text-sm text-suave hover:bg-fundo">
              Sair
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

/** Ícones de traço, no estilo do resto da interface. */
const ICONES = {
  negocio: "M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18",
  prospeccao: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01",
  propostas: "M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5",
  tarefas: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9",
  clientes: "M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  hoje: "M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
  pipeline: "M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v6h-4z",
  leads: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  anuncios: "M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14",
  relatorio: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  ajustes: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4",
  seta: "M6 9l6 6 6-6",
} as const;

function Icone({ nome, className }: { nome: keyof typeof ICONES; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d={ICONES[nome]} />
    </svg>
  );
}
