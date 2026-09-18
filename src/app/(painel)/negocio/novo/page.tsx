import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { FormularioNovoCliente } from "./formulario";

export default async function PaginaNovoCliente() {
  await exigirAdmin();

  return (
    <>
      <Link href="/negocio" className="text-sm text-suave">
        ← Negócio
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">Novo cliente</h1>
      <p className="mt-1 text-sm text-suave">
        Para quem já é seu cliente. Entra direto como ativo, sem passar pela prospecção.
      </p>
      <FormularioNovoCliente />
    </>
  );
}
