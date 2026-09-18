"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Papel } from "@prisma/client";

const ITENS: { href: string; rotulo: string; sóGestor?: boolean; sóAdmin?: boolean }[] = [
  { href: "/carteira", rotulo: "Carteira", sóAdmin: true },
  { href: "/negocio", rotulo: "Negócio", sóAdmin: true },
  { href: "/hoje", rotulo: "Hoje" },
  { href: "/pipeline", rotulo: "Pipeline" },
  { href: "/leads", rotulo: "Leads" },
  { href: "/anuncios", rotulo: "Anúncios", sóGestor: true },
  { href: "/ajustes", rotulo: "Ajustes" },
];

export function Navegacao({ papel }: { papel: Papel }) {
  const caminho = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-borda bg-superficie pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-4xl">
        {ITENS.filter(
          (i) => (!i.sóGestor || papel !== "ATENDENTE") && (!i.sóAdmin || papel === "ADMIN"),
        ).map((item) => {
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
