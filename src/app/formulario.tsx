"use client";

import { useState, useTransition, type FormHTMLAttributes, type ReactNode } from "react";

/**
 * Formulário que não se apaga sozinho.
 *
 * No React 19, <form action={...}> limpa todos os campos assim que a ação
 * responde — inclusive quando a resposta é um erro de validação. A pessoa
 * preenchia o cadastro inteiro, esquecia um campo e perdia tudo.
 *
 * Aqui o envio passa pelo onSubmit, que não dispara essa limpeza. O que foi
 * digitado fica na tela até dar certo; quem precisa limpar depois do sucesso
 * remonta o formulário com uma key nova.
 */
export function Formulario({
  acao,
  children,
  ...resto
}: {
  acao: (dados: FormData) => void;
  children: ReactNode;
} & Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit">) {
  const [, iniciar] = useTransition();

  return (
    <form
      {...resto}
      onSubmit={(e) => {
        e.preventDefault();
        const dados = new FormData(e.currentTarget);
        // Botão de envio com name/value (ex.: status) também precisa ir junto.
        const enviador = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        if (enviador?.name) dados.set(enviador.name, enviador.value);
        iniciar(() => acao(dados));
      }}
    >
      {children}
    </form>
  );
}

/**
 * Chave que muda a cada envio bem-sucedido. Usada como key do formulário, faz
 * ele remontar vazio só quando deu certo — nunca depois de um erro.
 */
export function useLimparAoConcluir(estado: { ok?: unknown }) {
  const [chave, setChave] = useState(0);
  // Ajuste de estado durante o render ao ver um estado novo: o jeito do React
  // de derivar de uma mudança, sem efeito e sem render em cascata.
  const [visto, setVisto] = useState(estado);
  if (estado !== visto) {
    setVisto(estado);
    if (estado.ok) setChave(chave + 1);
  }
  return chave;
}
