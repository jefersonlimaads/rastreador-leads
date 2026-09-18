"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Papel } from "@prisma/client";

/**
 * Dois ambientes, nunca misturados.
 *
 * jl.ads   — o negócio: clientes, financeiro, tarefas. Só administrador.
 * Cliente  — campanhas e leads de um cliente por vez.
 *
 * Entra-se num cliente pela lista em Clientes, e volta-se pelo cabeçalho. Sem
 * essa separação, fee e lead disputavam a mesma barra e nenhuma das duas
 * leituras ficava limpa.
 */
const AMBIENTE_JLADS: ItemNav[] = [
  { href: "/negocio", rotulo: "Negócio" },
  { href: "/prospeccao", rotulo: "Prospecção" },
  { href: "/propostas", rotulo: "Propostas" },
  { href: "/tarefas", rotulo: "Tarefas" },
  { href: "/carteira", rotulo: "Clientes" },
];

const AMBIENTE_CLIENTE: ItemNav[] = [
  { href: "/hoje", rotulo: "Hoje" },
  { href: "/pipeline", rotulo: "Pipeline" },
  { href: "/leads", rotulo: "Leads" },
  { href: "/anuncios", rotulo: "Anúncios", sóGestor: true },
  { href: "/relatorios", rotulo: "Relatório", sóGestor: true },
  { href: "/ajustes", rotulo: "Ajustes" },
];

type ItemNav = { href: string; rotulo: string; sóGestor?: boolean };

/** Rotas que pertencem ao ambiente da jl.ads. */
export function ambienteDaRota(caminho: string): "jlads" | "cliente" {
  const daCasa = ["/negocio", "/prospeccao", "/propostas", "/tarefas", "/carteira", "/plataforma"];
  return daCasa.some((r) => caminho === r || caminho.startsWith(r + "/")) ? "jlads" : "cliente";
}

export function Navegacao({ papel }: { papel: Papel }) {
  const caminho = usePathname();
  const ambiente = papel === "ADMIN" ? ambienteDaRota(caminho) : "cliente";

  const itens =
    ambiente === "jlads"
      ? AMBIENTE_JLADS
      : AMBIENTE_CLIENTE.filter((i) => !i.sóGestor || papel !== "ATENDENTE");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-4xl">
        {itens.map((item) => {
          const ativo = caminho === item.href || caminho.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 py-3 text-center text-[13px] ${
                ativo ? "font-semibold text-marca-texto" : "text-suave"
              }`}
            >
              {item.rotulo}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
